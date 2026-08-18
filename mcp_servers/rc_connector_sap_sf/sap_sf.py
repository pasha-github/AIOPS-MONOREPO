from datetime import datetime, timezone
import json
from pathlib import Path
import re
from typing import Optional

from fastapi import FastAPI, Form, Header, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
import requests

app = FastAPI()

# =====================================
# Load Status Master from External JSON File
# =====================================

JSON_PATH = Path(__file__).parent / "sf_status_master.json"


def load_status_master() -> dict:
    if JSON_PATH.exists():
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading {JSON_PATH}: {e}")
    return {}


STATUS_MASTER = load_status_master()

# =====================================
# SAP & Webhook Configuration
# =====================================

API_KEY = "VgGuBRjIsH4YY41glaAKLBtBLMPfk0KX"
BASE_URL = "https://sandbox.api.sap.com/successfactorsfoundation/odata/v2"
WEBHOOK_URL = "https://agent-manager-428716175586.us-central1.run.app/agent/servicenow_automation_agent/webhook/invoke/25048a3b-be9d-4879-9221-84c7cf47408c"

HEADERS = {
    "APIKey": API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json",
}

HEADERS_UPDATE = {
    "APIKey": API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-HTTP-Method": "MERGE",
}


# =====================================
# Authentication & Helpers
# =====================================


def check_key(api_key: Optional[str]):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")


def sap_to_date(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        ms = int(value.split("(")[1].split("+")[0].split("-")[0])
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime(
            "%d-%b-%Y"
        )
    except Exception:
        return ""


def date_to_sap(value: str) -> str:
    dt = datetime.strptime(value, "%Y-%m-%d")
    ms = int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)
    return f"/Date({ms}+0000)/"


def convert_date(value: Optional[str]) -> str:
    if not value:
        return ""
    m = re.search(r"\((\d+)", value)
    if not m:
        return value
    ts = int(m.group(1)) / 1000
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%d-%b-%Y")


# =====================================
# OData Data Fetchers
# =====================================


def get_job_requisitions():
    url = f"{BASE_URL}/JobRequisitionLocale?$select=jobReqId,jobTitle&$format=json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return []
        return r.json().get("d", {}).get("results", [])
    except Exception as e:
        print("JOB REQ FETCH EXCEPTION:", str(e))
        return []


def get_status_list():
    url = f"{BASE_URL}/JobApplicationStatusLabel?$select=appStatusId,appStatusSetItemId,statusLabel,locale&$format=json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return []
        return r.json().get("d", {}).get("results", [])
    except Exception as e:
        print("STATUS FETCH EXCEPTION:", str(e))
        return []


def get_status_map():
    # Pre-fill with loaded JSON data
    status_map = STATUS_MASTER.copy()

    # Dynamic fetch from OData as potential override or supplement
    statuses = get_status_list()
    for s in statuses:
        status_id = str(
            s.get("appStatusSetItemId") or s.get("appStatusId", "")
        ).strip()
        label = s.get("statusLabel", "")
        locale = s.get("locale", "")

        if not status_id or not label:
            continue

        if locale in ("en_US", "") or status_id not in status_map:
            status_map[status_id] = label

    return status_map


def get_applications(job_req_id: Optional[str] = None):
    url = f"{BASE_URL}/JobApplication?$select=applicationId,candidateId,firstName,lastName,jobReqId,appStatusSetItemId,startDate"

    if job_req_id and job_req_id != "ALL":
        url += f"&$filter=jobReqId eq '{job_req_id}'"

    url += "&$top=50&$format=json"

    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return []
        return r.json().get("d", {}).get("results", [])
    except Exception as e:
        print("APPLICATION FETCH EXCEPTION:", str(e))
        return []


