# DocFlow AI — Test Cases (role-by-role)

Manual test cases for every feature in the POC, broken out per role. There is no
automated test runner (no build step, per [README.md](README.md) §1) — run these against
the live app at `http://localhost:8321` (see README §1), or use them as the source
material for a future Playwright/Cypress suite driven through the same `DMS.*` tool layer
the UI and chat already share.

Each case gives **setup → steps → expected result**. Where a case exercises a write
action, "expected result" also states what should appear in the audit trail (`DMS.get_audit_trail()`,
viewable as `layla` via `audit trail` in chat or the audit-trail button).

---

## Legend

| Role (per spec §4) | Demo login | Seeded? |
|---|---|---|
| Viewer | *none* | **Not seeded** — no demo user has this role. Cases for Viewer describe the expected behavior from the `canSee`/`canComment`/`canCreateDocument` logic in [dms.js](dms.js), to be exercised by adding a temporary user with `role: ROLES.VIEWER` to `USERS` in [data.js](data.js) (see README §10), or reviewed as a code check instead of a live run. |
| Contributor/Engineer | `omar` / `demo123` | Yes |
| Reviewer/Approver | `khalid` / `demo123` | Yes |
| Document Controller | `maha` / `demo123` | Yes |
| Contractor/Subcontractor | `yousef` / `demo123` | Yes |
| Project Manager | `noura` / `demo123` | Yes |
| Admin/Auditor | `layla` / `demo123` | Yes |

All seed data assumes the pinned demo clock `TODAY = "2026-07-19"` in [data.js](data.js).

**Reloading no longer re-seeds the app.** Documents and the audit log persist to
`localStorage` (see README §6/§12), so a reload preserves whatever the last test run
created — this is the behavior under test in §7 (Create a new document), not something
to work around. To genuinely start a test run from the clean 18-document seed:
- as `layla` (Admin/Auditor), say `reset demo data` in chat and confirm `yes` — this is
  itself TC-RESET-01/02 below, so running it also exercises that feature; or
- clear `localStorage` for the app's origin directly (DevTools → Application → Local
  Storage → remove `docflow-poc-state-v1`) and reload.

Either way, expect generated doc numbers in later runs to continue incrementing from
whatever the highest existing sequence is if you *don't* reset first — that's correct
behavior (TC-CREATE-06), not a bug to report.

**If you're regression-testing right after editing `dms.js`/`chat.js`/`app.js`**: hard-refresh
(Ctrl+Shift+R) before trusting a "still broken" result — the dev servers in README §1
don't send cache-busting headers, so a plain reload can serve a stale script (see README
§12).

---

## 1. Authentication & session

Related code: `DMS.authenticate_user`, `DMS.logout`, `UI.enterApp`/`UI.onLogout` in
[app.js](app.js), the unauthenticated guard at the top of `Chat.handle()`.

### TC-AUTH-01 — Valid login via the form (all roles)
- **Role:** any
- **Steps:**
  1. On the login screen, enter a valid demo username and `demo123` (or click a demo-user
     tile, which fills both fields).
  2. Click **Sign in**.
- **Expected result:** App shell loads; header shows the user's display name and role;
  the assistant posts a greeting summarizing scope and any overdue items; a `LOGIN`
  entry with the correct role is appended to the audit log.

### TC-AUTH-02 — Invalid password (all roles)
- **Steps:** Enter a valid username with the wrong password; submit.
- **Expected result:** Login screen stays; an inline error "Invalid username or password."
  appears; the password field is cleared; a `LOGIN_FAILED` audit entry is recorded with
  `user: "anonymous"` (failed attempts are never attributed to the real account).

### TC-AUTH-03 — Login via chat
- **Steps:** Before signing in, type `login khalid demo123` in the chat input and send.
- **Expected result:** The transcript echoes `login khalid ••••••••` (password masked, never
  the literal text you typed); the app enters the dashboard as Khalid.

### TC-AUTH-04 — No data before authentication
- **Steps:** On a fresh, signed-out session, try `show my documents` in chat (the login
  screen's chat isn't reachable in the UI, but the underlying guard is: verify via
  `Chat.handle("show my documents")` in the console before any `authenticate_user` call).
