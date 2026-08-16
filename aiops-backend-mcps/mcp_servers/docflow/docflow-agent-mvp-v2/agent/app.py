"""DOCFlow agent web app.

- Serves a simple chat UI at /
- POST /api/chat : user asks for a document by ID → cache-first, else the
  agent does a live targeted pull from DOCFlow AI and answers in-session
- GET /files/{name} : serves downloaded attachments
- Background scheduler runs the periodic delta sync
"""
import asyncio
import contextlib
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import openai
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel

import db
from agent_run import _LLMBackendError, run_doc_query, run_sync_once

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s")
log = logging.getLogger("docflow.app")

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_MINUTES", "60"))
RUN_ON_STARTUP = os.environ.get("RUN_ON_STARTUP", "true").lower() == "true"
CACHE_TTL_MIN = int(os.environ.get("CACHE_TTL_MINUTES", "30"))
DOWNLOADS_DIR = Path(os.environ.get("DOWNLOADS_DIR", "/downloads"))

DOC_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_\-./]{2,}")


def _api_limit_error(exc: BaseException) -> str | None:
    """Return the usage-limit message if this failure is an OpenRouter/OpenAI
    quota, rate-limit, or insufficient-credits error (possibly wrapped in an
    ExceptionGroup). On OpenRouter's free tier this is the expected failure
    mode once the per-minute/per-day free request cap is hit."""
    if isinstance(exc, BaseExceptionGroup):
        for sub in exc.exceptions:
            if (msg := _api_limit_error(sub)) is not None:
                return msg
        return None
    if isinstance(exc, openai.RateLimitError):
        return str(exc)
    if isinstance(exc, openai.APIStatusError) and exc.status_code in (402, 429):
        return str(exc)
    if isinstance(exc, openai.BadRequestError) and any(
            kw in str(exc).lower() for kw in ("limit", "quota", "credit")):
        return str(exc)
    if isinstance(exc, _LLMBackendError):
        # Covers OpenRouter returning HTTP 200 with an embedded error instead
        # of choices — common on free-tier upstreams when they're rate
        # limited or temporarily out of capacity.
        return str(exc)
    return None


async def _sync_job() -> None:
    log.info("=== scheduled delta sync starting ===")
    try:
        summary = await run_sync_once()
        log.info("=== sync done: %s ===", summary)
    except Exception as e:
        if (msg := _api_limit_error(e)) is not None:
            log.error("sync skipped — OpenRouter API limit/backend error: %s", msg)
        else:
            log.exception("sync failed")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(_sync_job, "interval", minutes=POLL_INTERVAL,
                      coalesce=True, max_instances=1)
    scheduler.start()
    if RUN_ON_STARTUP:
        asyncio.get_event_loop().call_later(5, lambda: asyncio.create_task(_sync_job()))
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="DOCFlow Document Assistant", lifespan=lifespan)


class ChatIn(BaseModel):
    message: str
    force_refresh: bool = False


def _extract_doc_id(message: str) -> str | None:
    """Pick the most doc-number-looking token from the message."""
    tokens = DOC_ID_RE.findall(message)
    if not tokens:
        return None
    # Prefer tokens containing digits and separators (DWG-STR-1043 style)
    scored = sorted(
        tokens,
        key=lambda t: (any(ch.isdigit() for ch in t), "-" in t or "_" in t or "/" in t, len(t)),
        reverse=True,
    )
    best = scored[0]
    return best if any(ch.isdigit() for ch in best) else None


def _doc_payload(doc: dict, attachments: list[dict], source: str, as_of) -> dict:
    return {
        "found": True,
        "source": source,                     # "cache" | "live"
        "as_of": as_of.isoformat() if as_of else None,
        "doc_no": doc.get("doc_no"),
        "title": doc.get("title"),
        "revision": doc.get("revision"),
        "status": doc.get("status"),
        "comments": doc.get("comments") if isinstance(doc.get("comments"), list)
                    else ([doc["comment"]] if doc.get("comment") else []),
        "attachments": [
            {"filename": a["filename"], "url": f"/files/{a['filename']}"}
            for a in attachments
        ],
    }


