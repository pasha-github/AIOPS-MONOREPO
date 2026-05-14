import time, requests
from fastapi import FastAPI
from mule_session import MuleSession 

app = FastAPI()

BASE = "https://anypoint.mulesoft.com"

STATUS_MAP = {
    "RUNNING": "RUNNING", "STARTED": "RUNNING", "APPLIED": "RUNNING", "DEPLOYED": "RUNNING",
    "STOPPED": "STOPPED", "UNDEPLOYED": "STOPPED", "FAILED": "STOPPED", "NOT_RUNNING": "STOPPED",
    "DISCONNECTED" : "STOPPED", "SERVER_DOWN" : "STOPPED", "UNKNOWN" : "STOPPED",
    "DEPLOYING": "DEPLOYING", "STARTING": "DEPLOYING", "STOPPING": "DEPLOYING"
}

# 1. Inga unga credentials-a hardcode pannunga
# Session object-a function-ku veliya create pannunga
session = MuleSession(
    client_id="1eef07e7574d4b40b48acefe91cfab87",
    client_secret="054d7A9189A64b20bCD6bC41927C488B"
)

def get_platform_details(env_name="Sandbox"):
    """Token, Org, and Env ID-a eduthu tharum"""
    token = session.get_token()
    h = {"Authorization": f"Bearer {token}"}
    
    me = requests.get(f"{BASE}/accounts/api/me", headers=h).json()
    org = me["user"]["organization"]["id"]

    envs = requests.get(f"{BASE}/accounts/api/organizations/{org}/environments", headers=h).json()["data"]
    
    # Specified environment-a kandu pidippom
    env = next(e for e in envs if e["name"].lower() == env_name.lower())
    return token, org, env["id"]

# -------------------------------
# Endpoints
# -------------------------------

@app.get("/Connector/mule/cloudhub")
def cloudhub():
    # 2. Inga dhaan logic-a fix pandrom
    token, org, env_id = get_platform_details("Sandbox") # Unga env name inga kudunga
    
    headers = {
        "Authorization": f"Bearer {token}",
        "X-ANYPNT-ENV-ID": env_id
    }
    
    r = requests.get(f"{BASE}/cloudhub/api/applications", headers=headers)
    
    apps = []
    if r.status_code == 200:
        for a in r.json():
            raw_status = (a.get("application") or {}).get("status") or a.get("status", "")
            apps.append({
                "name": a.get("domain"),
                "target_type": "CLOUDHUB",
                "status": STATUS_MAP.get(raw_status.upper(), raw_status.upper())
            })
    return apps

@app.get("/Connector/mule/cloudhub2")
def cloudhub2():
    token, org, env_id = get_platform_details("Sandbox")
    
    headers_crh = {
        "Authorization": f"Bearer {token}",
        "X-ANYPNT-ENV-ID": env_id
    }
    
    url = f"{BASE}/amc/application-manager/api/v2/organizations/{org}/environments/{env_id}/deployments"
    r = requests.get(url, headers=headers_crh)
    
    apps = []
    if r.status_code == 200:
        for a in r.json().get("items", []):
            raw_status = (a.get("application") or {}).get("status") or a.get("status", "")
            apps.append({
                "name": a.get("name"),
                "target_type": "CLOUDHUB2_and_RTF",
                "status": STATUS_MAP.get(raw_status.upper(), raw_status.upper())
            })
    return apps

@app.get("/Connector/mule/hybrid")
def hybrid():
    token, org, env_id = get_platform_details("Sandbox")
    
    base_headers = {
        "Authorization": f"Bearer {token}",
        "X-ANYPNT-ORG-ID": org,
        "X-ANYPNT-ENV-ID": env_id
    }

    r = requests.get(f"{BASE}/hybrid/api/v1/applications", headers=base_headers)
    
    if r.status_code != 200:
        return []

    apps = []
    deployments = r.json().get("data", [])
    for item in deployments:
        app_name = item.get("name")
        app_status = (item.get("lastReportedStatus") or "").upper()
        server_status = (item.get("target", {}).get("status") or "").upper()

        final_status = "SERVER_DOWN" if server_status == "DISCONNECTED" else (app_status or "UNKNOWN")

        apps.append({
            "name": app_name,
            "target_type": "HYBRID",
            "status": STATUS_MAP.get(final_status.upper(), final_status.upper())
        })
    return apps
@app.get("/Connector/mule/cloudhub2_rtf")
def cloudhub2_rtf():
    # 1. Dynamic-a Token, Org, and Env ID get panrom
    token, org, env_id = get_platform_details("Sandbox") # Unga env name-a inga kudunga
    
    apps = []
    # 2. CloudHub 2.0 / RTF-ku idhu dhaan correct-ana headers
    headers_crh = {
        "Authorization": f"Bearer {token}",
        "X-ANYPNT-ENV-ID": env_id,
        "X-ANYPNT-ORG-ID": org
    }
    
    # 3. CloudHub 2.0 Deployment API URL
    url = f"{BASE}/amc/application-manager/api/v2/organizations/{org}/environments/{env_id}/deployments"
    
    try:
        r = requests.get(url, headers=headers_crh)
        
        if r.status_code == 200:
            # CH2 API 'items' nu oru list-a tharum
            items = r.json().get("items", [])
            
            for a in items:
                # Status-a correct-a extract panrom
                application_obj = a.get("application") or {}
                raw_status = application_obj.get("status") or a.get("status", "UNKNOWN")
                
                apps.append({
                    "name": a.get("name"),
                    "target_type": "CLOUDHUB2_and_RTF",
                    "status": STATUS_MAP.get(raw_status.upper(), raw_status.upper())
                })
            return apps
        else:
            return {"error": f"API failed with status {r.status_code}", "details": r.text}
            
    except Exception as e:
        return {"error": str(e)}