- **Expected result:** Every request is refused with a sign-in prompt; no document data,
  titles, or counts are revealed.

### TC-AUTH-05 — Logout (all roles)
- **Steps:** Click **Sign out** (or type `logout` in chat).
- **Expected result:** Returns to the login screen; drawer/modals/popovers close; a
  `LOGOUT` audit entry is recorded; chat and dashboard state reset on next login.

### TC-AUTH-06 — "Already logged in" login attempt
- **Steps:** While signed in as any user, type `login omar demo123` in chat.
- **Expected result:** Replies that you're already signed in as the current user and
  suggests `logout` to switch — does **not** silently switch sessions.

---

## 2. Dashboard — "My Documents"

Related code: `DMS.list_assigned_documents`, `UI.renderTable`/`renderTiles`/`renderSidebar`/`renderBell`.

### TC-DASH-01 — Scope-correct document list (per role)
- **Roles & expected counts** (fresh seed, `TODAY = 2026-07-19`):

  | Role (login) | Documents in scope | Why |
  |---|---|---|
  | `khalid` (Reviewer, MEP/ELE) | Docs assigned/authored/distributed to him, plus MEP/ELE discipline docs | `canSee`: assignee/originator/distribution OR discipline match |
  | `omar` (Engineer, CIV/STR) | Same rule, for CIV/STR | as above |
  | `maha` (Doc Controller) | **All** SPCL documents | Doc Controller sees everything in-project |
  | `noura` (PM) | **All** SPCL documents | PM sees everything in-project |
  | `yousef` (Contractor) | Only documents he **originated** or is **explicitly on the distribution list of** | External orgs get the narrowest scope — discipline match alone is *not* enough |
  | `layla` | **All** documents, **both** SPCL and LTRM | Admin bypasses project scoping entirely |
- **Steps:** Sign in as each role; note the "In my scope" stat tile and the row count.
- **Expected result:** Counts match the rule above; no document outside scope ever
  appears in the table, sidebar discipline counts, bell, or chat results for that role.

### TC-DASH-02 — Stat tiles and saved views
- **Role:** `khalid`
- **Steps:** Click each stat tile (**In my scope**, **Awaiting my action**, **Submitted by
  me**, **Overdue**) and the matching sidebar nav item.
- **Expected result:** Table filters to the matching subset; the "Overdue" tile is
  visually flagged (red) when its count is > 0; `SPCL-MEP-RFI-0117-0` (due `2026-07-18`,
  before `TODAY`) appears in the Overdue view for Khalid.

### TC-DASH-03 — Discipline filter
- **Role:** `maha` (disciplines `ALL`, so every discipline appears in the sidebar)
- **Steps:** Click a discipline in the sidebar (e.g. `STR`).
- **Expected result:** Table shows only STR documents; breadcrumb updates to
  `Project SPCL › STR`; result count matches the discipline's document count.

### TC-DASH-04 — Keyword filter
- **Steps:** Type `chilled water` into the filter box.
- **Expected result:** Table narrows to matching titles/doc numbers/types (client-side,
  live as you type); result line updates ("N documents matching "chilled water"").

### TC-DASH-05 — Notification bell
- **Role:** `khalid`
- **Steps:** Open the bell.
- **Expected result:** Lists overdue items (⏰) and items awaiting his action (📋), badge
  count matches; clicking an item opens that document's drawer and closes the popover.

### TC-DASH-06 — Row urgency sort
- **Steps:** Open "All my documents" for any role with multiple open items.
- **Expected result:** Overdue items sort first, then by nearest due date — never
  unsorted or newest-first.

---

## 3. Document detail drawer

Related code: `DMS.get_document_details`, `UI.openDetail`/`renderDrawerTab`/`renderDrawerActions`.

### TC-DRAWER-01 — Open via row click, chat, or bell (all roles)
- **Steps:** Click a table row; separately, `open SPCL-MEP-DWG-0452-C` in chat; separately,
  click a bell notification.
- **Expected result:** All three open the same drawer with identical content; the
  Comments tab label shows the live count, e.g. "Comments (3)".

