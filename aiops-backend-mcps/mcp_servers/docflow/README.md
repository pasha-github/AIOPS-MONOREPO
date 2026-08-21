# DocFlow AI — Lite Document Management System (POC)

**An AI-native, chat-driven layer over a document repository — positioned as a lightweight
alternative to Oracle Aconex, IBM FileNet, OpenText, and SharePoint-based DMS platforms,
with an EPC/Construction module for contractors and developers (Shapoorji Pallonji, L&T,
Tata Projects-type usage).**

> *"Ask for a document the way you'd ask a colleague, and get back exactly what a document
> controller would show you — status, comments, revision, and who's holding it up."*

This proof-of-concept implements the full functional specification in
[DocFlow-AI-System-Prompt-and-Spec.md](DocFlow-AI-System-Prompt-and-Spec.md): a
conversational assistant **and** a conventional click-through UI, both driven by the same
role-based, audit-logged tool layer.

It runs **entirely in the browser** — no build step, no database, no server-side code, and
no API keys. The backend and the AI assistant are simulated in plain JavaScript so every
flow can be demoed offline.

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [Demo users](#2-demo-users)
3. [Feature tour](#3-feature-tour)
4. [Chat assistant — command reference](#4-chat-assistant--command-reference)
5. [Attachment downloads — generated drawing sheets](#5-attachment-downloads--generated-drawing-sheets)
6. [Security, RBAC & audit](#6-security-rbac--audit)
7. [EPC / Construction module](#7-epc--construction-module)
8. [Architecture](#8-architecture)
9. [Seeded demo dataset](#9-seeded-demo-dataset)
10. [Extending the POC](#10-extending-the-poc)
11. [Suggested demo script](#11-suggested-demo-script)
12. [Known limitations](#12-known-limitations)
13. [Repository contents](#13-repository-contents)
14. [Testing & acceptance criteria](#14-testing--acceptance-criteria)

---

## 1. Quick start

No build step and no dependencies — the backend is Python standard library only, so
there is nothing to install. From a terminal, `cd` into this folder:

```bash
python server/app.py
```

Then open **http://localhost:8321**. The server keeps running in the foreground —
press **Ctrl+C** in that terminal to stop it.

On first run it creates `server/data/docflow.sqlite3` and seeds it from
[data.js](data.js). That database is the shared store: **every user, on every browser
and every machine pointed at this server, sees the same document register**, and files
uploaded through *New document* are stored server-side and open for real. See
[DEPLOY.md](DEPLOY.md) for the container image and Cloud Run deployment.

Port 8321 is just a convention used throughout this README and the test docs; any free
port works — `python server/app.py --port 8080` and open that port instead.

> Opening `index.html` via `file://`, or serving the folder with a plain
> `python -m http.server`, still works: with no API reachable the app falls back to its
> original per-browser `localStorage` mode and says so under the login form. You lose
> sharing and real attachments, nothing else.

A `.claude/launch.json` is included so Claude Code's browser preview can start the server
automatically — `docflow-poc` on port 8321, `docflow-poc-alt` on 8322. Both share one
database, so two roles side by side in separate tabs now see each other's changes
(within the 15-second sync interval).

**While actively editing the app's own files**: the server sends
`Cache-Control: no-cache` on the front-end assets, so a plain reload picks up edits.
If you had previously used `python -m http.server`, hard-refresh once
(**Ctrl+Shift+R**) to clear assets it cached without validators.

---

## 2. Demo users

All passwords are **`demo123`** (POC only).

| Username  | Name           | Role                        | Org                                | What their login demonstrates |
|-----------|----------------|-----------------------------|------------------------------------|-------------------------------|
| `maha`   | Maha Al-Ghamdi     | Document Controller         | SP Engineering (Main Contractor)   | Sees **all** project documents; routes but cannot approve; commercial values still masked from her |
| `khalid`  | Khalid Al-Mutairi    | Reviewer/Approver (MEP/ELE) | SP Engineering (Main Contractor)   | Pending reviews, overdue RFI/IR flags, Code 1–4 approval actions |
| `omar`    | Omar Al-Harbi  | Contributor/Engineer (CIV/STR) | SP Engineering (Main Contractor) | Own submissions, Code 3 revise-and-resubmit flow, revision upload |
| `noura`   | Noura Al-Qahtani | Project Manager             | SP Engineering (Main Contractor)   | Sees commercial BOQ values and internal-only remarks; approval rights on escalations |
| `yousef` | Yousef Al-Sabah   | Contractor/Subcontractor (external) | CoolAir HVAC Systems (Subcontractor) | Strict external scoping: own submissions + explicitly distributed docs **only** |
| `layla`   | Layla Al-Rashidi  | Admin/Auditor               | SP Engineering (Main Contractor)   | Cross-project access (SPCL + LTRM) and the session **audit trail** |

Log in via the form (with project selector and "Forgot password"), or in chat:
`login khalid demo123` — the password is masked in the transcript and never echoed.

---

## 3. Feature tour

### Login & sessions
- No document data of any kind is shown before authentication — the chat refuses every
  request with a sign-in prompt until a session exists.
- Sessions carry the user's role, org, project scope, and discipline assignments; every
  data-returning call re-checks that scope.
- Signing out (button or `logout` in chat) closes the session and logs it for audit.
- The session itself is never persisted — every page reload requires signing in again —
  but unlike the session, the *documents* (created, commented on, approved, revised) and
  the audit log now survive a reload; see [§6](#6-security-rbac--audit) and
  [§12](#12-known-limitations).

### Dashboard — "My Documents"
- Table columns per the spec: Doc No., Document Name, Type, Discipline, Rev, Status,
  Assigned To, Due Date, Last Updated, Comments.
- **Stat tiles**: documents in scope, awaiting my action, submitted by me, overdue.
- **Status badges**, color-coded: green = Approved, amber = Pending/Under Review,
  red = Rejected/Overdue, purple = Revise & Resubmit, grey = Closed/Superseded.
  Overdue is computed live from the due date (e.g. `[PENDING REVIEW · OVERDUE]`).
- **Comments column** shows the count **plus a one-line summary of the latest remark**;
  hovering shows the entire thread as a tooltip.
- **Filters**: keyword search, saved views (All / My Pending Reviews / Overdue /
  Submitted by Me), and a discipline selector built from the user's actual scope.
- **Notification bell** with badge count: overdue items and documents awaiting your
  action; clicking a notification opens the document.
- Rows are sorted most-urgent-first: overdue items on top, then by nearest due date.

### Document detail drawer
Click any row (in the dashboard *or* in a chat result table) to open the tabbed drawer:

| Tab | Contents |
|---|---|
| **Overview** | Full metadata grid: type, discipline, rev, confidentiality, originator + org, project, current holder, dates, commercial value (role-permitting), distribution list |
| **Comments** | Chronological thread — author, role, timestamp, verbatim text — plus an add-comment box if the role permits |
| **Revision History** | Every revision with date, change summary, and uploader; superseded revisions are never deleted |
| **Workflow Trail** | Stepper showing each review stage, actor, decision/review code, and date |
| **Attachments** | File list with type/size/uploader and a **⬇ Download** button per file |

The action bar at the bottom is **role-gated**: Code 1–4 buttons appear only for the
assigned reviewer, "Upload new revision" only for the originator/Document Controller, and
view-only roles see an explanatory note instead.

### Creating a new document
A **"+ New document"** button sits next to the dashboard search box — visible only to
roles with create rights (Document Controller, Contributor/Engineer, Contractor/
Subcontractor, Project Manager, Admin/Auditor; hidden for Reviewer/Approver and Viewer,
per §4 of the spec). It opens a modal form:

- **Title**, **Document type** and **Discipline** (drives the auto-generated doc number),
  **Project** (scoped to the signer's assigned projects), **Confidentiality**, an optional
  **Due date** (defaults to +14 days), an optional **initial attachment**, and a checklist
  of **additional recipients** to add to the distribution list.
- On submit, `DMS.create_document`:
  - generates the next doc number for that type/discipline following the numbering
    convention (`[Project]-[Discipline]-[DocType]-[Sequence]-[Rev]`, e.g.
    `SPCL-MEP-RFI-0118-0`), starting Rev **A** for lettered types (Drawing, Submittal/MAR,
    Method Statement) or Rev **0** for the rest (RFI, NCR, Transmittal, IR, Test
    Certificate, MOM, BOQ/Contract);
  - **auto-routes** it to the right reviewer for that discipline (falling back to the
    Project Manager, then the Document Controller, then any other in-scope Admin, then —
    if truly nobody else has access to that project — the creator themselves, so a
    document is never left with no owner);
  - seeds the revision history, workflow trail, and (if a file was attached) the
    attachments list, sets status to `PENDING REVIEW`, and always includes the creator,
    the routed reviewer, the Document Controller, and Admin in the distribution list, in
    addition to anyone checked;
  - is fully audit-logged (`CREATE_DOCUMENT`) and immediately reflected in every existing
    view — dashboard, drawer, chat — with no special-casing, since it's created through
    the same tool layer everything else reads from.
- Asking `new document` / `create document` in chat explains the button (a multi-field
  form isn't collected through free text, to avoid partial/garbled submissions) or, for a
  role without create rights, states the restriction.

### DocFlow AI assistant (chat panel)
- Answers only from tool-layer results — it never invents document data; zero results are
  reported plainly with a suggestion to broaden the search.
- Renders multi-document answers as tables (clickable rows), single documents as a full
  detail card: header → metadata → **verbatim** comment thread → revision history →
  workflow trail → attachments → *actions available to your role*.
- **Confirm-before-write**: every comment, status change, and revision upload is echoed
  back in one line and requires a `yes` before the tool is called; `no` cancels.
- Search behavior per spec: a bare alphanumeric code is treated as a document number
  first, then falls back to fuzzy/keyword search on title and content — and the reply
  states which mode was used. Ambiguous matches return a table to choose from.
- **Collapsible**: the `»` button in the header collapses the panel to a slim rail
  (desktop) or a header bar (narrow screens) so the dashboard gets the full width. A red
  dot on the toggle marks assistant messages that arrived while collapsed.
- On login the assistant greets with a scope summary and proactively flags overdue items.

---

## 4. Chat assistant — command reference

| Say… | What happens |
|---|---|
| `login <user> <password>` | Authenticates (only when signed out); password is masked in the transcript |
| `show my documents` / `my docs` | Table of documents assigned to, submitted by, or awaiting action from you — overdue first |
| `what's overdue` / `stuck` | Only the items past their due date |
| `pending` / `awaiting review` | Items pending your review |
| `search <keyword>` / `find chilled water` | Keyword search over doc number, title, type, and comment text |
| `open SPCL-MEP-DWG-0452-C` (or just paste a doc number) | Full document detail + opens the drawer |
| `comment on <doc no.>: <text>` | Adds a comment after a one-line confirmation |
| `approve <doc no.>` / `approve it` | Applies **Code 1** after confirmation (works on the currently open document too) |
| `approve with comments …` | Code 2 |
| `revise` / `resubmit …` | Code 3 |
| `reject …` | Code 4 |
| `code 2 SPCL-…` | Any explicit review code 1–4 |
| `upload revision to <doc no.>` | Uploads the next revision label, supersedes the current one, resets status to Pending Review |
| `new document` / `create document` | Points to the **+ New document** button (or, for Reviewer/Viewer, explains they can't create documents) |
| `audit trail` | Full audit log, persisted across reloads — **Admin/Auditor only** |
| `reset demo data` | Wipes all created/edited documents and the audit log back to the seed state, after a one-line confirmation — **Admin/Auditor only** |
| `help` | Command summary |
| `logout` | Ends the session |
| `yes` / `no` | Confirms or cancels the pending action |

Guardrails (always refused, with an explanation): deleting documents/comments, backdating
or fabricating approvals, skipping workflow steps, revealing passwords/tokens/session data.

---

## 5. Attachment downloads — generated drawing sheets

Real files are not stored in the POC, so downloads are **generated at the moment of
download** — valid, openable files carrying the document's live data:

- **`.pdf` → A3 construction drawing sheet** (built by [pdfgen.js](pdfgen.js) with raw PDF
  vector operators — no libraries):
  - sheet border, structural grid with numbered/lettered grid bubbles and column markers;
  - a **discipline-specific schematic** — CHW piping run with valves and an FCU for MEP,
    LV busbar single-line diagram with MCCBs for ELE, beams + hatched pour/detail zone
    for Civil/Structural and everything else;
  - **title block**: contractor, project, wrapped title, document number, rev, scale,
    type/discipline, date, status, file name;
  - a dashed red **electronic review stamp** showing the current status;
  - the document's **real comment thread rendered as inline markups** — numbered red
    dashed clouds on the drawing, keyed to a "REVIEW COMMENTS / INLINE MARKUPS" panel
    listing each comment with author, role, timestamp, and full text;
  - a footer disclaimer that the sheet is a generated placeholder, not a controlled document.
- **`.jpg` → placeholder image** rendered on a canvas with the document metadata.
- **Other extensions → plain-text placeholder** with the document metadata.

Every download goes through `DMS.download_attachment`, so it is **RBAC-checked** (you can
only download from documents in your scope, and the PDF is built from your *masked* view —
internal-only remarks a role can't see never reach the file) and **audit-logged** as a
`DOWNLOAD` action.

---

## 6. Security, RBAC & audit

### Role/permission matrix (enforced in `dms.js`)

| Role | View | Comment | Approve/Reject | Create document | Upload revision | Audit trail |
|---|---|---|---|---|---|---|
| Viewer | Distributed docs only | — | — | — | — | — |
| Contributor/Engineer | Assigned + own discipline + own docs | ✔ | — | Own discipline | Own docs | — |
| Reviewer/Approver | Assigned + own discipline | ✔ | Assigned docs only | — | — | — |
| Document Controller | All in project | ✔ | — (routes only) | Any | Any | — |
| Contractor/Subcontractor (external) | **Own submissions + distributed docs only** | ✔ | — | Own submissions | Own docs | — |
| Project Manager | All in project | ✔ | Assigned escalations | Any | — | — |
| Admin/Auditor | All, cross-project | ✔ | ✔ | ✔ | ✔ | ✔ |

`DMS.canCreateDocument(user)` in [dms.js](dms.js) gates the **+ New document** button/chat
intent — the same role set as Upload Revision, plus Project Manager (who already
originates commercial/BOQ documents in the seed data).

### Enforcement behaviors
- **Existence is never leaked**: a document outside the user's scope answers *"not found
  in your accessible scope"* — identical to a genuinely missing document.
- **Field masking**: commercial values (e.g. the BOQ variation's INR figure) are visible
  only to PM/Admin; internal-only remarks are hidden from external contractors; the
  distribution list is hidden from external orgs. Masking is applied at the response
  layer, not just the data layer (defense in depth).
- **Workflow integrity**: only the assigned reviewer can action a step; originators can
  never self-approve (refused up front, with the actual holder named); terminal states
  (Approved / Rejected / Closed / Superseded) cannot be re-actioned; uploading a revision
  supersedes but **never deletes** the prior one.
- **Session expiry** handling: expired/invalid sessions stop the action and request
  re-login rather than retrying.
- **Immutable, persisted audit trail**: every login (and failed login), list, search,
  open, comment, status change, upload, download, and document creation is appended
  with user, timestamp, action, and detail — mirrored to `localStorage` alongside the
  documents (§12), so it survives a reload rather than resetting every session. Viewable
  by Admin/Auditor via `audit trail` in chat; wipeable only via `reset demo data`
  (Admin/Auditor, confirmation required) — no other role or action can alter it.
- **No orphaned documents**: a newly created document is always routed to a real owner —
  `routeAssignee()` in `dms.js` falls Reviewer → PM → Document Controller → any other
  in-scope Admin → the creator, so a `PENDING REVIEW` document is never left with a null
  assignee even in a single-user project scope.

---

## 7. EPC / Construction module

- **Document numbering**: `[Project]-[Discipline]-[DocType]-[Sequence]-[Rev]`, e.g.
  `SPCL-MEP-DWG-0452-C` = project SPCL, MEP discipline, Drawing, sequence 0452, Rev C.
- **Review/response codes** (Aconex/FileNet convention):

  | Code | Meaning | Resulting status |
  |---|---|---|
  | Code 1 | Approved — no further action | `APPROVED` |
  | Code 2 | Approved with comments — proceed, incorporate comments | `APPROVED W/ COMMENTS` |
  | Code 3 | Revise & resubmit — do not proceed | `REVISE & RESUBMIT` (returned to originator) |
  | Code 4 | Rejected / not approved | `REJECTED` |

- **Document types** in the seed data: Drawings, RFIs, Submittals/MARs, Transmittals,
  NCRs, Inspection Requests, Method Statements, MOMs, BOQs/Contracts, Test Certificates.
- **Disciplines**: MEP, ELE, CIV, STR, ARC, HSE, COM (commercial), QA/QC.
- **Multi-org visibility**: client/main-contractor/subcontractor boundaries are enforced —
  one subcontractor never sees another's submittals or comments unless explicitly on the
  distribution list.
- **SLA tracking**: anything open past its due date is flagged `OVERDUE` automatically —
  in badges, stat tiles, the bell, chat greetings, and sort order. (The POC clock is
  pinned to `TODAY = 2026-07-19` in `data.js` so the demo state is stable.)

---

## 8. Architecture

```
┌──────────────────────────── Browser (no server code) ────────────────────────────┐
│                                                                                  │
│  index.html + styles.css        UI shell: login, dashboard, drawer, chat         │
│        │                                                                         │
│  app.js ─────────────┐          UI wiring, filters, bell, downloads, collapse    │
│        │             │                                                           │
│  chat.js ────────────┤          DocFlow AI assistant (intent engine)             │
│        │             │            – auth gate, tables, confirm-before-write      │
│        ▼             ▼                                                           │
│  ┌──────────────────────────┐   pdfgen.js — drawing-sheet PDF generator          │
│  │  dms.js  (tool layer)    │   (pure vector PDF, Node-testable)                 │
│  │  authenticate_user       │                                                    │
│  │  list_assigned_documents │   Every read is scope-filtered and masked;         │
│  │  search_documents        │   every write is permission- and workflow-         │
│  │  get_document_details    │   checked; everything is audit-logged.             │
│  │  add_comment             │                                                    │
│  │  update_status           │                                                    │
│  │  upload_revision         │                                                    │
│  │  create_document         │                                                    │
│  │  download_attachment     │                                                    │
│  │  get_audit_trail         │                                                    │
│  │  reset_demo_data         │                                                    │
│  └────────────┬─────────────┘                                                    │
│               ▼                                                                  │
│  data.js — seed data: users, roles, 18 documents, doc-type/discipline reference   │
│               ▲                                                                  │
│               │ hydrates DOCUMENTS + audit log on load, if present               │
│  localStorage — mirrors DOCUMENTS + the audit log on every write (§6, §12)       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions**

- **Everything flows through the tool layer.** Neither the chat assistant nor the
  click-through UI reads the document store directly; both call the same `DMS.*`
  functions that enforce RBAC, masking, workflow rules, and audit logging. This mirrors
  the spec's function-calling contract (§6) exactly.
- **The chat parser is a stand-in for an LLM.** `chat.js` is a deterministic intent
  engine that reproduces the behaviors mandated by the spec's system prompt (§2). In
  production you would replace it with an LLM (e.g. Claude with tool use), passing the
  spec's system prompt verbatim and exposing the same nine tools — the UI, tool layer,
  and data model need no changes.
- **Defense in depth.** Authorization is enforced twice: in the tool layer (data access)
  and in the response layer (what the assistant/UI displays and what generated PDFs
  contain), per spec §9.

---

## 9. Seeded demo dataset

18 documents — 17 on project **SPCL** (Shapoorji Tower, EPC/Construction) and 1 on
**LTRM** (Metro Depot, visible to Admin only):

| Status | Count | Examples |
|---|---|---|
| Pending review | 4 | `SPCL-MEP-DWG-0452-C` (the spec's example drawing), RFI, NCR, an **overdue** Inspection Request |
| Under review | 3 | Steel connection drawing, commercial BOQ variation, LTRM retaining wall |
| Approved w/ comments (Code 2) | 6 | VRF MAR, electrical SLD, anchor bolts, fire-damper MAR, concrete-pour method statement, pressure-test certificate |
| Approved (Code 1) | 1 | Chiller-room method statement |
| Revise & resubmit (Code 3) | 1 | Podium slab reinforcement (with the reconciliation dialogue in comments) |
| Superseded / Closed | 3 | Lobby finishes Rev D, HSE MOM, transmittal |

Every document carries realistic metadata, comment threads, revision histories, workflow
trails, and attachments; two are overdue against the pinned demo date to exercise SLA
flagging.

---

## 10. Extending the POC

- **Add a user**: append to `USERS` in [data.js](data.js) (`user_id`, `username`, `role`
  from `ROLES`, `org`, `projects`, `disciplines`, `password`). External orgs should use
  `ROLES.CONTRACTOR` to get strict scoping.
- **Add a document**: for a *seed* document (present from first load), append to
  `DOCUMENTS` in [data.js](data.js) — the fields mirror the spec's data model (§3).
  Include `distribution_list` user ids for visibility, and set `due_date` in the past
  (relative to `TODAY`) to make it overdue. For a document created *during* a session,
  use the **+ New document** button or `DMS.create_document(...)` instead (§3) — it
  handles numbering, routing, and audit logging for you.
- **Add a document type or discipline**: append to `DOC_TYPES`/`DISCIPLINES` in
  [data.js](data.js), and add a `TYPE_CODES` entry (the 2–4 letter code used in the doc
  number). Add the type to `LETTERED_REVISION_TYPES` if it should revise A, B, C… instead
  of 0, 1, 2….
- **Add a chat intent**: add a branch in `Chat.handle()` in [chat.js](chat.js); call only
  `DMS.*` functions and route any write through the `pendingAction` confirmation flow.
- **Swap in a real LLM**: replace `Chat.handle()` with a call to your model, register the
  nine spec §6 `DMS.*` functions as tools, and use the system prompt from
  [DocFlow-AI-System-Prompt-and-Spec.md](DocFlow-AI-System-Prompt-and-Spec.md) §2 verbatim.
  `DMS.reset_demo_data` is a POC-only convenience (wipes the localStorage stopgap so the
  next reload starts from the seed) — leave it out of the tool set once real persistence
  (§10) lands, since there's no "reset to seed" concept against a real database.
- **Test the PDF generator headlessly**: `pdfgen.js` exports via `module.exports` —
  `require` it in Node, pass a doc/attachment/comments, and validate or rasterize the
  returned string.

---

## 11. Suggested demo script

1. **Sign in as `khalid`** — note the stat tiles, overdue badges, bell count, and the
   assistant's greeting flagging overdue items.
2. Chat: `show my documents` → overdue-first table with comment summaries.
3. Chat: `open SPCL-MEP-DWG-0452-C` → full detail card + drawer opens.
4. Chat: `approve it` → one-line confirmation → `yes` → Code 1 applied, audit-logged,
   dashboard refreshes.
5. Drawer → **Attachments** → **⬇ Download** the PDF → open it: an A3 drawing sheet with
   the piping schematic and the review comments clouded inline.
6. **Sign out, sign in as `yousef`** (external subcontractor):
   - `open SPCL-CIV-DWG-0089-B` → *"not found in your accessible scope"* (existence never leaked);
   - `approve SPCL-MEP-RFI-0117-0` → refused up front: originators can't self-approve;
   - `delete document …` / `backdate the approval …` → guardrail refusals;
   - `comment on SPCL-MEP-DWG-0452-C: …` → allowed (on the distribution list).
   - Click **+ New document** → create a Test Certificate for MEP → it auto-numbers
     (`SPCL-MEP-TC-00xx-0`), routes to `khalid`, and immediately appears in yousef's own
     "Submitted by me" view.
7. **Sign in as `noura`**, open `SPCL-COM-BOQ-0012-1` → commercial value and
   internal-only remark are visible to the PM (and to no one else — compare with `maha`).
8. **Sign in as `layla`**: `audit trail` → every logged action with user and timestamp,
   including the `CREATE_DOCUMENT` entry from step 6.
9. **Reload the browser tab** — the Test Certificate from step 6 and every action from
   this script are still there (§12 persistence); then, still as `layla`, `reset demo
   data` → `yes` → the page reloads to the original 18-document seed state, ready for the
   next demo.
10. Click the **»** toggle to collapse the assistant and browse the dashboard
    full-width; note the unread dot when the assistant posts while collapsed.

---

## 12. Known limitations

- **Shared store, but no server-side security** — documents and the audit log now live in
  a shared SQLite database behind [server/app.py](server/app.py), so they persist across
  users, browsers and machines. The RBAC in §6 is still enforced **client-side only**:
  anyone who can reach `/api/state` gets the whole register regardless of role, and any
  client can write to `/api/documents/{id}`. Never point this at real project documents
  without moving the role checks server-side — see [DEPLOY.md](DEPLOY.md) §4.
- **Last-write-wins, 15-second sync** — writes are per-document, so edits to different
  documents never collide; two people commenting on the *same* document inside the same
  15-second window can lose one. Other users' changes arrive by poll, not push.
- **Rule-based chat** — the parser covers the spec's sample interactions and common
  phrasings, not free-form language; that is the seam where a real LLM plugs in.
- **Simulated auth** — plain-text passwords in `data.js`, no real sessions/tokens/SSO.
  None of the authentication code is production-grade, deliberately.
- **Seeded attachments are generated stand-ins** — every attachment in the register is a
  real stored file with a real URL, but the bytes behind a *seeded* one are generated on
  first connect (a drawing sheet, image or metadata text), not an actual drawing. Files
  uploaded through *New document* are the genuine article. The generated content says
  which it is.
- **Single-page scale** — no pagination beyond the spec's "first 20" rule in chat; fine
  for the 18-document seed, not for thousands.
- **Ephemeral storage on Cloud Run** — the SQLite file lives in the instance's memory
  unless you mount a volume over `/data`, so a redeploy or a scale-to-zero returns the
  register to the seed. [DEPLOY.md](DEPLOY.md) §3 covers the three options.

---

## 13. Repository contents

| Path | Purpose |
|---|---|
| [index.html](index.html) | App shell: login screen, dashboard, chat panel, detail drawer |
| [styles.css](styles.css) | Enterprise styling; status-badge colors per spec §7 |
| [data.js](data.js) | Mock store: 6 users covering 6 of the 7 roles (no seeded Viewer — see [TEST-CASES.md](TEST-CASES.md)), 18+ seeded EPC documents, doc-type/discipline reference data, pinned demo date |
| [dms.js](dms.js) | **Tool layer** — the spec §6 functions with RBAC, masking, workflow rules, audit log |
| [chat.js](chat.js) | **DocFlow AI assistant** — intent engine enforcing the spec §2 system-prompt behaviors |
| [app.js](app.js) | UI wiring: tables, filters, bell, drawer, new-document modal, downloads, chat, collapse |
| [pdfgen.js](pdfgen.js) | Drawing-sheet PDF generator (pure vector PDF, no dependencies, Node-testable) |
| [api.js](api.js) | Client sync layer — talks to the server, falls back to `localStorage` when it can't |
| [server/app.py](server/app.py) | **Shared backend** — SQLite register, attachment storage, static file serving (stdlib only) |
| [Dockerfile](Dockerfile) | Container image for Cloud Run / `docker run` |
| [DEPLOY.md](DEPLOY.md) | Running locally, the container, Cloud Run, and the durability/security caveats |
| [DocFlow-AI-System-Prompt-and-Spec.md](DocFlow-AI-System-Prompt-and-Spec.md) | The source functional/product specification, including the production AI system prompt |
| [DocFlow-AI-Design-Review-System-Prompt.md](DocFlow-AI-Design-Review-System-Prompt.md) | Companion prompt for design review/enhancement sessions |
| [TEST-CASES.md](TEST-CASES.md) | Role-by-role test cases for every feature |
| [ACCEPTANCE-CRITERIA.md](ACCEPTANCE-CRITERIA.md) | Given/When/Then acceptance criteria for every feature, by role |
| `Test Files/` | Sample reference documents collected for testing |
| `.claude/launch.json` | Dev-server launch configs for Claude Code's browser preview |

---

## 14. Testing & acceptance criteria

Every feature has role-by-role coverage in two companion documents, kept in sync with
[dms.js](dms.js)'s permission matrix so they double as regression checklists after any
role-logic change:

- **[TEST-CASES.md](TEST-CASES.md)** — concrete, step-by-step test cases (setup → steps →
  expected result) for login/session, the dashboard, the document detail drawer, comments,
  the approve/reject workflow, revision uploads, **creating a new document**,
  attachments/downloads, the chat assistant and its guardrails, the audit trail,
  **persistence and `reset demo data`**, and cross-cutting RBAC/masking rules — each
  broken out per role, including the seeded roles' actual demo logins
  (`maha`/`khalid`/`omar`/`noura`/`yousef`/`layla`).
- **[ACCEPTANCE-CRITERIA.md](ACCEPTANCE-CRITERIA.md)** — the same feature set expressed as
  Given/When/Then acceptance criteria per role, suitable for sign-off or for pasting into
  issue tickets.

There is no automated test runner in this POC (no build step, per §1) — these documents
are written to be executed manually against the running app, or used as the basis for a
future Playwright/Cypress suite driven through the same `DMS.*` tool layer the UI and chat
already share.

---

*POC only — adapt roles, statuses, numbering conventions, and document types to the
specific organization, and replace the simulated authentication and chat parser before
any real deployment.*