def get_candidates():
    url = (
        BASE_URL
        + "/JobApplication?"
        + "$select=applicationId,candidateId,firstName,lastName,"
        + "contactEmail,status,startDate,jobReqId,appStatusSetItemId"
        + "&$orderby=lastModifiedDateTime desc"
        + "&$format=json"
    )

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            return []

        results = response.json().get("d", {}).get("results", [])
        hired_status_ids = {"15"}

        return [
            candidate
            for candidate in results
            if str(candidate.get("appStatusSetItemId", "")).strip()
            in hired_status_ids
        ]
    except Exception as e:
        print("CANDIDATES FETCH EXCEPTION:", str(e))
        return []


def get_job_title(jobreq: Optional[str]) -> str:
    if not jobreq:
        return "N/A"

    url = (
        BASE_URL
        + f"/JobRequisitionLocale?$filter=jobReqId eq '{jobreq}'"
        + "&$select=jobReqId,jobTitle,externalTitle,locale"
        + "&$format=json"
    )

    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return "Unknown"

        data = r.json()
        results = data.get("d", {}).get("results", [])

        if not results:
            return "Unknown"

        for row in results:
            if row.get("locale") == "en_US":
                return (
                    row.get("jobTitle") or row.get("externalTitle") or "Unknown"
                )

        return (
            results[0].get("jobTitle")
            or results[0].get("externalTitle")
            or "Unknown"
        )
    except Exception as e:
        print("JOB TITLE EXCEPTION:", str(e))
        return "Unknown"


# =====================================
# Update SAP Application Core Logic
# =====================================


def update_application(application_id: str, status: str, start_date: str):
    clean_id = str(application_id).replace("L", "")
    url = f"{BASE_URL}/JobApplication({clean_id}L)?$format=json"

    payload = {
        "appStatusSetItemId": str(status),
        "startDate": date_to_sap(start_date),
    }

    try:
        response = requests.post(
            url, headers=HEADERS_UPDATE, json=payload, timeout=10
        )

        try:
            res_data = response.json()
        except ValueError:
            res_data = {"raw": response.text}

        if response.status_code not in (200, 204):
            error_msg = (
                res_data.get("error", {})
                .get("message", {})
                .get("value", response.text)
                if isinstance(res_data, dict)
                else response.text
            )
            return JSONResponse(
                status_code=(
                    response.status_code if response.status_code >= 400 else 400
                ),
                content={"status": "error", "message": error_msg},
            )

        return JSONResponse(
            status_code=200, content={"status": "success", "data": res_data}
        )

    except Exception as e:
        return JSONResponse(
            status_code=500, content={"status": "error", "message": str(e)}
        )


# =====================================
# HTML Generators
# =====================================


def build_preview_html() -> str:
    rows = get_candidates()
    status_map = get_status_map()

    html = """
    <html>
    <head>
    <title>Newly Hired Candidates Preview</title>
    <style>
        body { font-family: Arial, Tahoma, sans-serif; font-size: 11px; background-color: #f4f6f9; margin: 15px; color: #000; }
        .sap-panel { border: 1px solid #7192b9; background-color: #ffffff; margin-bottom: 12px; }
        .sap-panel-header { background: linear-gradient(to bottom, #3b6c9e 0%, #1d4d7a 100%); color: #ffffff; font-weight: bold; padding: 6px 10px; font-size: 12px; }
        .sap-table-wrapper { border: 1px solid #b2c8d9; background: #fff; margin: 8px; }
        table.sap-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        table.sap-table th { background: #d8e4f0; border: 1px solid #a8c0d6; padding: 6px; text-align: left; font-weight: bold; color: #000; }
        table.sap-table td { border: 1px solid #d0dbe5; padding: 5px 6px; vertical-align: middle; }
        table.sap-table tr:nth-child(even) td { background-color: #f7f9fc; }
        .sap-footer { background: #d8e4f0; padding: 4px 8px; border-top: 1px solid #a8c0d6; font-weight: bold; }
    </style>
    </head>
    <body>

    <div class="sap-panel">
        <div class="sap-panel-header">
            Newly Hired Candidates - All Positions
        </div>
        
        <div class="sap-table-wrapper">
            <table class="sap-table">
                <thead>
                    <tr>
                        <th>Application ID</th>
                        <th>Candidate ID</th>
                        <th>Candidate</th>
                        <th>Email</th>
                        <th>Job Req ID</th>
                        <th>Job Title</th>
                        <th>Status</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>
    """

    if not rows:
        html += "<tr><td colspan='8' style='text-align:center; color:#cc0000; padding:10px;'>No hired candidate records found.</td></tr>"
    else:
        for row in rows:
            job_title = get_job_title(row.get("jobReqId"))
            status_id = str(row.get("appStatusSetItemId", "")).strip()
            status_label = status_map.get(status_id, "")
            status_display = (
                f"{status_id} - {status_label}" if status_label else status_id
            )

            first_name = row.get("firstName") or ""
            last_name = row.get("lastName") or ""

            html += f"""
                    <tr>
                        <td>{row.get('applicationId', '')}</td>
                        <td>{row.get('candidateId', '')}</td>
                        <td>{first_name} {last_name}</td>
                        <td>{row.get('contactEmail', '')}</td>
                        <td>{row.get('jobReqId', '')}</td>
                        <td>{job_title}</td>
                        <td>{status_display}</td>
                        <td>{convert_date(row.get('startDate'))}</td>
                    </tr>
            """

    html += f"""
                </tbody>
            </table>
            <div class="sap-footer">
                Total Records Listed: {len(rows)}
            </div>
        </div>
    </div>

    </body>
    </html>
    """

    return html


