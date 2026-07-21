import subprocess
import pymysql
import psycopg2

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from pydantic import BaseModel

# -------------------------------------------------------
# APP INIT
# -------------------------------------------------------
app = FastAPI(title="ETL Connector - Talend Jobs - v 1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------
# CONFIG
# -------------------------------------------------------
TALEND_SCRIPT_PATH = "/app/talend/ETL008/ETL008/ETL008_run.sh"

session_cache: Dict[str, Dict[str, Any]] = {}

# -------------------------------------------------------
# MODELS
# -------------------------------------------------------
class ETLCreds(BaseModel):
    sessionId: str

    mySQL_Server: str
    mySQL_Port: int = 3306
    mySQL_Database: str
    mySQL_Login: str
    mySQL_Password: str

    postgres_Server: str
    postgres_Port: int = 5432
    postgres_Database: str
    postgres_Login: str
    postgres_Password: str
    postgres_Schema: str = "public"


class SessionRequest(BaseModel):
    sessionId: str


# -------------------------------------------------------
# HELPERS
# -------------------------------------------------------
def get_session(session_id: str):
    session = session_cache.get(session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired session")
    return session


def get_mysql_conn(creds):
    return pymysql.connect(
        host=creds["mySQL_Server"],
        port=int(creds["mySQL_Port"]),
        user=creds["mySQL_Login"],
        password=creds["mySQL_Password"],
        database=creds["mySQL_Database"],
        connect_timeout=5
    )


def get_postgres_conn(creds):
    return psycopg2.connect(
        host=creds["postgres_Server"],
        port=int(creds["postgres_Port"]),
        user=creds["postgres_Login"],
        password=creds["postgres_Password"],
        database=creds["postgres_Database"],
        connect_timeout=5
    )


# -------------------------------------------------------
# DISCOVER
# -------------------------------------------------------
@app.get("/api/v1/etl/discover")
async def discover():
    return {
        "name": "MySQL ? PostgreSQL ETL",
        "flow": [
            "test-handshake",
            "inspect-source",
            "preflight-check",
            "execute-pipeline",
            "purge-session"
        ]
    }


# -------------------------------------------------------
# HANDSHAKE
# -------------------------------------------------------
@app.post("/api/v1/etl/test-handshake")
async def test_handshake(payload: ETLCreds):

    creds = payload.dict()
    session_id = creds["sessionId"]

    src_ok, dest_ok = False, False
    mysql_error, postgres_error = None, None

    try:
        conn = get_mysql_conn(creds)
        conn.close()
        src_ok = True
    except Exception as e:
        mysql_error = str(e)

    try:
        conn = get_postgres_conn(creds)
        conn.close()
        dest_ok = True
    except Exception as e:
        postgres_error = str(e)

    if src_ok and dest_ok:
        session_cache[session_id] = {
            "config": creds,
            "scanned_tables": []
        }

        return {
            "status": "CONNECTED",
            "sessionId": session_id
        }

    raise HTTPException(
        status_code=400,
        detail={
            "status": "FAILED",
            "mysql_error": mysql_error,
            "postgres_error": postgres_error
        }
    )


# -------------------------------------------------------
# INSPECT SOURCE
# -------------------------------------------------------
@app.post("/api/v1/etl/inspect-source")
async def inspect_source(req: SessionRequest):

    session = get_session(req.sessionId)

    conn = get_mysql_conn(session["config"])
    cursor = conn.cursor()

    cursor.execute("SHOW TABLE STATUS")
    tables = cursor.fetchall()

    summary = []
    names = []

    for row in tables:
        name = row[0]
        summary.append({
            "table_name": name,
            "rows": row[4] or 0,
            "size_kb": round((row[6] or 0) / 1024, 2)
        })
        names.append(name)

    session["scanned_tables"] = names
    conn.close()

    return {
        "sessionId": req.sessionId,
        "tables_found": len(summary),
        "next_step": "preflight-check"
    }


# -------------------------------------------------------
# PREFLIGHT CHECK
# -------------------------------------------------------
@app.post("/api/v1/etl/preflight-check")
async def preflight(req: SessionRequest):

    session = get_session(req.sessionId)
    schema = session["config"].get("postgres_Schema", "public")

    conn = get_postgres_conn(session["config"])
    cursor = conn.cursor()

    conflicts = []

    for table in session["scanned_tables"]:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = %s AND table_name = %s
            )
            """,
            (schema, table.lower())
        )

        if cursor.fetchone()[0]:
            conflicts.append(table)

    conn.close()

    return {
        "sessionId": req.sessionId,
        "conflicts": conflicts,
        "ready": True
    }


# -------------------------------------------------------
# EXECUTE PIPELINE
# -------------------------------------------------------
@app.post("/api/v1/etl/execute-pipeline")
async def execute(req: SessionRequest):

    session = get_session(req.sessionId)
    creds = session["config"]

    command = [
        "sh",
        TALEND_SCRIPT_PATH,

        "--context_param", f"mySQL_Server={creds['mySQL_Server']}",
        "--context_param", f"mySQL_Port={creds['mySQL_Port']}",
        "--context_param", f"mySQL_Database={creds['mySQL_Database']}",
        "--context_param", f"mySQL_Login={creds['mySQL_Login']}",
        "--context_param", f"mySQL_Password={creds['mySQL_Password']}",

        # ? FIX: match Talend context names EXACTLY
        "--context_param", f"postqreSQL_Server={creds['postgres_Server']}",
        "--context_param", f"postqreSQL_Port={creds['postgres_Port']}",
        "--context_param", f"postqreSQL_Database={creds['postgres_Database']}",
        "--context_param", f"postqreSQL_Login={creds['postgres_Login']}",
        "--context_param", f"postqreSQL_Password={creds['postgres_Password']}",
        "--context_param", f"postqreSQL_Schema={creds.get('postgres_Schema', 'public')}"
    ]

    # ? Debug (very important)
    print("Executing command:", " ".join(command))

    # ? FIX: use shell=True to match MCP behavior
    process = subprocess.Popen(
        " ".join(command),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=True
    )

    logs = []
    for line in process.stdout:
        logs.append(line)

    code = process.wait()

    return {
        "sessionId": req.sessionId,
        "status": "SUCCESS" if code == 0 else "FAILED",
        "exit_code": code,
        "log_tail": logs[-50:]
    }

# -------------------------------------------------------
# AUTO MIGRATE (MCP STYLE ??)
# -------------------------------------------------------
@app.post("/api/v1/etl/auto-migrate")
async def auto_migrate(req: SessionRequest):

    session = get_session(req.sessionId)

    # Step 1: Inspect
    await inspect_source(req)

    # Step 2: Preflight
    result = await preflight(req)

    if result["conflicts"]:
        return {
            "status": "STOPPED",
            "reason": "Conflicts detected",
            "conflicts": result["conflicts"]
        }

    # Step 3: Execute
    execution = await execute(req)

    return {
        "status": "COMPLETED",
        "execution": execution
    }


# -------------------------------------------------------
# PURGE SESSION
# -------------------------------------------------------
@app.post("/api/v1/etl/purge-session")
async def purge(req: SessionRequest):

    if req.sessionId in session_cache:
        del session_cache[req.sessionId]

    return {"status": "PURGED"}


# -------------------------------------------------------
# MAIN
# -------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
