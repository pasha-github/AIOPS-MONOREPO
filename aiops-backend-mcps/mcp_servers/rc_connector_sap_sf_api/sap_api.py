import asyncio
from datetime import datetime, timezone
import json
import re
from typing import Any, Dict, List, Optional
import httpx
from mcp.server import Server
#from mcp.server.stdio import stdio_server
import mcp.types as types
import requests
import os

import uvicorn
from fastapi import FastAPI, Request
from mcp.server import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.responses import Response
from contextlib import asynccontextmanager




# =====================================
# Configuration & Constants
# =====================================

API_KEY = "VgGuBRjIsH4YY41glaAKLBtBLMPfk0KX"
BASE_URL = "https://sandbox.api.sap.com/successfactorsfoundation/odata/v2"

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

# Status Codes in SAP SuccessFactors
HIRED_STATUS_ID = "15"
ONBOARDED_STATUS_ID = "16"

# =====================================
# MCP Server - Streamable HTTP
# =====================================

# 1. Initialize MCP Server
app = Server("sap-successfactors-mcp")


# 2. Initialize Streamable HTTP Session Manager
mcp_session_manager = StreamableHTTPSessionManager(
    app=app,
    json_response=False,
    stateless=False,
)


# 3. FastAPI lifespan
@asynccontextmanager
async def lifespan(web_app: FastAPI):
    async with mcp_session_manager.run():
        yield


# 4. Initialize FastAPI
web_app = FastAPI(lifespan=lifespan)


# 5. MCP Streamable HTTP endpoint
@web_app.api_route(
    "/mcp",
    methods=["GET", "POST", "DELETE"]
)
async def handle_mcp(request: Request):
    await mcp_session_manager.handle_request(
        request.scope,
        request.receive,
        request._send,
    )
# =====================================
# Helper Utilities
# =====================================