def build_clean_html() -> str:
    rows = get_candidates()
    status_map = get_status_map()

    html = "<h2>Newly Hired Candidates - All Positions</h2>\n"
    html += "<table border='1' cellspacing='0' cellpadding='6'>\n"
    html += "  <thead>\n"
    html += "    <tr>\n"
    html += "      <th>Application ID</th>\n"
    html += "      <th>Candidate ID</th>\n"
    html += "      <th>Candidate</th>\n"
    html += "      <th>Email</th>\n"
    html += "      <th>Job Req ID</th>\n"
    html += "      <th>Job Title</th>\n"
    html += "      <th>Status</th>\n"
    html += "      <th>Start Date</th>\n"
    html += "    </tr>\n"
    html += "  </thead>\n"
    html += "  <tbody>\n"

    if not rows:
        html += "    <tr><td colspan='8'>No hired candidate records found.</td></tr>\n"
    else:
        for row in rows:
            job_title = get_job_title(row.get("jobReqId"))
            status_id = str(row.get("appStatusSetItemId", "")).strip()
            status_label = status_map.get(status_id, "")
            status_display = (
                f"{status_id} - {status_label}" if status_label else status_id
            )

            first_name = row.get("firstName") or ""
            last_name = row.get("lastName") or ""

            html += "    <tr>\n"
            html += f"      <td>{row.get('applicationId', '')}</td>\n"
            html += f"      <td>{row.get('candidateId', '')}</td>\n"
            html += f"      <td>{first_name} {last_name}</td>\n"
            html += f"      <td>{row.get('contactEmail', '')}</td>\n"
            html += f"      <td>{row.get('jobReqId', '')}</td>\n"
            html += f"      <td>{job_title}</td>\n"
            html += f"      <td>{status_display}</td>\n"
            html += f"      <td>{convert_date(row.get('startDate'))}</td>\n"
            html += "    </tr>\n"

    html += "  </tbody>\n"
    html += "</table>\n"

    return html


# =====================================
# API Endpoints
# =====================================