@app.post("/api/chat")
async def chat(body: ChatIn):
    doc_id = _extract_doc_id(body.message)
    if not doc_id:
        return {"found": False,
                "reply": "Please give me a document ID (e.g. DWG-STR-1043) and "
                         "I'll pull its latest status, comments, and attachments."}

    # 1) cache-first: recent ledger entry?
    if not body.force_refresh:
        cached = db.get_latest_doc_event(doc_id)
        if cached:
            age = datetime.now(timezone.utc) - cached["captured_at"]
            if age <= timedelta(minutes=CACHE_TTL_MIN):
                atts = db.get_attachments(doc_id)
                return _doc_payload(dict(cached), atts, "cache", cached["captured_at"])

    # 2) live targeted pull by the agent (may take a minute)
    try:
        payload = await run_doc_query(doc_id)
    except Exception as e:
        if (msg := _api_limit_error(e)) is not None:
            log.error("live query skipped — OpenRouter API limit/backend error: %s", msg)
            return JSONResponse(status_code=503, content={
                "found": False,
                "reply": "The assistant's AI quota is exhausted right now, so I "
                         "can't do a live lookup. Cached results still work — "
                         "or try again after the quota resets.",
            })
        log.exception("live query failed")
        return JSONResponse(status_code=502, content={
            "found": False,
            "reply": f"I couldn't reach DOCFlow right now ({type(e).__name__}). "
                     "Try again in a moment.",
        })

    docs = payload.get("documents", [])
    if not docs:
        return {"found": False,
                "reply": f"I searched DOCFlow but couldn't find a document "
                         f"matching \"{doc_id}\". {payload.get('notes', '')}".strip()}

    doc = docs[0]
    atts = [{"filename": f} for f in doc.get("attachments", [])]
    return _doc_payload(doc, atts, "live", datetime.now(timezone.utc))


@app.get("/api/history/{doc_no}")
async def history(doc_no: str):
    rows = db.get_doc_history(doc_no)
    return {"doc_no": doc_no, "events": [
        {"status": r["status"], "revision": r["revision"],
         "comment": r["comment"], "captured_at": r["captured_at"].isoformat()}
        for r in rows
    ]}


@app.get("/files/{filename}")
async def get_file(filename: str):
    safe = Path(filename).name  # strip any path components
    path = (DOWNLOADS_DIR / safe).resolve()
    if not str(path).startswith(str(DOWNLOADS_DIR.resolve())) or not path.is_file():
        return JSONResponse(status_code=404, content={"error": "file not found"})
    return FileResponse(path, filename=safe)


@app.get("/", response_class=HTMLResponse)
async def index():
    return CHAT_HTML


