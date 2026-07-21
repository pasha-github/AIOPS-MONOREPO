from fastapi import FastAPI
from pydantic import BaseModel
import requests

app = FastAPI(title="ETL Nifi")

NIFI_URL = "https://119.63.131.233:8443"
USERNAME = "6ab125c0-b0a0-47bf-ab3e-94b1431a774a"
PASSWORD = "n5PZx3X4ceQeZDxhhB8QI5emPR8s3XpP"

requests.packages.urllib3.disable_warnings()


# =====================================================
# AUTH
# =====================================================
def get_token():
    res = requests.post(
        f"{NIFI_URL}/nifi-api/access/token",
        data={"username": USERNAME, "password": PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        verify=False
    )

    if res.status_code not in [200, 201]:
        raise Exception(f"AUTH FAILED: {res.status_code} {res.text}")

    return res.text.strip()


# =====================================================
# HEADERS
# =====================================================
def headers():
    return {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }


# =====================================================
# REQUEST MODELS
# =====================================================
class ProcessorRequest(BaseModel):
    processor_id: str


class JobActionRequest(BaseModel):
    processor_id: str
    state: str   # RUNNING / STOPPED


class JobKnowledgeRequest(BaseModel):
    processor_id: str


class UpdateJobPropertiesRequest(BaseModel):
    processor_id: str
    properties: dict


class QueueStatusRequest(BaseModel):
    connection_id: str

# =====================================================
# CORE: GET PROCESSOR
# =====================================================
def get_processor(pid):
    res = requests.get(
        f"{NIFI_URL}/nifi-api/processors/{pid}",
        headers=headers(),
        verify=False
    )

    if res.status_code != 200:
        raise Exception(res.text)

    return res.json()


# =====================================================
# CORE: CHANGE STATE
# =====================================================
def change_state(pid, state):
    proc = get_processor(pid)

    rev = proc["revision"]
    comp = proc["component"]

    payload = {
        "revision": {
            "clientId": rev["clientId"],
            "version": rev["version"]
        },
        "state": state
    }

    res = requests.put(
        f"{NIFI_URL}/nifi-api/processors/{pid}/run-status",
        json=payload,
        headers=headers(),
        verify=False
    )

    if res.status_code not in [200, 201]:
        raise Exception(f"{state} FAILED: {res.status_code} {res.text}")

    updated = get_processor(pid)

    return {
        "process_id": pid,
        "job_name": updated["component"]["name"],
        "status": updated["component"]["state"]
    }


# =====================================================
# LIST PROCESSORS
# =====================================================
@app.get("/listJob")
def list_processors():
    res = requests.get(
        f"{NIFI_URL}/nifi-api/flow/process-groups/root",
        headers=headers(),
        verify=False
    )

    data = res.json()
    items = data.get("processGroupFlow", {}).get("flow", {}).get("processors", [])

    return [
        {
            "process_id": p["component"]["id"],
            "job_name": p["component"]["name"],
            "status": p["component"]["state"]
        }
        for p in items
    ]


# =====================================================
# LIST PROCESSORS
# =====================================================
@app.get("/showJob")
def list_processors():
    res = requests.get(
        f"{NIFI_URL}/nifi-api/flow/process-groups/root",
        headers=headers(),
        verify=False
    )

    data = res.json()
    items = data.get("processGroupFlow", {}).get("flow", {}).get("processors", [])

    return [
        {
            "process_id": p["component"]["id"],
            "job_name": p["component"]["name"],
            "status": p["component"]["state"]
        }
        for p in items
    ]


# =====================================================
# START ONLY
# =====================================================
@app.post("/job/jobStart")
def start_job(req: ProcessorRequest):
    return change_state(req.processor_id, "RUNNING")


# =====================================================
# STOP ONLY
# =====================================================
@app.post("/job/jobStop")
def stop_job(req: ProcessorRequest):
    return change_state(req.processor_id, "STOPPED")


# =====================================================
# JOB HEALTH
# =====================================================
@app.get("/job/jobHealth")
def job_health():

    res = requests.get(
        f"{NIFI_URL}/nifi-api/flow/process-groups/root",
        headers=headers(),
        verify=False
    )

    data = res.json()
    items = data.get("processGroupFlow", {}).get("flow", {}).get("processors", [])

    running = []
    stopped = []

    for p in items:
        comp = p["component"]

        info = {
            "process_id": comp["id"],
            "job_name": comp["name"],
            "status": comp["state"]
        }

        if comp["state"] == "RUNNING":
            running.append(info)
        else:
            stopped.append(info)

    # logs
    log_res = requests.get(
        f"{NIFI_URL}/nifi-api/flow/bulletin-board",
        headers=headers(),
        verify=False
    )

    bullets = log_res.json().get("bulletinBoard", {}).get("bulletins", [])

    errors = [
        {
            "level": b.get("bulletin", {}).get("level"),
            "message": b.get("bulletin", {}).get("message"),
            "timestamp": b.get("bulletin", {}).get("timestamp")
        }
        for b in bullets
        if b.get("bulletin", {}).get("level") in ["ERROR", "WARN"]
    ]

    return {
        "summary": {
            "running_jobs": len(running),
            "stopped_jobs": len(stopped),
            "error_count": len(errors),
            "status": "OK" if len(errors) == 0 else "ISSUES_FOUND"
        },
        "running": running,
        "stopped": stopped,
        "errors": errors if errors else "NO ERRORS - ALL GOOD"
    }


@app.get("/job/getJobProperties")
def get_job_properties(processor_id: str):

    data = get_processor(processor_id)

    return {
        "processorId": processor_id,
        "processorName": data["component"]["name"],
        "processorType": data["component"]["type"],
        "status": data["component"]["state"],
        "validationStatus": data["component"]["validationStatus"],
        "properties": data["component"]["config"]["properties"]
    }


@app.get("/job/getJobKnowledge")
def get_job_knowledge(processor_id: str):

    data = get_processor(processor_id)

    comp = data["component"]
    props = comp["config"]["properties"]
    desc = comp["config"]["descriptors"]

    return {
        "processorName": comp["name"],
        "processorType": comp["type"].split(".")[-1],
        "status": comp["state"],

        "database": {
            "type": props.get("db-type"),
            "connectionPool": desc["put-db-record-dcbp-service"]["allowableValues"][0]["allowableValue"]["displayName"],
            "schema": props.get("put-db-record-schema-name"),
            "table": props.get("put-db-record-table-name")
        },

        "statement": {
            "type": props.get("put-db-record-statement-type"),
            "supportedValues": [
                x["allowableValue"]["value"]
                for x in desc["put-db-record-statement-type"]["allowableValues"]
            ]
        },

        "recordReader": desc["put-db-record-record-reader"]["allowableValues"][0]["allowableValue"]["displayName"],

        "updateKeys": props.get("put-db-record-update-keys"),

        "validationStatus": comp["validationStatus"],

        "recommendedActions": [
            {
                "condition": "Need to insert or update existing rows",
                "change": {
                    "property": "Statement Type",
                    "apiProperty": "put-db-record-statement-type",
                    "currentValue": props.get("put-db-record-statement-type"),
                    "recommendedValue": "UPSERT"
                }
            }
        ]
    }


@app.put("/job/updateJobProperties")
def update_job_properties(req: UpdateJobPropertiesRequest):

    processor = get_processor(req.processor_id)

    payload = {
        "revision": processor["revision"],
        "component": processor["component"]
    }

    # Replace with the full properties object received
    payload["component"]["config"]["properties"] = req.properties

    res = requests.put(
        f"{NIFI_URL}/nifi-api/processors/{req.processor_id}",
        headers=headers(),
        json=payload,
        verify=False
    )

    if res.status_code not in [200, 201]:
        return {
            "status": "FAILED",
            "error": res.text
        }

    return {
        "status": "SUCCESS"
    }


@app.get("/job/diagnoseJob")
def diagnose_job(processor_id: str):

    data = get_processor(processor_id)

    comp = data["component"]
    props = comp["config"]["properties"]

    issues = []
    recommendations = []

    if comp["state"] != "RUNNING":
        issues.append("Processor is not running")
        recommendations.append("Start the processor")

    if props.get("put-db-record-statement-type") == "INSERT":
        issues.append("INSERT may fail on duplicate primary keys")
        recommendations.append(
            "Use UPSERT when records may already exist."
        )

    if comp["validationStatus"] != "VALID":
        issues.append("Processor configuration is invalid")

    return {
        "processor": comp["name"],
        "status": comp["state"],
        "validation": comp["validationStatus"],
        "issues": issues,
        "recommendations": recommendations
    }

@app.get("/job/getQueueStatus")
def get_queue_status(connection_id: str):

    res = requests.get(
        f"{NIFI_URL}/nifi-api/flow/connections/{connection_id}/status",
        headers=headers(),
        verify=False
    )

    if res.status_code != 200:
        raise Exception(res.text)

    status = res.json()["connectionStatus"]["aggregateSnapshot"]

    return {
        "connectionId": connection_id,
        "source": status["sourceName"],
        "destination": status["destinationName"],
        "queuedCount": status["flowFilesQueued"],
        "queuedSize": status["queued"],
        "bytesQueued": status["bytesQueued"],
        "input": status["input"],
        "output": status["output"],
        "backPressureObjectThreshold": status.get("objectThreshold"),
        "backPressureDataSizeThreshold": status.get("bytesThreshold")
    }


@app.get("/job/getJobErrors")
def get_job_errors(processor_id: str):

    res = requests.get(
        f"{NIFI_URL}/nifi-api/flow/bulletin-board",
        headers=headers(),
        verify=False
    )

    if res.status_code != 200:
        return {
            "status": "FAILED",
            "message": "Unable to retrieve NiFi bulletins",
            "details": res.text
        }

    bulletins = res.json().get("bulletinBoard", {}).get("bulletins", [])

    errors = []

    for item in bulletins:

        bulletin = item.get("bulletin", {})

        if bulletin.get("sourceId") != processor_id:
            continue

        if bulletin.get("level") not in ["ERROR", "WARN"]:
            continue

        message = bulletin.get("message", "")

        error_type = "Unknown"

        if "duplicate key" in message.lower():
            error_type = "Primary Key Violation"

        elif "unique constraint" in message.lower():
            error_type = "Unique Constraint Violation"

        elif "connection refused" in message.lower():
            error_type = "Database Connection Error"

        elif "timeout" in message.lower():
            error_type = "Database Timeout"

        errors.append({
            "timestamp": bulletin.get("timestamp"),
            "level": bulletin.get("level"),
            "errorType": error_type,
            "message": message
        })

    return {
        "processorId": processor_id,
        "errorCount": len(errors),
        "errors": errors
    }

# =====================================================
# RUN SERVER
# =====================================================
if __name__ == "__main__":
    import uvicorn
    print("🚀 NiFi FastAPI Control Server Running")
    uvicorn.run(app, host="0.0.0.0", port=8000)
