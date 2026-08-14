# DocFlow AI — Acceptance Criteria (role-by-role)

Given/When/Then acceptance criteria for every feature, broken out per role — suitable for
sign-off or for pasting into issue tickets. Companion to [TEST-CASES.md](TEST-CASES.md),
which gives step-by-step instructions for exercising each criterion below; this document
states *what must be true*, not *how to check it*.

Roles follow spec §4: **Viewer, Contributor/Engineer, Reviewer/Approver, Document
Controller, Contractor/Subcontractor, Project Manager, Admin/Auditor.** Viewer has no
seeded demo user (see [TEST-CASES.md](TEST-CASES.md) Legend) — its criteria describe
required behavior for when one exists, verifiable directly against `dms.js`.

---

## 1. Authentication & session

- **AC-1.1 (all roles) — Successful login.**
  Given a valid username and password, when the user submits the login form or
  `login <user> <pass>` in chat, then a session is created scoped to that user's role,
  org, projects, and disciplines, the dashboard loads, and a `LOGIN` entry is recorded.
- **AC-1.2 (all roles) — Failed login never reveals which part was wrong.**
  Given an invalid username or password, when login is attempted, then the app shows one
  generic error ("Invalid username or password."), the password field clears, and the
  failure is logged under `anonymous`, never the guessed username.
- **AC-1.3 (all roles) — No data before authentication.**
  Given no active session, when any document-related request is made (UI or chat), then
  it is refused with a sign-in prompt and no document data is returned.
- **AC-1.4 (all roles) — Clean logout.**
  Given an active session, when the user signs out, then the session and all open
  UI (drawer, modals, popovers) close, and a `LOGOUT` entry is recorded.
- **AC-1.5 (all roles) — Passwords are never echoed.**
  Given a chat login command containing a password, when it is submitted, then the
  transcript shows the password masked, never in plain text.

## 2. Dashboard — "My Documents"

- **AC-2.1 (all roles) — Scope-correct listing.**
  Given a signed-in user, when they view "All my documents," then the list contains
  exactly the documents their role's visibility rule (spec §4) entitles them to — no
  more, no less — reflected identically in the table, sidebar counts, stat tiles, and
  chat's `show my documents`.
- **AC-2.2 (Contractor/Subcontractor) — Narrowest scope.**
  Given an external Contractor/Subcontractor user, when they view their documents, then
  only documents they originated or are explicitly on the distribution list of appear —
  discipline overlap alone does **not** grant visibility (unlike internal roles).
- **AC-2.3 (Document Controller, Project Manager) — Full in-project visibility.**
  Given a Document Controller or Project Manager, when they view documents, then every
  document in their assigned project(s) is visible, regardless of assignment or
  discipline.
- **AC-2.4 (Admin/Auditor) — Cross-project visibility.**
  Given the Admin/Auditor role, when they view documents, then documents from **all**
  projects (SPCL and LTRM) are visible, bypassing project scoping entirely.
- **AC-2.5 (all roles) — Overdue is computed, not stored.**
  Given a document with an open status and a due date before the current demo date, when
  any view renders it, then it is flagged `OVERDUE` consistently in the table, tiles,
  bell, and sort order — computed live, never a stale flag.

## 3. Document detail drawer

- **AC-3.1 (all roles with view access) — Complete, consistent detail.**
  Given a document within the user's scope, when it is opened (row click, chat `open`,
  or bell notification), then the same tabbed detail (Overview, Comments, Revision
  History, Workflow Trail, Attachments) renders identically regardless of entry point.
- **AC-3.2 (all roles) — Action bar reflects exact permissions.**
  Given an open document, when the action bar renders, then it shows Code 1–4 buttons
  only if the user is the assigned reviewer, "Upload new revision" only if the user is
  the originator or Document Controller/Admin, and an explanatory view-only note
  otherwise — never a button the backend would then reject.
- **AC-3.3 (all roles) — Out-of-scope documents are indistinguishable from missing ones.**
  Given a document number the user cannot see, when they attempt to open it, then the
  response is identical to a genuinely nonexistent document number, and the audit log
  records a single ambiguous event rather than confirming existence.