CHAT_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DOCFlow Document Assistant</title>
<style>
:root{--navy:#1E3A6E;--blue:#2A7DD2;--paper:#F4F6F9;--ink:#1C2733;--soft:#5A6B7C;
--line:#D9E1E8;--green:#2E7D5B;--amber:#C97F14}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,'Segoe UI',sans-serif;background:var(--paper);color:var(--ink);
display:flex;flex-direction:column;height:100vh}
header{background:var(--navy);color:#fff;padding:14px 22px}
header h1{font-size:17px;font-weight:600}
header p{font-size:12px;opacity:.75;margin-top:2px}
#log{flex:1;overflow-y:auto;padding:22px;display:flex;flex-direction:column;gap:14px;max-width:820px;width:100%;margin:0 auto}
.msg{max-width:82%;padding:11px 15px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap}
.user{align-self:flex-end;background:var(--blue);color:#fff;border-bottom-right-radius:3px}
.bot{align-self:flex-start;background:#fff;border:1px solid var(--line);border-bottom-left-radius:3px}
.card{align-self:flex-start;background:#fff;border:1px solid var(--line);border-radius:12px;
padding:14px 16px;max-width:88%;font-size:14px}
.card .docno{font-weight:700;font-size:15px}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:9px;
background:#E9F4EF;color:var(--green);margin-left:8px;vertical-align:1px}
.badge.other{background:#FBF3E3;color:var(--amber)}
.meta{font-size:12px;color:var(--soft);margin:4px 0 8px}
.card h4{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--soft);margin:10px 0 4px}
.card li{margin-left:18px;padding:2px 0}
.card a{color:var(--blue);text-decoration:none}
.card a:hover{text-decoration:underline}
.src{font-size:11px;color:var(--soft);margin-top:10px;border-top:1px dotted var(--line);padding-top:6px;
display:flex;justify-content:space-between;align-items:center;gap:10px}
.src button{font-size:11px;border:1px solid var(--line);background:#fff;border-radius:6px;
padding:3px 10px;cursor:pointer;color:var(--navy)}
.typing{align-self:flex-start;color:var(--soft);font-size:13px;font-style:italic}
form{display:flex;gap:10px;padding:14px 22px;background:#fff;border-top:1px solid var(--line);
max-width:820px;width:100%;margin:0 auto}
input{flex:1;border:1px solid var(--line);border-radius:9px;padding:11px 14px;font-size:14px;outline:none}
input:focus{border-color:var(--blue)}
button.send{background:var(--navy);color:#fff;border:none;border-radius:9px;padding:0 22px;
font-size:14px;font-weight:600;cursor:pointer}
button.send:disabled{opacity:.5}
</style>
</head>
<body>
<header><h1>DOCFlow Document Assistant</h1>
<p>Ask for any document by its ID — e.g. “What’s the status of DWG-STR-1043?”</p></header>
<div id="log">
  <div class="msg bot">Hi! Give me a document ID and I’ll fetch its latest status, comments, and attachments from DOCFlow.</div>
</div>
<form id="f"><input id="q" placeholder="e.g. DWG-STR-1043" autocomplete="off">
<button class="send" id="s">Send</button></form>
<script>
const log=document.getElementById('log'),f=document.getElementById('f'),
q=document.getElementById('q'),s=document.getElementById('s');
function add(el){log.appendChild(el);log.scrollTop=log.scrollHeight;}
function bubble(cls,text){const d=document.createElement('div');d.className='msg '+cls;d.textContent=text;add(d);return d;}
function esc(t){const d=document.createElement('span');d.textContent=t??'';return d.innerHTML;}
function card(r){
  const d=document.createElement('div');d.className='card';
  const approved=(r.status||'').toLowerCase()==='approved';
  let h=`<span class="docno">${esc(r.doc_no)}</span>`+
    `<span class="badge ${approved?'':'other'}">${esc(r.status||'—')}</span>`+
    `<div class="meta">${esc(r.title||'')}${r.revision?' · Rev '+esc(r.revision):''}</div>`;
  if((r.comments||[]).length){h+='<h4>Comments</h4><ul>'+r.comments.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul>';}
  if((r.attachments||[]).length){h+='<h4>Attachments</h4><ul>'+r.attachments.map(a=>
    a.url?`<li><a href="${a.url}" target="_blank">${esc(a.filename)}</a></li>`
         :`<li>${esc(a.filename)}</li>`).join('')+'</ul>';}
  const when=r.as_of?new Date(r.as_of).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  h+=`<div class="src"><span>${r.source==='cache'?'From memory · as of '+when:'Fetched live from DOCFlow · '+when}</span>`+
     (r.source==='cache'?`<button onclick="ask('${esc(r.doc_no)}',true)">Refresh live</button>`:'')+`</div>`;
  d.innerHTML=h;add(d);
}
async function ask(text,force=false){
  bubble('user',force?('Refresh '+text):text);
  const t=document.createElement('div');t.className='typing';
  t.textContent=force?'Fetching live from DOCFlow… (this can take a minute)':'Looking it up…';add(t);
  s.disabled=true;
  try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:text,force_refresh:force})});
    const r=await res.json();t.remove();
    if(r.found)card(r);else bubble('bot',r.reply||'Not found.');
  }catch(e){t.remove();bubble('bot','Something went wrong: '+e.message);}
  s.disabled=false;q.focus();
}
f.addEventListener('submit',e=>{e.preventDefault();const v=q.value.trim();if(!v)return;q.value='';ask(v);});
</script>
</body>
</html>"""