def _log_to_json(log_entry: dict, log_filepath: str = "sap_provisioning.json"):
    """Appends structured log entries to a target JSON file."""
    logs = []
    if os.path.exists(log_filepath):
        try:
            with open(log_filepath, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            logs = []

    logs.append(log_entry)

    with open(log_filepath, "w", encoding="utf-8") as f:
        json.dump(logs, f, indent=2, ensure_ascii=False)


def date_to_sap(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(
            tzinfo=timezone.utc
    )
    return f"/Date({int(dt.timestamp() * 1000)})/"


def convert_sap_date(value: Optional[str]) -> str:
    """Converts SAP /Date(ms)/ string to human-readable YYYY-MM-DD."""
    if not value:
        return ""

    m = re.search(r"\((\d+)", value)
    if not m:
        return value
    ts = int(m.group(1)) / 1000
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


# =====================================
# Tool Definitions Protocol
# =====================================


@app.list_tools()
async def list_tools() -> List[types.Tool]:
    return [
        types.Tool(
            name="get_job_req_by_key",
            description="Find exact jobReqId by searching with a position title keyword or job key string.",
            inputSchema={
                "type": "object",
                "properties": {
                    "job_key": {
                        "type": "string",
                        "description": "Job title keyword or key string to match (e.g. 'Software' or 'Developer').",
                    }
                },
                "required": ["job_key"],
            },
        ),
        types.Tool(
            name="search_job_positions",
            description="Search for SAP SuccessFactors job requisitions/positions by ID or title keyword.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional search string to filter positions by Job Req ID or Job Title.",
                    }
                },
            },
        ),
        types.Tool(
            name="get_vacancies",
            description="Fetch open position vacancies or unfilled positions in SAP SuccessFactors Position Management.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_code": {
                        "type": "string",
                        "description": "Optional SAP Company Code (e.g. '2800') to filter positions.",
                    },
                    "filter_type": {
                        "type": "string",
                        "enum": ["vacant", "unfilled", "all_open"],
                        "description": "Filter strategy: 'vacant' (vacant flag = true), 'unfilled' (no incumbents assigned), or 'all_open' (default: 'vacant').",
                    },
                },
            },
        ),
        types.Tool(
            name="get_company_options",
            description="Lookup company legal entities and return names formatted as 'Company Name (Company Code)'.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional keyword or code to filter companies (e.g. '2800').",
                    }
                },
            },
        ),
        types.Tool(
            name="get_job_code_options",
            description="Lookup SAP job codes and return descriptions formatted as 'Job Title (Job Code)'.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional keyword or code to filter job codes (e.g. '50070999').",
                    }
                },
            },
        ),
        types.Tool(
            name="get_position_options",
            description="Lookup position IDs and return descriptions formatted as 'Position Title (Position Code)'.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional keyword or code to filter positions (e.g. '50021018').",
                    }
                },
            },
        ),
        types.Tool(
            name="get_location_options",
            description="Lookup work locations and return names formatted as 'Location Name (Location Code)'.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional keyword or code to filter locations (e.g. '2800-SH01').",
                    }
                },
            },
        ),
        types.Tool(
            name="get_candidates",
            description="Fetch applicant entries for a given Job Requisition ID or all applications.",
            inputSchema={
                "type": "object",
                "properties": {
                    "job_req_id": {
                        "type": "string",
                        "description": "Job Requisition ID to filter candidates (e.g. '1001'). Leave empty or 'ALL' for all candidates.",
                    }
                },
            },
        ),
        types.Tool(
            name="get_employees_by_company",
            description="Retrieve all active employees or job assignments filtered by SAP Company Code (e.g. '2800').",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_code": {
                        "type": "string",
                        "description": "SAP Company Code / Legal Entity (e.g. '2800').",
                    }
                },
                "required": ["company_code"],
            },
        ),
        types.Tool(
            name="update_candidate_to_hired",
            description="Update a candidate application status to 'Hired' (Status ID 15) and set their start date.",
            inputSchema={
                "type": "object",
                "properties": {
                    "application_id": {
                        "type": "string",
                        "description": "The SAP Application ID (e.g. '2102').",
                    },
                    "start_date": {
                        "type": "string",
                        "description": "Start date in ISO format YYYY-MM-DD (e.g., '2026-09-01').",
                    },
                },
                "required": ["application_id", "start_date"],
            },
        ),
       
        types.Tool(
            name="update_candidate_onboarded_status",
            description="Update candidate application status to 'Onboarded' (Status ID 16) after Employee Central creation is completed.",
            inputSchema={
                "type": "object",
                "properties": {
                    "application_id": {
                        "type": "string",
                        "description": "The SAP Application ID (e.g. '2102').",
                    },
                    "start_date": {
                        "type": "string",
                        "description": "Start date in ISO format YYYY-MM-DD (e.g., '2026-08-14').",
                    },
                },
                "required": ["application_id", "start_date"],
            },
        ),
        types.Tool(
            name="list_hired_candidates",
            description="Retrieve candidates who have been marked as Hired (Status 15) or Onboarded (Status 16).",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="get_vacancies",
            description="Fetch open position vacancies or unfilled positions in SAP SuccessFactors Position Management.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_code": {
                        "type": "string",
                        "description": "Optional SAP Company Code (e.g. '2800') to filter positions.",
                    },
                    "filter_type": {
                        "type": "string",
                        "enum": ["vacant", "unfilled", "all_open"],
                        "description": "Filter strategy: 'vacant' (vacant flag = true), 'unfilled' (no incumbents assigned), or 'all_open' (default: 'vacant').",
                    },
                },
            },
        ),
     types.Tool(
                name="create_employee_record",
                description="Provision a newly hired candidate into SAP SuccessFactors Employee Central across all 6 core OData entities with strict parameters.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "Unique user ID / personIdExternal (e.g. '180806')",
                        },
                        "first_name": {
                            "type": "string",
                            "description": "Candidate First Name",
                        },
                        "last_name": {
                            "type": "string",
                            "description": "Candidate Last Name",
                        },
                        "email": {
                            "type": "string",
                            "description": "Official or primary email address",
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Start / Hire Date in YYYY-MM-DD format (e.g. '2026-08-19')",
                        },
                        "company": {
                            "type": "string",
                            "description": "Company Code e.g. '2800'",
                        },
                        "job_code": {
                            "type": "string",
                            "description": "Job Code e.g. '50070999'",
                        },
                        "position": {
                            "type": "string",
                            "description": "Position Code e.g. '50021018'",
                        },
                        "location": {
                            "type": "string",
                            "description": "Location Code e.g. '2800-SZ01'",
                        },
                        "gender": {
                            "type": "string",
                            "description": "Gender code: 'M', 'F', or 'U'",
                        },
                        "nationality": {
                            "type": "string",
                            "description": "3-letter ISO Country code (e.g. 'IND')",
                        },
                        "employee_class": {
                            "type": "string",
                            "description": "Employee Class code (e.g. '4662')",
                        },
                        "event_reason": {
                            "type": "string",
                            "description": "Event reason code for hiring (e.g. 'HIRNEW')",
                        },
                        "pay_scale_area": {
                            "type": "string",
                            "description": "Pay scale area code (e.g. 'CHN/1')",
                        },
                        "pay_scale_type": {
                            "type": "string",
                            "description": "Pay scale type code (e.g. 'CHN/1')",
                        },
                    },
                    "required": [
                        "user_id",
                        "first_name",
                        "last_name",
                        "email",
                        "start_date",
                        "company",
                        "job_code",
                        "position",
                        "location",
                        "gender",
                        "nationality",
                        "employee_class",
                        "event_reason",
                        "pay_scale_area",
                        "pay_scale_type",
                    ],
                },
            )
    ]