### TC-DRAWER-02 — Tab contents match the data model
- **Role:** `maha`
- **Steps:** Open `SPCL-MEP-DWG-0452-C`; click each tab.
- **Expected result:**
  - *Overview*: type, discipline, revision, confidentiality, originator + org, project,
    current holder, submitted/due/closed dates, distribution list.
  - *Comments*: chronological thread, verbatim, with author/role/timestamp.
  - *Revision history*: Rev A → B → C rows with change summaries, oldest first.
  - *Workflow trail*: one step per revision review, with decision and date (or "Pending").
  - *Attachments*: file list with type/size/uploader/date and a working Download button.

### TC-DRAWER-03 — Action bar is role-gated
- **Roles:** `khalid` (assigned reviewer on `SPCL-MEP-DWG-0452-C`), `omar` (no rights on
  that doc), `maha` (upload rights but no approve rights)
- **Steps:** Open `SPCL-MEP-DWG-0452-C` as each role.
- **Expected result:**
  - `khalid`: sees Code 1–4 buttons (he's the assignee).
  - `omar`: sees the view-only note, no action buttons (not assigned, not originator/DC).
  - `maha`: sees only "Upload new revision" (Doc Controller can upload any doc, but
    can't approve unless she's the assignee).

### TC-DRAWER-04 — Existence never leaked (cross-role)
- **Role:** `yousef`
- **Steps:** `open SPCL-CIV-DWG-0089-B` (a document he has no relationship to).
- **Expected result:** "No document matching ... was found in your accessible scope." —
  identical wording to a genuinely nonexistent doc number. Verify in the audit log: the
  entry is `OPEN_DENIED_OR_MISSING`, not a distinguishable "denied" vs "missing" action.

---

## 4. Comments

Related code: `DMS.add_comment`, `canComment`.

### TC-COMMENT-01 — Add a comment (permitted role)
- **Role:** `omar` on `SPCL-CIV-DWG-0089-B` (his own document)
- **Steps:** Open the doc → Comments tab → type text → **Post comment** (or chat:
  `comment on SPCL-CIV-DWG-0089-B: <text>` → `yes`).
- **Expected result:** Comment appears immediately with his name, role
  "Contributor/Engineer", and a timestamp on `TODAY`; comment count increments
  everywhere (drawer tab, table Comments column, chat detail card); `COMMENT` audit entry
  recorded.

### TC-COMMENT-02 — Viewer cannot comment (code check — not seeded)
- **Role:** Viewer
- **Expected result (per `canComment`):** `canComment` returns `false` unconditionally for
  `ROLES.VIEWER` regardless of scope — no add-comment box in the drawer, and
  `add_comment` returns `{ok:false, error:"Your role (Viewer) does not permit commenting
  on this document."}` if called directly.

### TC-COMMENT-03 — Comment refused when out of scope
- **Role:** `yousef`
- **Steps:** Attempt `comment on SPCL-CIV-DWG-0089-B: test` (a Civil doc he has no
  relationship to).
- **Expected result:** "No document matching ... found in your accessible scope" —
  refused at the lookup stage, never reaching a permission-specific message (existence
  isn't leaked even at the point of trying to write).

### TC-COMMENT-04 — Internal-only remark masking
- **Role:** `noura` (PM) vs. `yousef` (Contractor) vs. `maha` (Doc Controller)
- **Steps:** Open `SPCL-COM-BOQ-0012-1`, which has an `internal_only: true` comment
  authored by `noura`.
- **Expected result:** `noura` and `layla` see it (commercial roles); `maha` — who isn't
  a commercial role and isn't the author — does **not** see it; `yousef` cannot see the
  document at all (not on its distribution list), so the question is moot for him.

---

## 5. Approve / Reject workflow (Code 1–4)

Related code: `DMS.update_status`, `canApprove`, `REVIEW_CODES`.

### TC-APPROVE-01 — Assigned reviewer approves (Code 1)
- **Role:** `khalid` on `SPCL-MEP-DWG-0452-C` (assigned to him)
- **Steps:** Drawer → **Code 1 · Approve** → confirm (or chat: `approve it` → `yes`).
- **Expected result:** Status → `APPROVED`; `current_assignee` cleared; `closed_date` set
  to `TODAY`; the matching "Pending" workflow-trail step is replaced with
  `khalid`/"Code 1 — Approved"/`TODAY`; `STATUS_CHANGE` audit entry logged.

### TC-APPROVE-02 — Code 3 returns to originator
- **Role:** `noura` (PM) on `SPCL-STR-DWG-0555-A` (assigned to her)
- **Steps:** Apply Code 3 — Revise & Resubmit.
- **Expected result:** Status → `REVISE & RESUBMIT`; `current_assignee` becomes the
  document's `originator` (`omar`), not cleared — he must act next.

### TC-APPROVE-03 — Originator cannot self-approve
- **Role:** `omar`, originator of `SPCL-CIV-DWG-0089-B`
- **Steps:** Attempt to approve/reject his own document (button won't even render, but
  verify the underlying rule): call `DMS.update_status('d-0089','1')` as `omar`.
- **Expected result:** `{ok:false, error:"Workflow rule: originators cannot action their
  own submission."}` — refused before the approve-rights check even runs.

### TC-APPROVE-04 — Non-assignee cannot approve
- **Role:** `maha` (Doc Controller — routes but never approves)
- **Steps:** Attempt Code 1 on any document she isn't the assignee for.
- **Expected result:** Refused, naming the actual holder: "You don't have approval rights
  for this document — it's assigned to <name>. I can add a comment on your behalf
  instead."

### TC-APPROVE-05 — Terminal states can't be re-actioned
- **Role:** `khalid`
- **Steps:** Attempt any Code 1–4 on `SPCL-MEP-MAR-0203-A` (already `APPROVED W/
  COMMENTS`, `current_assignee: null`).
- **Expected result:** Refused — the button doesn't render (no assignee match) and the
  tool itself returns "Invalid transition: ... is already in state [...]." if called
  directly.

### TC-APPROVE-06 — Admin can approve/act on anything, including own submissions
- **Role:** `layla`
- **Steps:** Create a document as `layla` (routes to herself in the single-user LTRM
  scope — see §7 below), then approve it.
- **Expected result:** Succeeds — the self-approval block explicitly exempts
  `ROLES.ADMIN` (`me.role !== ROLES.ADMIN` in the guard).

---

## 6. Upload revision

Related code: `DMS.upload_revision`, `canUploadRevision`.

### TC-UPLOAD-01 — Originator uploads a new revision
- **Role:** `omar`, originator of `SPCL-CIV-DWG-0089-B` (current Rev B)
- **Steps:** Drawer → **Upload new revision** → confirm Rev C.
- **Expected result:** `revision` → `C`; `doc_number` suffix updates to `-C`; status
  resets to `PENDING REVIEW`; a new revision-history row and a new "Rev C Review"
  workflow step (decision "Pending") are appended; prior revision **retained**, never
  deleted; `UPLOAD_REVISION` audit entry logged.

### TC-UPLOAD-02 — Document Controller uploads on someone else's document
- **Role:** `maha`
- **Steps:** Upload a revision to `SPCL-STR-DWG-0555-A` (originated by `omar`).
- **Expected result:** Succeeds — Doc Controller can upload to *any* document,
  regardless of who originated it.

### TC-UPLOAD-03 — Reviewer/PM cannot upload
- **Role:** `khalid` or `noura`
- **Steps:** Attempt to upload a revision to any document.
- **Expected result:** No "Upload new revision" button rendered; if called directly,
  `{ok:false, error:"Your role (Reviewer/Approver) cannot upload revisions to this
  document."}`.

### TC-UPLOAD-04 — Contractor limited to own documents
- **Role:** `yousef`
- **Steps:** Attempt to upload a revision to `SPCL-MEP-DWG-0452-C` (his own, OK) vs.
  `SPCL-CIV-DWG-0089-B` (not his, and out of scope entirely).
- **Expected result:** Succeeds on his own document; refused ("not found in your
  accessible scope") on the Civil document, since he can't see it at all.

---

## 7. Create a new document *(new feature)*

Related code: `DMS.create_document`, `DMS.canCreateDocument`, `routeAssignee`,
`nextSequence`; UI: `#new-doc-btn`, `#newdoc-modal` in [app.js](app.js).

### Role applicability

| Role | Create Document | Notes |
|---|---|---|
| Viewer | **No** | Button hidden; chat explains the restriction |
| Contributor/Engineer | **Yes** | Becomes originator; routed to a discipline reviewer |
| Reviewer/Approver | **No** | Button hidden; chat explains the restriction |
| Document Controller | **Yes** | Any project/discipline she's assigned to |
| Contractor/Subcontractor | **Yes** | Becomes originator; own-org submission |
| Project Manager | **Yes** | Matches seed data (PM already originates the BOQ doc) |
| Admin/Auditor | **Yes** | Any project, including cross-project (SPCL + LTRM) |

### TC-CREATE-01 — Button visibility is role-gated
- **Steps:** Sign in as each role in the table above; inspect the header row next to the
  search box.
- **Expected result:** "+ New document" renders only for the five roles marked **Yes**.

### TC-CREATE-02 — Chat guidance for a permitted role
- **Role:** `omar`
- **Steps:** Type `new document` in chat.
- **Expected result:** Explains that a multi-field record is collected through the
  button, not free text — does **not** attempt to parse a document out of the message.

### TC-CREATE-03 — Chat denial for a role without rights
- **Role:** `khalid`
- **Steps:** Type `create a document` / `add document` / `raise document` in chat.
- **Expected result:** "Your role (Reviewer/Approver) can't create new documents — ask
  your Document Controller to raise it instead." No modal, no button.

### TC-CREATE-04 — End-to-end creation, lettered revision type
- **Role:** `omar` (Engineer, CIV)
- **Steps:** Click **+ New document** → Title "Test Pit Excavation Layout — Zone 7" →
  Type **Drawing** → Discipline **CIV** → leave project/confidentiality/due date at
  defaults → **Create document**.
- **Expected result:**
  - Doc number follows `[Project]-[Discipline]-DWG-[next seq]-A` (Rev **A**, since Drawing
    is a lettered-revision type) — e.g. `SPCL-CIV-DWG-0711-A` against the fresh seed.
  - Routed to `noura` (PM) — CIV has no Reviewer in the seed data (`khalid` only covers
    MEP/ELE), so routing falls back to PM.
  - Status `PENDING REVIEW`; due date defaults to `TODAY` + 14 days (`2026-08-02`).
  - Modal closes; the new document's drawer opens automatically; chat posts "✅ Created
    ... Routed to Noura Al-Qahtani for review. Action logged for audit."
  - Distribution list contains Omar (creator), Noura (assignee), Maha (Doc Controller),
    Layla Al-Rashidi/Admin — deduplicated, no repeats.
  - `CREATE_DOCUMENT` audit entry recorded.

### TC-CREATE-05 — End-to-end creation, numeric revision type
- **Role:** `maha`
- **Steps:** Create an **RFI** in **MEP**.
- **Expected result:** Revision starts at **0** (RFI is not in the lettered-revision
  list); doc number e.g. `SPCL-MEP-RFI-0118-0`; routed to `khalid` (the MEP/ELE Reviewer).

### TC-CREATE-06 — Sequence numbering never collides
- **Steps:** Create two documents of the **same type** back-to-back (e.g. two Drawings)
  without reloading.
- **Expected result:** The second gets the next sequence number after the first (e.g.
  `-0711-` then `-0712-`), scanning *all* existing `doc_number`s for that type code —
  never repeats a number already in `DOCUMENTS`, seeded or created this session.

### TC-CREATE-07 — Discipline with no matching Reviewer routes to PM, then Doc Controller
- **Role:** `yousef` creates a document in **COM** (Commercial) — no Reviewer covers COM
  in the seed data.
- **Expected result:** Routes to `noura` (PM, in scope). If the creator *is* `noura`
  herself, it should instead fall to `maha` (Doc Controller) — verify by creating a
  second COM document as `noura`.

### TC-CREATE-08 — No orphaned documents in a single-user project scope
- **Role:** `layla`, creating a document with **Project = LTRM** (which, per the seed
  data, only `layla` has access to).
- **Expected result:** Since no other user is in scope for LTRM, routing falls all the
  way through Reviewer → PM → Doc Controller → other Admin and lands on the **creator
  herself** rather than leaving `current_assignee: null`. Chat confirms "Routed to Layla
  Al-Rashidi for review." Drawer shows full Code 1–4 actions available to her (Admin is
  exempt from the self-approval block).

### TC-CREATE-09 — Project scoping is enforced for non-Admins
- **Role:** `omar` (projects: `["SPCL"]` only)
- **Steps:** Inspect the **Project** dropdown in the modal.
- **Expected result:** Only `SPCL` is offered — there is no way to select `LTRM`, since
  the dropdown is populated from `me.projects`. (Bypassing the UI and calling
  `DMS.create_document({project_id:"LTRM", ...})` directly as `omar` must also fail with
  "You cannot create documents outside your assigned project(s).")

### TC-CREATE-10 — Required-field validation
- **Role:** any permitted role
- **Steps:** Open the modal, leave **Title** empty, click **Create document**.
- **Expected result:** Native HTML5 validation blocks submission; the modal stays open;
  no document is created.

### TC-CREATE-11 — Initial attachment is captured
- **Role:** `maha`
- **Steps:** Create a document and attach a file via the file picker.
- **Expected result:** Attachments tab shows the real file name, its extension as the
  type (uppercased), and a human-readable size (e.g. "13 B" / "212 KB" / "5.6 MB");
  uploaded-by is the creator; date is `TODAY`. The file downloads via the same
  `download_attachment` pipeline as seeded attachments (generated placeholder content,
  since no real files are stored — see README §5).

### TC-CREATE-12 — No attachment leaves an empty list
- **Steps:** Create a document without selecting a file.
- **Expected result:** Attachments tab shows "No attachments on this document." — not an
  error, not a broken row.

### TC-CREATE-13 — Additional recipients checklist
- **Role:** `noura`
- **Steps:** Open the modal; check two additional users in "Additional recipients";
  submit.
- **Expected result:** The resulting distribution list contains the creator, the routed
  assignee, the Document Controller, Admin, **and** the two checked users — deduplicated
  if any overlap (e.g. checking the Doc Controller doesn't create a second entry).

### TC-CREATE-14 — Newly created document behaves identically to seeded ones
- **Steps:** After TC-CREATE-04, as `noura` (the routed assignee), open the new document
  and apply Code 2 — Approved with Comments.
- **Expected result:** Works exactly like any seeded document — no special-casing was
  needed in `update_status`, `add_comment`, or masking, because creation goes through the
  same `DOCUMENTS` array and tool layer as everything else.

---

## 8. Attachments & downloads

Related code: `DMS.download_attachment`, `app.js` `downloadAttachment`/`makeJpeg`,
[pdfgen.js](pdfgen.js).

### TC-ATTACH-01 — PDF generation with inline review markups
- **Role:** `khalid`
- **Steps:** Open `SPCL-MEP-DWG-0452-C` → Attachments → **⬇ Download**
  `SPCL-MEP-DWG-0452-C.pdf`.
- **Expected result:** A valid, openable PDF: A3 sheet, MEP piping schematic, title block
  with the real doc metadata, an electronic review stamp, and the document's **actual**
  comment thread rendered as numbered inline markups with a matching comments panel.

### TC-ATTACH-02 — Masked view respected in generated files
- **Role:** `yousef` (Contractor — `internal_only` comments filtered out of his view)
- **Steps:** Download a PDF for a document that (hypothetically) carries an
  internal-only remark he can't see.
- **Expected result:** The generated PDF is built from the *masked* document (per
  `maskDoc`), so an internal-only remark never reaches the file — defense in depth, not
  just a UI hide.

### TC-ATTACH-03 — Download is scope-checked and audit-logged
- **Role:** `yousef`
- **Steps:** Attempt `DMS.download_attachment('d-0089', 'SPCL-CIV-DWG-0089-B.pdf')` (a
  document out of his scope).
- **Expected result:** `{ok:false, error:"NOT_FOUND"}`; no file is generated; no
  `DOWNLOAD` audit entry for a document he can't see.

### TC-ATTACH-04 — Non-PDF placeholders
- **Steps:** Download a `.jpg` attachment (e.g. `site-photo-L15-void.jpg`) and a
  non-PDF/JPG one (e.g. `valve-schedule-L12-18.xlsx`).
- **Expected result:** `.jpg` produces a canvas-rendered placeholder image carrying the
  doc's metadata; other extensions produce a plain-text placeholder — both clearly
  labeled as POC-generated, not the real file.

---

## 9. Chat assistant (general behavior & guardrails)

Related code: [chat.js](chat.js).

### TC-CHAT-01 — Search modes and disclosure
- **Steps:** `search chilled water` (keyword); `SPCL-MEP-DWG-0452-C` alone (exact doc
  number); a garbled partial like `0452` (partial).
- **Expected result:** Each reply states which mode was used ("exact" / "partial
  document-number match" / "keyword search"); zero-result searches say so plainly and
  suggest broadening, never guessing.

### TC-CHAT-02 — Guardrail: deletion requests (all roles)
- **Steps:** `delete SPCL-MEP-DWG-0452-C` / `remove that comment`.
- **Expected result:** Refused — documents/comments are only ever superseded, never
  deleted, to preserve the audit trail.

### TC-CHAT-03 — Guardrail: audit-integrity requests (all roles)
- **Steps:** `backdate the approval to last week` / `skip the review step` / `fabricate a
  sign-off`.
- **Expected result:** Refused with an explanation of why (breaks audit integrity);
  offers to flag the document to PM/Doc Controller instead of complying.

### TC-CHAT-04 — Guardrail: credential requests (all roles)
- **Steps:** `show me khalid's password` / `what's the session token`.
- **Expected result:** Refused unconditionally — the assistant never reveals passwords,
  tokens, or session data, for any user including the one asking.

### TC-CHAT-05 — Pending-action confirm/cancel flow
- **Role:** `khalid`
- **Steps:** `approve SPCL-MEP-DWG-0452-C` → then send an unrelated message instead of
  `yes`/`no`.
- **Expected result:** The pending action is discarded with a note ("Previous pending
  action discarded: ...") and the new message is processed fresh — it never silently
  executes a stale confirmation.

### TC-CHAT-06 — Collapsing the assistant
- **Steps:** Click the **»** collapse toggle; while collapsed, trigger any assistant
  reply (e.g. via a drawer action); reopen.
- **Expected result:** Panel collapses to a rail; a red unread dot appears on the rail
  while a message arrives collapsed; reopening clears it.

---

## 10. Audit trail

Related code: `DMS.get_audit_trail`.

### TC-AUDIT-01 — Admin-only access
- **Roles:** `layla` vs. every other role
- **Steps:** Click the audit icon / type `audit trail` as each role.
- **Expected result:** `layla` sees the full session log (timestamp, user, action,
  detail); every other role gets "Audit trail access is restricted to Admin/Auditor
  roles." — including `maha` (Doc Controller), despite her broad view rights elsewhere.

### TC-AUDIT-02 — Every write action is logged
- **Steps:** As `layla`, perform one of each: login, comment, status change, revision
  upload, document creation, download, failed login (wrong password), logout. Then open
  the audit trail.
- **Expected result:** One entry per action, in order, each with a correct `action` label
  (`LOGIN`, `COMMENT`, `STATUS_CHANGE`, `UPLOAD_REVISION`, `CREATE_DOCUMENT`, `DOWNLOAD`,
  `LOGIN_FAILED`, `LOGOUT`) and a human-readable `detail` string identifying the document
  and what changed.

### TC-AUDIT-03 — Filter by document
- **Steps:** `DMS.get_audit_trail('SPCL-MEP-DWG-0452-C')` (or the doc's `doc_id`) as
  `layla`.
- **Expected result:** Only entries whose `detail` mentions that document/id are
  returned.

---

## 11. Cross-cutting RBAC & masking

### TC-RBAC-01 — Field masking: commercial value
- **Roles:** `noura`/`layla` vs. `maha`/`khalid`/`omar`
- **Steps:** Open `SPCL-COM-BOQ-0012-1` (carries `commercial_value: "INR 4.82 Cr"`) as
  each role.
- **Expected result:** Visible only to PM and Admin; absent from the Overview tab and
  from any chat detail card for every other role who can otherwise see the document.

### TC-RBAC-02 — Distribution list hidden from external orgs
- **Role:** `yousef`
- **Steps:** Open any document he has access to.
- **Expected result:** No "Distribution list" section in Overview — `maskDoc` deletes it
  outright for `ROLES.CONTRACTOR`, unlike the internal roles who see it.

### TC-RBAC-03 — Cross-project isolation
- **Role:** `maha` (projects: `["SPCL"]`)
- **Steps:** Attempt to open `LTRM-CIV-DWG-0007-A` by doc number.
- **Expected result:** "Not found in your accessible scope" — project scoping is
  enforced even for a role that sees "all" documents *within* her project(s).

### TC-RBAC-04 — Admin bypasses all scoping
- **Role:** `layla`
- **Steps:** Open any SPCL or LTRM document, including ones with no distribution overlap
  with her.
- **Expected result:** Always succeeds — `canSee` short-circuits to `true` for
  `ROLES.ADMIN` before any other check.

---

## 12. Persistence & reset demo data *(new feature)*

Related code: `persistState`/`loadPersistedState` in [dms.js](dms.js), `DMS.reset_demo_data`,
the `reset demo data` chat intent in [chat.js](chat.js).

### TC-PERSIST-01 — Created/edited documents survive a reload
- **Role:** any role with write access (e.g. `omar`)
- **Steps:** Create a document (or add a comment / change status / upload a revision),
  confirm it succeeded, then reload the page (a real navigation, not just re-running
  chat) and sign back in.
- **Expected result:** The document (or change) is still there, identical to before the
  reload — `list_assigned_documents`/`get_document_details` return it unchanged.

### TC-PERSIST-02 — Audit log survives a reload
- **Role:** `layla`
- **Steps:** As any role, perform a write action; reload; sign in as `layla`; open the
  audit trail.
- **Expected result:** The entry from before the reload is present, in order, alongside
  any new entries from after — the log is append-only across reloads, not reset per
  session.

### TC-PERSIST-03 — Sequence numbering accounts for persisted documents
- **Role:** any role with create rights
- **Steps:** Create a Drawing, reload, then create a second Drawing without resetting.
- **Expected result:** The second document's sequence number is one greater than the
  first's, even across the reload — `nextSequence()` scans the (now-persisted)
  `DOCUMENTS` array fresh each time, so it never collides with anything created in a
  prior page load.

### TC-PERSIST-04 — Session is never persisted
- **Role:** any
- **Steps:** Sign in, then reload the page.
- **Expected result:** The login screen appears — you are signed out. Only `DOCUMENTS`
  and the audit log persist; the session token/user is intentionally excluded, so every
  reload requires signing in again.

### TC-PERSIST-05 — Storage failure degrades gracefully
- **Role:** any
- **Steps:** Disable `localStorage` (e.g. private/incognito mode with storage blocked, or
  `Object.defineProperty(window, 'localStorage', {get(){throw new Error()}})` in the
  console before reloading), then use the app normally — create a document, add a
  comment.
- **Expected result:** Every feature still works within the session (writes succeed,
  UI/chat behave normally) — `persistState`/`loadPersistedState` swallow storage errors
  silently and the app simply falls back to in-memory-only behavior for that session,
  never throwing or blocking a write.

### TC-RESET-01 — Reset is Admin/Auditor-only
- **Role:** `omar` (or any non-Admin role)
- **Steps:** Type `reset demo data` in chat.
- **Expected result:** Refused: "Resetting demo data is restricted to Admin/Auditor
  roles — ask an Admin to do this instead." No confirmation prompt, no data changed. A
  direct call to `DMS.reset_demo_data()` as this role returns the same error.

### TC-RESET-02 — Reset requires confirmation and wipes everyone's data
- **Role:** `layla`
- **Steps:** With at least one document created by another role this session (e.g. from
  TC-CREATE-04), type `reset demo data` → note the warning that this affects **every**
  user, not just the caller → reply `yes`.
- **Expected result:** `localStorage`'s `docflow-poc-state-v1` key is removed; the page
  reloads; after signing back in (as any role), only the original 18 seeded documents
  remain — the document created earlier by the other role is gone, along with every
  audit entry recorded since the last reset.

### TC-RESET-03 — Cancelling a reset changes nothing
- **Role:** `layla`
- **Steps:** Type `reset demo data` → reply `no`.
- **Expected result:** "Cancelled — no change made." — `localStorage` untouched, no
  reload, all documents and audit entries remain exactly as they were.