@app.get("/", response_class=HTMLResponse)
def home(selected_job_req: Optional[str] = Query(None)):
    job_reqs = get_job_requisitions()
    applications = get_applications(selected_job_req)
    status_map = get_status_map()

    html = """
<html>
<head>
<title>SAP SuccessFactors Application Update</title>
<style>
body { font-family: Arial, Tahoma, Helvetica, sans-serif; font-size: 11px; background-color: #f4f6f9; margin: 10px; color: #000; }
.sap-panel { border: 1px solid #7192b9; background-color: #ffffff; margin-bottom: 12px; }
.sap-panel-header { background: linear-gradient(to bottom, #3b6c9e 0%, #1d4d7a 100%); background-color: #1d4d7a; color: #ffffff; font-weight: bold; padding: 4px 8px; font-size: 11px; display: flex; justify-content: space-between; align-items: center; }
.sap-panel-controls { font-size: 10px; cursor: pointer; }
.sap-panel-subheader { background-color: #e5edf5; border-bottom: 1px solid #b2c8d9; padding: 5px 8px; font-size: 11px; color: #000; }
.sap-panel-body { padding: 8px; }
.sap-tabs { display: flex; background-color: #dce6f1; border-bottom: 1px solid #7192b9; padding-left: 5px; padding-top: 3px; }
.sap-tab { padding: 3px 12px; border: 1px solid #7192b9; border-bottom: none; background: #eaf0f6; margin-right: 2px; cursor: pointer; font-size: 11px; border-top-left-radius: 3px; border-top-right-radius: 3px; }
.sap-tab.active { background: #ffffff; font-weight: bold; border-bottom: 1px solid #ffffff; margin-bottom: -1px; }
.layout-container { display: flex; gap: 12px; }
.left-col { flex: 3; }
.right-col { flex: 1.2; min-width: 280px; }
.sap-table-wrapper { border: 1px solid #b2c8d9; background: #fff; }
table.sap-table { width: 100%; border-collapse: collapse; font-size: 11px; }
table.sap-table th { background: #d8e4f0; border: 1px solid #a8c0d6; padding: 4px 6px; text-align: left; font-weight: normal; color: #000; }
table.sap-table td { border: 1px solid #d0dbe5; padding: 3px 6px; vertical-align: middle; background-color: #ffffff; }
table.sap-table tr:nth-child(even) td { background-color: #f7f9fc; }
table.sap-table td input[type="text"] { width: 100%; border: 1px solid #b0c4de; padding: 2px; font-size: 11px; box-sizing: border-box; }
.sap-table-footer { background: #d8e4f0; border: 1px solid #a8c0d6; border-top: none; padding: 3px 6px; display: flex; justify-content: space-between; align-items: center; }
.sap-pager-btn { display: inline-block; border: 1px solid #7192b9; background: #f0f4f8; padding: 1px 4px; font-size: 10px; cursor: pointer; margin-right: 1px; }
.sap-pager-btn:hover { background: #c3d5e5; }
select, input[type="text"], input[type="date"] { font-size: 11px; font-family: Arial, sans-serif; border: 1px solid #7f9db9; padding: 2px 4px; background-color: #fff; }
button.sap-btn { border: 1px solid #4a75a0; background: linear-gradient(to bottom, #ffffff 0%, #e0e9f2 100%); color: #000000; padding: 2px 10px; font-size: 11px; cursor: pointer; border-radius: 2px; box-shadow: inset 0 1px 0 #fff; }
button.sap-btn:hover { background: #d0deec; }
.form-group { margin-bottom: 8px; }
.form-group label { display: block; margin-bottom: 2px; color: #333; }
.form-group input, .form-group select { width: 100%; box-sizing: border-box; }
a.sap-link { color: #003399; text-decoration: underline; }
a.sap-link:hover { color: #000066; }
</style>
</head>
<body>
<div id="status_message" style="margin-top: 8px; font-weight: bold;font-size:14px;color: green;background-color:yellow"></div>

<div class="sap-panel">
    <div class="sap-panel-header">
        <span>Job Requisition Filter</span>
        <span class="sap-panel-controls">[ _ ] [ X ]</span>
    </div>
    <div class="sap-panel-body">
        <form method="get" action="/" style="margin: 0; display: flex; align-items: center; gap: 8px;">
            <label for="job_position"><strong>Filter Position:</strong></label>
            <select name="selected_job_req" id="job_position" style="width: 260px;">
                <option value="ALL">-- All Job Positions --</option>
"""

    for req in job_reqs:
        req_id = str(req.get("jobReqId", ""))
        title = req.get("jobTitle", "Untitled Requisition")
        is_selected = "selected" if selected_job_req == req_id else ""
        html += f'<option value="{req_id}" {is_selected}>{req_id} - {title}</option>\n'

    html += """
            </select>
            <button type="submit" class="sap-btn">Apply Filter</button>
        </form>
    </div>
</div>

<div class="layout-container">

    <div class="left-col">
        
        <div class="sap-panel">
            <div class="sap-panel-header">
                <span>Job Requisition Applications</span>
                <span class="sap-panel-controls">[ - ] [ X ]</span>
            </div>
            
            <div class="sap-panel-subheader">
                Select an application entry below to load details into the portal screen.
            </div>

            <div class="sap-tabs">
                <div class="sap-tab">Overview</div>
                <div class="sap-tab">Applicants</div>
                <div class="sap-tab active">Applications List</div>
                <div class="sap-tab">Reports</div>
            </div>

            <div class="sap-panel-body" style="padding: 6px;">
                <div class="sap-table-wrapper">
                    <table class="sap-table">
                        <thead>
                            <tr>
                                <th style="width: 30px; text-align: center;">Sel</th>
                                <th>Application ID</th>
                                <th>Candidate</th>
                                <th>Job Req</th>
                                <th>Status</th>
                                <th>Start Date</th>
                            </tr>
                        </thead>
                        <tbody>
"""

    if not applications:
        html += "<tr><td colspan='6' style='text-align:center; color:#cc0000;'>No records found for the selected Job Position.</td></tr>"
    else:
        for a in applications:
            app_id = a.get("applicationId", "")
            job_req = a.get("jobReqId", "")
            raw_status = (
                str(a.get("appStatusSetItemId", "")).strip()
                if a.get("appStatusSetItemId") is not None
                else ""
            )

            status_name = status_map.get(raw_status, "")
            status_display = (
                f"{raw_status} - {status_name}" if status_name else raw_status
            )

            raw_date = a.get("startDate", "")
            first_name = a.get("firstName", "") or ""
            last_name = a.get("lastName", "") or ""
            formatted_date = sap_to_date(raw_date) if status_display == "15 - Hired" else ""
            html += f"""
                            <tr>
                                <td style="text-align: center;">
                                    <input 
                                        type="radio" 
                                        name="application_select" 
                                        onclick="loadApplication('{app_id}', '{job_req}', '{raw_status}', '{raw_date}')"
                                    >
                                </td>
                                <td><a href="javascript:void(0)" class="sap-link">{app_id}</a></td>
                                <td><input type="text" value="{first_name} {last_name}" readonly></td>
                                <td>{job_req}</td>
                                <td><input type="text" value="{status_display}" readonly></td>
                                <td>{formatted_date}</td>
                            </tr>
"""

    html += """
                        </tbody>
                    </table>
                    
                    <div class="sap-table-footer">
                        <div>
                            <span class="sap-pager-btn">&#171;</span>
                            <span class="sap-pager-btn">&#8249;</span>
                            <span class="sap-pager-btn">&#8250;</span>
                            <span class="sap-pager-btn">&#187;</span>
                        </div>
                        <div>Line 1/12</div>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <div class="right-col">

        <div class="sap-panel">
            <div class="sap-panel-header">
                <span>Update Record</span>
                <span class="sap-panel-controls">[ - ] [ X ]</span>
            </div>
            
            <div class="sap-panel-body">
                <form id="updateForm" method="post" action="/update" onsubmit="handleFormSubmit(event)">
                    
                    <div class="form-group">
                        <label>Application ID</label>
                        <input id="form_app_id" name="application_id" readonly style="background:#eef3f8;">
                    </div>

                    <div class="form-group">
                        <label>Job Req ID</label>
                        <input id="form_job_req" name="jobReqId" readonly style="background:#eef3f8;">
                    </div>

                    <div class="form-group">
                        <label>New Status</label>
                        <select id="form_status" name="status">
                           <option value="14">Hirable</option>
                           <option value="15">Hired</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Start Date</label>
                        <input id="form_date" type="date" name="date">
                    </div>

                    <div style="margin-top: 12px; text-align: right;">
                        <button type="submit" class="sap-btn" style="font-weight: bold;">Update SAP</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="sap-panel">
            <div class="sap-panel-header">
                <span>Quick Navigation</span>
                <span class="sap-panel-controls">[ - ] [ X ]</span>
            </div>
            <div class="sap-panel-body">
                <ol style="margin: 0; padding-left: 18px;">
                    <li><a href="javascript:void(0)" class="sap-link">Requisition Overview</a></li>
                    <li><a href="javascript:void(0)" class="sap-link">Candidate Management</a></li>
                    <li><a href="javascript:void(0)" class="sap-link">Status Mapping Table</a></li>
                    <li><a href="javascript:void(0)" class="sap-link">System Diagnostics</a></li>
                </ol>
            </div>
        </div>

    </div>

</div>

<script>
function loadApplication(id, job, status, date) {
    document.getElementById("form_app_id").value = id;
    document.getElementById("form_job_req").value = job;
    
    if (status) {
        document.getElementById("form_status").value = status;
    }

    if (date && date !== "None" && date !== "null") {
        let match = date.match(/\\d+/);
        if (match) {
            let ms = parseInt(match[0]);
            let d = new Date(ms);
            let yyyy = d.getFullYear();
            let mm = String(d.getMonth() + 1).padStart(2, '0');
            let dd = String(d.getDate()).padStart(2, '0');
            document.getElementById("form_date").value = yyyy + "-" + mm + "-" + dd;
        }
    } else {
        document.getElementById("form_date").value = "";
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusMsg = document.getElementById("status_message");

    submitBtn.disabled = true;
    submitBtn.innerText = "Please wait...";
    statusMsg.innerText = "Processing update, please wait...";

    try {
        const response = await fetch(form.action, {
            method: form.method,
            body: formData
        });

        const rawText = await response.text();
        let data;

        try {
            data = JSON.parse(rawText);
        } catch {
            data = null;
        }

        if (response.ok) {
            alert("Application updated successfully!");
            window.location.reload();
        } else {
            const errorMessage = data?.message || rawText || "Update failed";
            alert("Failed to update : Invalid Application or Some Approval Pending ");
        }
    } catch (err) {
        alert("An error occurred during update: " + err.message);
    }
}
</script>
<h4>Source: SAP Successfactors - Sandbox</h4>
</body>
</html>
"""
    return html