## 4. Comments

- **AC-4.1 (Engineer, Reviewer, Doc Controller, Contractor, PM, Admin) — Add a comment.**
  Given a document the user can see and their role isn't Viewer, when they submit a
  comment, then it's appended verbatim with their name, role, and timestamp, the count
  updates everywhere it's shown, and a `COMMENT` entry is logged.
- **AC-4.2 (Viewer) — No commenting.**
  Given the Viewer role, when they attempt to comment (UI or chat) on any document, then
  it is refused regardless of the document's scope — Viewer is excluded from commenting
  unconditionally, not just by visibility.
- **AC-4.3 (all roles) — Internal-only remarks stay internal.**
  Given a comment marked `internal_only`, when any role other than PM/Admin (or the
  comment's own author) views the thread, then that comment is absent — not merely
  styled differently.

## 5. Approve / Reject workflow

- **AC-5.1 (Reviewer/Approver, Project Manager, Admin) — Assigned reviewer can act.**
  Given a document currently assigned to the user for review, when they apply a review
  code (1–4), then the status transitions per the code, the workflow trail records the
  actor/decision/date, and — for Code 1/2 — the assignee clears and closed date is set,
  or — for Code 3/4 — the document returns to its originator.
- **AC-5.2 (all roles except Admin) — No self-approval.**
  Given a document the user themselves originated, when they attempt any review code,
  then it is refused with an explicit workflow-rule message, before any assignee check
  even runs.
- **AC-5.3 (Admin) — Exempt from self-approval.**
  Given the Admin/Auditor role, when they act on a document they themselves originated,
  then the action succeeds — Admin is the sole role exempt from AC-5.2.
- **AC-5.4 (all roles) — Only the actual assignee can act.**
  Given a document assigned to someone else, when a non-assignee (other than Admin)
  attempts a review code, then it is refused, naming the actual current holder.
- **AC-5.5 (all roles) — Terminal states are immutable.**
  Given a document already in a terminal state (Approved, Approved w/ Comments,
  Rejected, Closed, Superseded), when any review code is attempted, then it is refused as
  an invalid transition.

## 6. Upload revision

- **AC-6.1 (Engineer, Contractor) — Own-document upload only.**
  Given a document they originated, when an Engineer or Contractor uploads a new
  revision, then the revision increments, status resets to Pending Review, a new
  workflow step is appended, and the prior revision is retained (never deleted).
- **AC-6.2 (Document Controller, Admin) — Any-document upload.**
  Given any document in scope, when a Document Controller or Admin uploads a revision,
  then it succeeds regardless of who originated the document.
- **AC-6.3 (Reviewer/Approver, Project Manager) — No upload rights.**
  Given any document, when a Reviewer/Approver or Project Manager attempts to upload a
  revision, then it is refused — these roles review and escalate, but never upload.
- **AC-6.4 (all roles) — Revision history is append-only.**
  Given any successful revision upload, when the Revision History tab is viewed, then
  every prior revision remains listed with its original change summary and uploader —
  none are removed or overwritten.

## 7. Create a new document *(new feature)*

- **AC-7.1 (Engineer, Document Controller, Contractor, Project Manager, Admin) —
  Create-document rights.**
  Given a user with one of these roles, when they view the dashboard, then a **"+ New
  document"** action is available (button and chat guidance both), and calling
  `create_document` with valid fields succeeds.
- **AC-7.2 (Reviewer/Approver, Viewer) — No create-document rights.**
  Given a user with either role, when they view the dashboard, then no create-document
  action is available, and any attempt (UI-bypassed call, or chat) is refused with a
  message naming their role and the restriction.
- **AC-7.3 (all permitted roles) — Numbering is deterministic and collision-free.**
  Given a document type and discipline, when a new document is created, then its doc
  number follows `[Project]-[Discipline]-[DocType]-[Sequence]-[Rev]`, the sequence is one
  greater than the highest existing sequence for that document-type code across *all*
  documents (seeded or created this session), and the starting revision is **A** for
  Drawing/Submittal-MAR/Method Statement and **0** for every other type.
- **AC-7.4 (all permitted roles) — Auto-routing never leaves a document unowned.**
  Given a new document's discipline, when it is created, then it is assigned to: the
  first in-project Reviewer/Approver covering that discipline (or "ALL"); else the
  in-project Project Manager; else the in-project Document Controller; else another
  in-project Admin; else — if genuinely no one else has access to that project — the
  creator. `current_assignee` is **never** null on a `PENDING REVIEW` document.
- **AC-7.5 (all permitted roles) — Distribution list is always complete.**
  Given a new document, when it is created, then its distribution list always includes
  the creator, the routed assignee, the Document Controller, and Admin, plus any
  additional recipients selected, with duplicates collapsed.
- **AC-7.6 (Engineer, Contractor) — Project scope is enforced.**
  Given a user assigned to only a subset of projects, when they create a document, then
  the project selector offers only their assigned project(s), and a direct call
  specifying an out-of-scope project is refused.
- **AC-7.7 (Admin) — Cross-project creation.**
  Given the Admin role, when they create a document, then any project (SPCL or LTRM) may
  be selected and the document is created there correctly.
- **AC-7.8 (all permitted roles) — Required fields are enforced.**
  Given the creation form, when Title is left blank, then submission is blocked
  client-side, and a direct call without a title, a recognized type, or a recognized
  discipline is rejected with a specific validation error for each case.
- **AC-7.9 (all permitted roles) — Optional initial attachment is captured faithfully.**
  Given a file selected in the creation form, when the document is created, then the
  Attachments tab shows its real file name, uppercased extension as type, and a
  human-readable size; given no file, the Attachments tab shows an empty state, not an
  error.
- **AC-7.10 (all permitted roles) — Created documents are first-class.**
  Given a document created through this feature, when any other feature (comment,
  approve/reject, upload revision, download, audit trail, search) subsequently interacts
  with it, then it behaves identically to a seeded document — no feature requires
  special-casing for how a document originated.
- **AC-7.11 (all roles) — Creation is fully audited.**
  Given any successful creation, when the audit trail is inspected (Admin only), then a
  `CREATE_DOCUMENT` entry appears with the acting user, timestamp, resulting doc number,
  and title.

## 8. Attachments & downloads

- **AC-8.1 (all roles with view access) — Download is scope-checked.**
  Given a document in the user's scope, when they download an attachment, then a valid,
  openable placeholder file is generated carrying that document's live metadata, and a
  `DOWNLOAD` entry is logged; given a document outside their scope, the download is
  refused with the same "not found" response as an unopenable document.
- **AC-8.2 (all roles) — Masking extends into generated files.**
  Given a role whose view of a document is masked (e.g. internal-only remarks hidden),
  when a PDF is generated for that document, then the masked content is absent from the
  file itself, not just hidden by the UI.
- **AC-8.3 (all roles) — File type determines placeholder format.**
  Given an attachment's file extension, when downloaded, then `.pdf` produces a
  construction drawing sheet with inline review markups, `.jpg`/`.jpeg` produces a
  canvas-rendered image, and any other extension produces a labeled plain-text
  placeholder — all clearly marked as POC-generated.

## 9. Chat assistant

- **AC-9.1 (all roles) — Never invents data.**
  Given any query, when the assistant responds, then every document fact comes from a
  `DMS.*` tool call — no fabricated titles, statuses, or comments — and a zero-result
  search says so plainly.
- **AC-9.2 (all roles) — Confirm-before-write.**
  Given any comment, status change, revision upload, or document creation requested via
  chat, when the assistant would execute it, then it first echoes the exact change back
  in one line and requires an explicit `yes` before calling the tool; `no` cancels with
  no side effects.
- **AC-9.3 (all roles) — Guardrails cannot be talked around.**
  Given a request to delete data, fabricate/backdate an approval, skip a workflow step,
  or reveal a password/token, when phrased any way, then the assistant refuses and
  explains why, regardless of role or phrasing.
- **AC-9.4 (all roles) — Search discloses its mode.**
  Given a search query, when results are returned, then the reply states whether it was
  an exact doc-number match, a partial match, or a keyword/content match.

## 10. Audit trail

- **AC-10.1 (Admin/Auditor) — Full access.**
  Given the Admin/Auditor role, when they request the audit trail, then every logged
  action from the session is returned with user, timestamp, action, and detail.
- **AC-10.2 (all other roles) — No access, including Document Controller.**
  Given any role other than Admin/Auditor, when they request the audit trail (button or
  chat), then access is refused with a role-specific message — Document Controller's
  otherwise-broad visibility does **not** extend to the audit log.
- **AC-10.3 (Admin/Auditor) — Complete write coverage.**
  Given any write action performed by any user (login/logout attempts, comments, status
  changes, uploads, document creation, downloads), when the audit trail is inspected,
  then a correctly labeled entry exists for it — no write action is silently unlogged.

## 11. Cross-cutting RBAC & masking

- **AC-11.1 (Project Manager, Admin) — Commercial data restricted.**
  Given a document carrying a commercial value, when viewed by any role other than
  Project Manager or Admin, then the commercial value is absent from every rendering
  (drawer, chat detail card, generated PDF).
- **AC-11.2 (Contractor/Subcontractor) — Distribution list hidden.**
  Given any document, when viewed by a Contractor/Subcontractor, then the distribution
  list is never shown, even for documents they originated.
- **AC-11.3 (all roles) — Project boundaries hold even for broad-visibility roles.**
  Given a role with full in-project visibility (Document Controller, Project Manager),
  when they attempt to access a document from a project they aren't assigned to, then
  access is refused identically to a nonexistent document.
- **AC-11.4 (Admin/Auditor) — Full bypass, by design.**
  Given the Admin/Auditor role, when accessing any document in any project, then access
  always succeeds, since Admin is the one role intentionally exempt from project and
  discipline scoping.

## 12. Persistence & reset demo data *(new feature)*

- **AC-12.1 (all roles) — Writes survive a reload.**
  Given any successful write (comment, status change, revision upload, document
  creation), when the page is reloaded, then the change is still present exactly as it
  was — persistence happens automatically on every write, with no separate "save" step.
- **AC-12.2 (all roles) — The audit log survives a reload.**
  Given any logged action, when the page is reloaded and the audit trail is later
  inspected (Admin/Auditor), then that action's entry is still present, in its original
  order relative to entries from other sessions.
- **AC-12.3 (all roles) — Sessions are never persisted.**
  Given an active session, when the page is reloaded, then the user is signed out and
  must log in again — persistence covers documents and the audit log only, never
  authentication state.
- **AC-12.4 (all roles) — Storage failures never block a write.**
  Given `localStorage` is unavailable or throws (private browsing, quota exceeded,
  disabled), when any write action is performed, then it still succeeds for the current
  session — persistence failures degrade silently to in-memory-only behavior rather than
  surfacing an error or blocking the action.
- **AC-12.5 (Admin/Auditor) — Reset rights.**
  Given the Admin/Auditor role, when `reset demo data` is requested and confirmed, then
  all persisted documents and audit entries are cleared and the app reloads to the
  original seed state.
- **AC-12.6 (all other roles) — No reset rights.**
  Given any role other than Admin/Auditor, when `reset demo data` is requested (chat or a
  direct call), then it is refused with a role-specific message, and nothing is cleared —
  matching the audit-trail access restriction (AC-10.2), since a reset is at least as
  sensitive.
- **AC-12.7 (Admin/Auditor) — Reset requires explicit confirmation.**
  Given a reset request, when the Admin has not yet replied `yes`, then no data is
  cleared and no reload occurs; a `no` (or any other reply) cancels it with no side
  effects, identical to every other confirm-before-write action in this app.
- **AC-12.8 (all roles) — Reset affects everyone, not just the requester.**
  Given documents or audit entries created by other users, when an Admin/Auditor
  confirms a reset, then those are cleared too — a reset is global to the persisted
  state, not scoped to the acting user's own contributions.