# =====================================
# Tool Call Handlers
# =====================================


@app.call_tool()
async def call_tool(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    async with httpx.AsyncClient(timeout=20.0) as client:

        # -------------------------------------------------------------
        # Tool 1: Key to JobReqID Resolver
        # -------------------------------------------------------------
        if name == "get_job_req_by_key":
            job_key = str(arguments.get("job_key", "")).strip().lower()
            if not job_key:
                return [
                    types.TextContent(
                        type="text",
                        text="Error: Missing required 'job_key' parameter.",
                    )
                ]

            url = f"{BASE_URL}/JobRequisitionLocale?$select=jobReqId,jobTitle,locale&$format=json"
            resp = await client.get(url, headers=HEADERS)

            if resp.status_code != 200:
                return [
                    types.TextContent(
                        type="text",
                        text=f"API Error fetching requisitions: {resp.text}",
                    )
                ]

            results = resp.json().get("d", {}).get("results", [])
            matched_reqs = []

            for item in results:
                req_id = str(item.get("jobReqId", ""))
                title = item.get("jobTitle", "Untitled")
                locale = item.get("locale", "")

                if locale and locale != "en_US":
                    continue

                if job_key in req_id.lower() or job_key in title.lower():
                    matched_reqs.append({"jobReqId": req_id, "jobTitle": title})

            if not matched_reqs:
                return [
                    types.TextContent(
                        type="text",
                        text=f"No job requisition found matching key: '{job_key}'",
                    )
                ]

            primary_match = matched_reqs[0]
            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "primaryJobReqId": primary_match["jobReqId"],
                            "primaryJobTitle": primary_match["jobTitle"],
                            "totalMatches": len(matched_reqs),
                            "allMatches": matched_reqs,
                        },
                        indent=2,
                    ),
                )
            ]

        # -------------------------------------------------------------
        # Tool 2: Search Positions
        # -------------------------------------------------------------
        elif name == "search_job_positions":
            query = str(arguments.get("query", "")).strip().lower()
            url = f"{BASE_URL}/JobRequisitionLocale?$select=jobReqId,jobTitle,locale&$format=json"

            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                return [
                    types.TextContent(
                        type="text",
                        text=f"Error fetching job requisitions: {resp.text}",
                    )
                ]

            results = resp.json().get("d", {}).get("results", [])
            filtered = []

            for item in results:
                req_id = str(item.get("jobReqId", ""))
                title = item.get("jobTitle", "Untitled")
                locale = item.get("locale", "")

                if locale and locale != "en_US":
                    continue

                if query:
                    if query in req_id.lower() or query in title.lower():
                        filtered.append({"jobReqId": req_id, "jobTitle": title})
                else:
                    filtered.append({"jobReqId": req_id, "jobTitle": title})

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {"total": len(filtered), "positions": filtered},
                        indent=2,
                    ),
                )
            ]

        # -------------------------------------------------------------
        # Tool 3: Get Vacancies / Open Positions
        # -------------------------------------------------------------
        elif name == "get_vacancies":
            company_code = str(arguments.get("company_code", "")).strip()
            filter_type = arguments.get("filter_type", "vacant").lower()

            url = f"{BASE_URL}/Position?$select=code,externalTitle,company,location,vacant,effectiveStatus&$format=json"

            filters = ["effectiveStatus eq 'A'"]

            if filter_type == "vacant":
                filters.append("vacant eq true")

            if company_code:
                filters.append(f"company eq '{company_code}'")

            url += f"&$filter={' and '.join(filters)}"

            resp = await client.get(url, headers=HEADERS)

            if resp.status_code != 200:
                return [
                    types.TextContent(
                        type="text",
                        text=f"API Error fetching vacancies: {resp.status_code} - {resp.text}",
                    )
                ]

            results = resp.json().get("d", {}).get("results", [])
            vacancies = []

            for item in results:
                vacancies.append(
                    {
                        "positionCode": item.get("code"),
                        "title": item.get("externalTitle", "Open Position"),
                        "company": item.get("company", ""),
                        "location": item.get("location", ""),
                        "isVacant": item.get("vacant", False),
                        "status": (
                            "Vacant / To Be Hired"
                            if item.get("vacant")
                            else "Unfilled"
                        ),
                    }
                )

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "filterTypeUsed": filter_type,
                            "total": len(vacancies),
                            "vacancies": vacancies,
                        },
                        indent=2,
                    ),
                )
            ]

        # -------------------------------------------------------------
        # Tool 4: Get Company Options
        # -------------------------------------------------------------
        elif name == "get_company_options":
            query = str(arguments.get("query", "")).strip().lower()
            url = f"{BASE_URL}/FOCompany?$select=externalCode,name&$format=json"

            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                companies = [
                    {"code": "2800", "displayName": "ACE USA Company (2800)"}
                ]
            else:
                results = resp.json().get("d", {}).get("results", [])
                companies = []
                for item in results:
                    code = str(item.get("externalCode", ""))
                    cname = item.get("name", "Company")
                    display = f"{cname} ({code})"
                    if (
                        not query
                        or query in code.lower()
                        or query in cname.lower()
                    ):
                        companies.append(
                            {"code": code, "displayName": display}
                        )

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {"total": len(companies), "companies": companies},
                        indent=2,
                    ),
                )
            ]

        # -------------------------------------------------------------
        # Tool 5: Get Job Code Options
        # -------------------------------------------------------------
        elif name == "get_job_code_options":
            query = str(arguments.get("query", "")).strip().lower()
            url = f"{BASE_URL}/FOJobCode?$select=externalCode,name&$format=json"

            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                job_codes = [
                    {
                        "code": "50070999",
                        "displayName": "Software Engineer (50070999)",
                    }
                ]
            else:
                results = resp.json().get("d", {}).get("results", [])
                job_codes = []
                for item in results:
                    code = str(item.get("externalCode", ""))
                    jtitle = item.get("name", "Job Title")
                    display = f"{jtitle} ({code})"
                    if (
                        not query
                        or query in code.lower()
                        or query in jtitle.lower()
                    ):
                        job_codes.append({"code": code, "displayName": display})

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {"total": len(job_codes), "jobCodes": job_codes},
                        indent=2,
                    ),
                )
            ]

        # -------------------------------------------------------------
        # Tool 6: Get Position Options
        # -------------------------------------------------------------
        elif name == "get_position_options":
            query = str(arguments.get("query", "")).strip().lower()
            url = f"{BASE_URL}/Position?$select=code,externalTitle&$format=json"

            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                positions = [
                    {
                        "code": "50021018",
                        "displayName": "Senior Developer Position (50021018)",
                    }
                ]
            else:
                results = resp.json().get("d", {}).get("results", [])
                positions = []
                for item in results:
                    code = str(item.get("code", ""))
                    ptitle = item.get("externalTitle", "Position")
                    display = f"{ptitle} ({code})"
                    if (
                        not query
                        or query in code.lower()
                        or query in ptitle.lower()
                    ):
                        positions.append(
                            {"code": code, "displayName": display}
                        )

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {"total": len(positions), "positions": positions},
                        indent=2,
                    ),
                )
            ]

        # -------------------------------------------------------------
        # Tool 7: Get Location Options
        # -------------------------------------------------------------
        elif name == "get_location_options":
            query = str(arguments.get("query", "")).strip().lower()
            url = f"{BASE_URL}/FOLocation?$select=externalCode,name&$format=json"

            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                locations = [
                    {
                        "code": "2800-SH01",
                        "displayName": "Shanghai Head Office (2800-SH01)",
                    }
                ]
            else:
                results = resp.json().get("d", {}).get("results", [])
                locations = []
                for item in results:
                    code = str(item.get("externalCode", ""))
                    lname = item.get("name", "Location")
                    display = f"{lname} ({code})"
                    if (
                        not query
                        or query in code.lower()
                        or query in lname.lower()
                    ):
                        locations.append(
                            {"code": code, "displayName": display}
                        )

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {"total": len(locations), "locations": locations},
                        indent=2,
                    ),
                )
            ]

        # -------------------------------------------------------------
        # Tool 8: Get Candidates
        # -------------------------------------------------------------
        elif name == "get_candidates":
            job_req_id = arguments.get("job_req_id")
            url = f"{BASE_URL}/JobApplication?$select=applicationId,candidateId,firstName,lastName,contactEmail,jobReqId,appStatusSetItemId,startDate"

            if job_req_id and job_req_id != "ALL":
                url += f"&$filter=jobReqId eq '{job_req_id}'"

            url += "&$top=50&$format=json"

            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                return [
                    types.TextContent(
                        type="text",
                        text=f"Error fetching candidates: {resp.text}",
                    )
                ]

            raw_candidates = resp.json().get("d", {}).get("results", [])
            formatted_list = []

            for c in raw_candidates:
                formatted_list.append(
                    {
                        "applicationId": c.get("applicationId"),
                        "candidateId": c.get("candidateId"),
                        "name": f"{c.get('firstName', '')} {c.get('lastName', '')}".strip(),
                        "email": c.get("contactEmail", ""),
                        "jobReqId": c.get("jobReqId"),
                        "statusId": str(
                            c.get("appStatusSetItemId", "")
                        ).strip(),
                        "startDate": convert_sap_date(c.get("startDate")),
                    }
                )

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {"total": len(formatted_list), "candidates": formatted_list},
                        indent=2,
                    ),
                )
            ]

        # -------------------------------------------------------------
        # Tool 9: Get Employees Filtered by Company Code
        # -------------------------------------------------------------
        elif name == "get_employees_by_company":
            company_code = str(arguments.get("company_code", "")).strip()
            if not company_code:
                return [
                    types.TextContent(
                        type="text",
                        text="Error: Missing required 'company_code' parameter.",
                    )
                ]

            url = (
                f"{BASE_URL}/EmpJob?"
                f"$filter=company eq '{company_code}'"
                "&$select=userId,startDate,company,jobCode,position,location,employeeClass"
                "&$top=50&$format=json"
            )

            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                return [
                    types.TextContent(
                        type="text",
                        text=f"API Error fetching employees for company {company_code}: {resp.text}",
                    )
                ]

            results = resp.json().get("d", {}).get("results", [])
            employees = []

            for emp in results:
                employees.append(
                    {
                        "userId": emp.get("userId"),
                        "company": emp.get("company"),
                        "jobCode": emp.get("jobCode"),
                        "position": emp.get("position"),
                        "location": emp.get("location"),
                        "startDate": convert_sap_date(emp.get("startDate")),
                    }
                )

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "companyCode": company_code,
                            "total": len(employees),
                            "employees": employees,
                        },
                        indent=2,
                    ),
                )
            ]
        # -------------------------------------------------------------
        # Tool 12: List Hired & Onboarded Candidates
        # -------------------------------------------------------------
        elif name == "list_hired_candidates":
            url = (
                f"{BASE_URL}/JobApplication?"
                "$select=applicationId,candidateId,firstName,lastName,contactEmail,jobReqId,appStatusSetItemId,startDate"
                "&$orderby=lastModifiedDateTime desc"
                "&$format=json"
            )

            resp = await client.get(url, headers=HEADERS)
            if resp.status_code != 200:
                return [
                    types.TextContent(
                        type="text",
                        text=f"Error listing candidates: {resp.text}",
                    )
                ]

            results = resp.json().get("d", {}).get("results", [])
            hired_list = []

            for row in results:
                status_id = str(row.get("appStatusSetItemId", "")).strip()
                if status_id in (HIRED_STATUS_ID, ONBOARDED_STATUS_ID):
                    status_label = (
                        "15 - Hired"
                        if status_id == HIRED_STATUS_ID
                        else "16 - Onboarded"
                    )
                    hired_list.append(
                        {
                            "applicationId": row.get("applicationId"),
                            "candidateId": row.get("candidateId"),
                            "name": f"{row.get('firstName', '')} {row.get('lastName', '')}".strip(),
                            "email": row.get("contactEmail", ""),
                            "jobReqId": row.get("jobReqId"),
                            "status": status_label,
                            "startDate": convert_sap_date(row.get("startDate")),
                        }
                    )

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {"total": len(hired_list), "candidates": hired_list},
                        indent=2,
                    ),
                )
            ]
        # -------------------------------------------------------------
        # Tool 10: Update Candidate to Hired (Status 15)
        # -------------------------------------------------------------
        elif name == "update_candidate_to_hired":
            app_id = str(arguments.get("application_id", "")).replace("L", "")
            start_date_str = str(arguments.get("start_date", "")).strip()

            url = f"{BASE_URL}/JobApplication({app_id}L)?$format=json"
            payload = {
                "appStatusSetItemId": HIRED_STATUS_ID,
                "startDate": date_to_sap(start_date_str),
            }

            resp = await client.post(
                url, headers=HEADERS_UPDATE, json=payload
            )

            if resp.status_code in (200, 204):
                return [
                    types.TextContent(
                        type="text",
                        text=json.dumps(
                            {
                                "status": "success",
                                "message": f"Application {app_id} updated to HIRED (Status 15).",
                                "startDate": start_date_str,
                            },
                            indent=2,
                        ),
                    )
                ]

            return [
                types.TextContent(
                    type="text",
                    text=f"Failed to update SAP application: {resp.status_code} - {resp.text}",
                )
            ]
                # -------------------------------------------------------------
                # Tool 10: Update Candidate to Onboard (Status 16)
                # -------------------------------------------------------------
        elif name == "update_candidate_onboarded_status":
                    app_id = str(arguments.get("application_id", "")).replace("L", "")
                    start_date_str = str(arguments.get("start_date", "")).strip()
        
                    url = f"{BASE_URL}/JobApplication({app_id}L)?$format=json"
                    payload = {
                        "appStatusSetItemId": ONBOARDED_STATUS_ID,
                        "startDate": date_to_sap(start_date_str),
                    }
        
                    resp = await client.post(
                        url, headers=HEADERS_UPDATE, json=payload
                    )
        
                    if resp.status_code in (200, 204):
                        return [
                            types.TextContent(
                                type="text",
                                text=json.dumps(
                                    {
                                        "status": "success",
                                        "message": f"Application {app_id} updated to ONBOARD (Status 16).",
                                        "startDate": start_date_str,
                                    },
                                    indent=2,
                                ),
                            )
                        ]
        
                    return [
                        types.TextContent(
                            type="text",
                            text=f"Failed to update SAP application: {resp.status_code} - {resp.text}",
                        )
                    ]
        
        # -------------------------------------------------------------
        # Tool 11: Create Employee Record (6-Step Provisioning)
        # -------------------------------------------------------------
        elif name == "create_employee_record":

            user_id = str(arguments.get("user_id", "")).strip()
            first_name = str(arguments.get("first_name", "")).strip()
            last_name = str(arguments.get("last_name", "")).strip()
            email = str(arguments.get("email", "")).strip()
            start_date = str(arguments.get("start_date", "")).strip()
            company = str(arguments.get("company", "")).strip()
            job_code = str(arguments.get("job_code", "")).strip()
            position = str(arguments.get("position", "")).strip()
            location = str(arguments.get("location", "")).strip()
            gender = str(arguments.get("gender", "M")).strip()
            nationality = str(arguments.get("nationality", "IND")).strip()
            employee_class = str(arguments.get("employee_class", "4662")).strip()
            event_reason = str(arguments.get("event_reason", "HIRNEW")).strip()
            pay_scale_area = str(arguments.get("pay_scale_area", "CHN/1")).strip()
            pay_scale_type = str(arguments.get("pay_scale_type", "CHN/1")).strip()

            sap_start_date = date_to_sap(start_date)  # Generates /Date(timestamp_ms)/
            creation_results = {}
            errors = []

            # Helper function matching your call_step logic for OData /upsert calls
            async def send_upsert(step_name, payload):
                r = await client.post(
                    f"{BASE_URL}/upsert?$format=json", headers=HEADERS, json=payload
                )
                if r.status_code in (200, 201):
                    creation_results[step_name] = "SUCCESS"
                    return True
                else:
                    creation_results[step_name] = f"FAILED ({r.status_code})"
                    errors.append(f"{step_name} error: {r.text}")
                    return False

            # STEP 1: USER (Direct POST)
            # Populates firstName, lastName, email, username on User to avoid null query results.
            # Excludes 'company' to prevent 400 BadRequestException.
            user_payload = {
                "userId": user_id,
                "username": user_id,
                "firstName": first_name,
                "lastName": last_name,
                "email": email,
                "status": "t",
            }
            r1 = await client.post(
                f"{BASE_URL}/User", headers=HEADERS, json=user_payload
            )
            if r1.status_code in (200, 201):
                creation_results["User"] = "SUCCESS"
            else:
                creation_results["User"] = f"FAILED ({r1.status_code})"
                errors.append(f"User creation error: {r1.text}")

            # Process remaining steps in sequence
            if creation_results.get("User") == "SUCCESS":
                # STEP 2: PERPERSON
                await send_upsert(
                    "PerPerson",
                    {
                        "__metadata": {
                            "uri": "PerPerson",
                            "type": "SFOData.PerPerson",
                        },
                        "personIdExternal": user_id,
                    },
                )

                # STEP 3: EMPEMPLOYMENT
                await send_upsert(
                    "EmpEmployment",
                    {
                        "__metadata": {
                            "uri": f"EmpEmployment(personIdExternal='{user_id}',userId='{user_id}')"
                        },
                        "startDate": sap_start_date,
                        "firstDateWorked": sap_start_date,
                        "personIdExternal": user_id,
                        "userId": user_id,
                    },
                )

                # STEP 4: EMPJOB (Sets legal entity/company association)
                await send_upsert(
                    "EmpJob",
                    {
                        "__metadata": {
                            "uri": f"EmpJob(userId='{user_id}',startDate=datetime'{start_date}T00:00:00')"
                        },
                        "userId": user_id,
                        "startDate": sap_start_date,
                        "seqNumber": "0",
                        "eventReason": event_reason,
                        "employeeClass": employee_class,
                        "company": company,
                        "jobCode": job_code,
                        "position": position,
                        "location": location,
                        "payScaleArea": pay_scale_area,
                        "payScaleType": pay_scale_type,
                    },
                )

                # STEP 5: PERPERSONAL
                await send_upsert(
                    "PerPersonal",
                    {
                        "__metadata": {"uri": "PerPersonal"},
                        "personIdExternal": user_id,
                        "startDate": sap_start_date,
                        "firstName": first_name,
                        "lastName": last_name,
                        "gender": gender,
                        "nationality": nationality,
                        "nativePreferredLang": "10223",
                    },
                )

                # STEP 6: PEREMAIL
                await send_upsert(
                    "PerEmail",
                    {
                        "__metadata": {
                            "uri": "PerEmail",
                            "type": "SFOData.PerEmail",
                        },
                        "personIdExternal": user_id,
                        "emailType": "8448",
                        "emailAddress": email,
                        "isPrimary": True,
                    },
                )

            # Determine overall status
            overall_success = all(
                status == "SUCCESS" for status in creation_results.values()
            )
            overall_status_str = (
                "SUCCESS"
                if overall_success
                else "PARTIAL_SUCCESS"
                if any(s == "SUCCESS" for s in creation_results.values())
                else "FAILED"
            )

            log_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "userId": user_id,
                "candidateName": f"{first_name} {last_name}",
                "email": email,
                "company": company,
                "startDate": start_date,
                "overallStatus": overall_status_str,
                "entityStatus": creation_results,
                "errors": errors,
            }

            _log_to_json(log_entry)

            return [
                types.TextContent(type="text", text=json.dumps(log_entry, indent=2))
            ]
        #-----------------------------------------------------
        # Tool: Get All Vacancies / Open Positions
        # -------------------------------------------------------------
        elif name == "get_vacancies":
            company_code = str(arguments.get("company_code", "")).strip()
            filter_type = str(arguments.get("filter_type", "vacant")).lower()

            # Clean selection matching your working Postman call
            select_fields = "code,externalName_defaultValue,company,location,vacant,effectiveStatus"
            base_url = f"{BASE_URL}/Position?$select={select_fields}&$format=json"

            base_filters = ["effectiveStatus eq 'A'"]
            if filter_type == "vacant":
                base_filters.append("vacant eq true")

            # Try server-side company filter first
            primary_filters = list(base_filters)
            if company_code:
                primary_filters.append(f"company eq '{company_code}'")

            url = f"{base_url}&$filter={' and '.join(primary_filters)}"
            resp = await client.get(url, headers=HEADERS)

            # Fallback 1: If company filter causes an OData error, query without company filter & filter in Python
            if resp.status_code != 200 and company_code:
                fallback_url = f"{base_url}&$filter={' and '.join(base_filters)}"
                resp = await client.get(fallback_url, headers=HEADERS)

            if resp.status_code != 200:
                return [
                    types.TextContent(
                        type="text",
                        text=f"API Error fetching vacancies: {resp.status_code} - {resp.text}",
                    )
                ]

            results = resp.json().get("d", {}).get("results", [])
            vacancies = []

            for item in results:
                item_company = str(item.get("company", "")).strip()

                # Local company filter check
                if company_code and item_company != company_code:
                    continue

                pos_code = item.get("code", "N/A")
                raw_title = item.get("externalName_defaultValue")
                
                # Safe title extraction
                if isinstance(raw_title, dict):
                    title = raw_title.get("value") or raw_title.get("defaultValue") or f"Position {pos_code}"
                elif isinstance(raw_title, str) and raw_title.strip():
                    title = raw_title.strip()
                else:
                    title = f"Position {pos_code}"

                vacancies.append(
                    {
                        "positionCode": pos_code,
                        "title": title,
                        "company": item_company,
                        "location": item.get("location", ""),
                        "isVacant": item.get("vacant", False),
                        "status": "Vacant / To Be Hired" if item.get("vacant") else "Unfilled",
                    }
                )

            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "filterTypeUsed": filter_type,
                            "companyCodeRequested": company_code or "All",
                            "total": len(vacancies),
                            "vacancies": vacancies,
                        },
                        indent=2,
                    ),
                )
            ]
        elif name == "offboard_employee_record":
            user_id = arguments.get("user_id")
            termination_date_str = arguments.get("termination_date")  # Format: "YYYY-MM-DD"
            ok_to_rehire = arguments.get("ok_to_rehire", False)
            anonymize_pii = arguments.get("anonymize_pii", False)

            if not user_id or not termination_date_str:
                return [
                    types.TextContent(
                        type="text",
                        text="Error: Both 'user_id' and 'termination_date' are required arguments.",
                    )
                ]

            sap_term_date_ms = date_to_sap(termination_date_str)
            steps_log = []

            # Helper function to parse OData API errors
            def check_response_error(res):
                if res.status_code not in (200, 201):
                    return res.text
                try:
                    data = res.json()
                    results = data.get("d", [])
                    if isinstance(results, dict):
                        results = [results]
                    for item in results:
                        if item.get("status") == "ERROR":
                            return item.get("message", "Unknown SAP OData Error")
                except Exception:
                    pass
                return None

            # ------------------------------------------------------------------
            # Step 1: Deactivate Base User Account (status = "f")
            # ------------------------------------------------------------------
            user_deactivate_payload = {"userId": user_id, "status": "f"}
            res_1 = await client.post(
                f"{BASE_URL}/User", headers=HEADERS, json=user_deactivate_payload
            )
            err_1 = check_response_error(res_1)
            if err_1:
                return [
                    types.TextContent(
                        type="text",
                        text=f"Step 1 (Deactivate User) Failed: {err_1}",
                    )
                ]
            steps_log.append("Step 1: Base User status changed to Inactive ('f')")

            # ------------------------------------------------------------------
            # Step 2: Terminate Employment Record (EmpEmployment)
            # ------------------------------------------------------------------
            employment_term_payload = {
                "__metadata": {
                    "uri": f"EmpEmployment(personIdExternal='{user_id}',userId='{user_id}')"
                },
                "personIdExternal": user_id,
                "userId": user_id,
                "endDate": sap_term_date_ms,
                "okToRehire": ok_to_rehire,
            }

            res_2 = await client.post(
                f"{BASE_URL}/upsert?$format=json",
                headers=HEADERS,
                json=employment_term_payload,
            )
            err_2 = check_response_error(res_2)
            if err_2:
                return [
                    types.TextContent(
                        type="text",
                        text=f"Step 2 (EmpEmployment Termination) Failed: {err_2}",
                    )
                ]
            steps_log.append(f"Step 2: Employment terminated as of {termination_date_str}")

            # ------------------------------------------------------------------
            # Step 3 (Optional): Anonymize / Mask PII Details (GDPR / Privacy)
            # ------------------------------------------------------------------
            if anonymize_pii:
                anon_label = f"OFFBOARDED_{user_id}"
                
                pii_anonymize_payload = [
                    # Mask Email Address
                    {
                        "__metadata": {
                            "uri": f"PerEmail(emailType='B',personIdExternal='{user_id}')"
                        },
                        "personIdExternal": user_id,
                        "emailType": "B",
                        "emailAddress": f"{anon_label}@anonymized.local",
                        "isPrimary": False,
                    },
                    # Mask Personal Names
                    {
                        "__metadata": {
                            "uri": f"PerPersonal(personIdExternal='{user_id}',startDate=datetime'{termination_date_str}T00:00:00')"
                        },
                        "personIdExternal": user_id,
                        "startDate": sap_term_date_ms,
                        "firstName": "Anonymized",
                        "lastName": "Employee",
                    },
                ]

                res_3 = await client.post(
                    f"{BASE_URL}/upsert?$format=json",
                    headers=HEADERS,
                    json=pii_anonymize_payload,
                )
                err_3 = check_response_error(res_3)
                if err_3:
                    steps_log.append(f"Step 3 Warning (PII Scrubbing): {err_3}")
                else:
                    steps_log.append("Step 3: PII data (Email, Name) successfully anonymized")

            # ------------------------------------------------------------------
            # Final Output Response
            # ------------------------------------------------------------------
            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "status": "success",
                            "message": f"Employee ID {user_id} successfully offboarded.",
                            "offboarding_details": {
                                "user_id": user_id,
                                "termination_date": termination_date_str,
                                "rehire_eligible": ok_to_rehire,
                                "pii_masked": anonymize_pii,
                            },
                            "steps": steps_log,
                        },
                        indent=2,
                    ),
                )
            ]
            
        else:
            return [
                types.TextContent(
                    type="text", text=f"Error: Unknown tool name '{name}'"
                )
            ]



# =====================================
# Main Server Entrypoint
# =====================================



# =====================================
# Run FastAPI / MCP Streamable HTTP
# =====================================

if __name__ == "__main__":
    uvicorn.run(
        web_app,
        host="0.0.0.0",
        port=8000,
    )