@app.post("/update")
def update(
    application_id: str = Form(...),
    jobReqId: str = Form(...),
    status: str = Form(...),
    date: str = Form(...),
):
    return update_application(application_id, status, date)


@app.get("/preview", response_class=HTMLResponse)
def preview(api_key: Optional[str] = Header(None, alias="APIKey")):
    check_key(api_key or API_KEY)
    return HTMLResponse(build_preview_html())


@app.post("/send")
def send(api_key: Optional[str] = Header(None, alias="APIKey")):
    check_key(api_key or API_KEY)

    html_payload = build_clean_html()

    print("\n================ WEBHOOK PAYLOAD HTML ================")
    print(html_payload)
    print("======================================================\n")

    if not WEBHOOK_URL:
        return {
            "status": "Warning",
            "message": "WEBHOOK_URL is empty, payload printed to console.",
            "webhookStatus": None,
        }

    try:
        response = requests.post(
            WEBHOOK_URL, json={"prompt": html_payload}, timeout=10
        )
        return {
            "status": "Success" if response.status_code == 200 else "Failed",
            "webhookStatus": response.status_code,
            "webhookResponse": response.text,
        }
    except Exception as e:
        print("WEBHOOK EXCEPTION:", str(e))
        return {"status": "Error", "webhookStatus": None, "error": str(e)}
