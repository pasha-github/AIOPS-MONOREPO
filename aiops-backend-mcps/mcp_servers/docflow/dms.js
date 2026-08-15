// ============================================================
// DocFlow AI — Mock backend (POC)
// Implements the spec §6 tool functions over the in-memory data
// store, enforcing the §4 role matrix and §9 audit rules. State
// is mirrored to localStorage so it survives a page reload (no
// real backend yet — see persistState()/loadPersistedState()).
// Every function returns {ok, data|error} and never throws.
// ============================================================

const DMS = (() => {
  const AUDIT_LOG = [];
  let session = null; // {user, token, login_at} — never persisted; every reload requires fresh login

  // ---------- persistence ----------
  // Primary store is the shared SQLite database behind server/app.py, reached
  // through API (api.js): every mutation updates the local DOCUMENTS array
  // first (so the §6 tool functions stay synchronous for all their existing
  // call sites) and is then pushed to the server, where other users' browsers
  // pick it up. If the server isn't reachable — index.html opened over
  // file://, or a plain `python -m http.server` with no backend — we fall
  // back to the original single-browser localStorage mirror.
  const STORAGE_KEY = "docflow-poc-state-v1";
  const SEED_DOCUMENTS = JSON.parse(JSON.stringify(DOCUMENTS));

  const serverMode = () => typeof API !== "undefined" && API.online;

  function persistState() {
    if (serverMode()) return; // server mode persists per-entity, not wholesale
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ documents: DOCUMENTS, auditLog: AUDIT_LOG }));
    } catch (e) {
      // Storage unavailable/full (private browsing, quota) — degrade to in-memory only.
    }
  }

  // Push a single changed document. Per-document writes mean two users
  // editing two different documents no longer clobber each other the way a
  // whole-store rewrite would; concurrent edits to the *same* document are
  // still last-write-wins (see DEPLOY.md).
  function persistDoc(doc) {
    if (serverMode()) API.saveDoc(doc);
    else persistState();
  }

  function loadPersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.documents)) {
        DOCUMENTS.length = 0;
        DOCUMENTS.push(...saved.documents);
      }
      if (saved && Array.isArray(saved.auditLog)) {
        AUDIT_LOG.push(...saved.auditLog);
      }
    } catch (e) {
      // Corrupted/unavailable storage — fall back to the seed data untouched.
    }
  }

  // Replace the working set with whatever the server holds. Called at boot
  // and by the background poll that surfaces other users' changes.
  function hydrate(state) {
    if (!state) return;
    if (Array.isArray(state.documents)) {
      DOCUMENTS.length = 0;
      DOCUMENTS.push(...state.documents);
    }
    if (Array.isArray(state.audit)) {
      AUDIT_LOG.length = 0;
      AUDIT_LOG.push(...state.audit);
    }
  }

  // Boot sequence: try the shared server, seeding it from data.js the first
  // time it comes up empty; otherwise fall back to localStorage. Returns the
  // storage mode so the UI can tell the user which one they're on.
  async function connect() {
    if (typeof API === "undefined") {
      loadPersistedState();
      return { mode: "local" };
    }
    let state = await API.connect();
    if (!state) {
      loadPersistedState();
      return { mode: "local" };
    }
    if (!state.seeded) {
      try {
        await API.seed(SEED_DOCUMENTS);
        state = await API.fetchState();
      } catch (e) {
        // Another browser seeded it first, or the write failed — re-read.
        state = await API.fetchState();
      }
    }
    hydrate(state);
    return { mode: "server", documents: DOCUMENTS.length };
  }

  // Turn metadata-only attachments into real stored files.
  //
  // The seeded register describes 30-odd attachments that never had bytes, so
  // they had no URL and the table could only show a filename — useless if you
  // want to hand someone a link. This generates each one's placeholder with
  // the same generator the download path uses, uploads it, and records the
  // resulting file_id, so *every* attachment in the register has a real URL
  // that opens without a DocFlow session.
  //
  // Runs on already-seeded databases too, so an existing deployment is
  // backfilled on the next connect rather than needing a reset. Two browsers
  // doing this simultaneously would each upload a copy and the later write
  // wins, orphaning the other's blobs — wasteful, not harmful, and only
  // possible in the one window before the first backfill completes.
  async function materializeAttachments(makePlaceholder) {
    if (!serverMode() || typeof makePlaceholder !== "function") return 0;
    const jobs = [];
    DOCUMENTS.forEach((doc) =>
      (doc.attachments || []).forEach((a) => {
        if (!a.file_id) jobs.push({ doc, attachment: a });
      })
    );
    if (!jobs.length) return 0;

    let stored = 0;
    await Promise.all(
      jobs.map(async ({ doc, attachment }) => {
        try {
          const blob = makePlaceholder(doc, attachment);
          const file = new File([blob], attachment.file_name, { type: blob.type });
          const saved = await API.uploadFile(file, attachment.uploaded_by || "seed");
          attachment.file_id = saved.file_id;
          stored += 1;
        } catch (e) {
          // Leave it metadata-only; its link keeps working via the
          // generate-on-click path, it just isn't shareable.
          console.warn(`[docflow] could not store ${attachment.file_name}:`, e.message);
        }
      })
    );

    new Set(jobs.map((j) => j.doc)).forEach((doc) => API.saveDoc(doc));
    await API.flush();
    return stored;
  }

  // Pull the latest shared state so one user sees another's comments and
  // approvals without a reload. No-op outside server mode.
  async function sync() {
    if (!serverMode()) return false;
    try {
      hydrate(await API.fetchState());
      return true;
    } catch (e) {
      return false;
    }
  }

  // Wipes the persisted state so the next reload starts from the seed data
  // in data.js again. Admin-only — it discards every user's created/edited
  // documents and the audit log, not just the caller's own. In server mode
  // that means *globally*, for every browser pointed at this deployment.
  function reset_demo_data() {
    const authErr = requireAuth();
    if (authErr) return authErr;
    if (session.user.role !== ROLES.ADMIN) {
      return { ok: false, error: "Resetting demo data is restricted to Admin/Auditor roles." };
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore — nothing to remove if storage was never available
    }
    if (serverMode()) {
      return {
        ok: true,
        pending: API.flush()
          .then(() => API.reset())
          .then(() => API.seed(SEED_DOCUMENTS))
          .then(() => API.fetchState())
          .then(hydrate),
      };
    }
    return { ok: true };
  }

  const userById = (id) => USERS.find((u) => u.user_id === id);
  const nameOf = (id) => (userById(id) ? userById(id).display_name : id || "—");

  function log(action, detail) {
    const entry = {
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      user: session ? session.user.user_id : "anonymous",
      action,
      detail,
    };
    AUDIT_LOG.push(entry);
    if (serverMode()) API.saveAudit(entry);
    else persistState();
  }

  // ---------- visibility & permission rules (§4) ----------

  function canSee(user, doc) {
    if (user.role === ROLES.ADMIN) return true;
    if (!user.projects.includes(doc.project_id)) return false;
    if (user.role === ROLES.DOC_CONTROLLER || user.role === ROLES.PM) return true;
    if (user.role === ROLES.CONTRACTOR) {
      // External orgs: own submissions + explicitly distributed docs only
      return doc.originator === user.user_id || doc.distribution_list.includes(user.user_id);
    }
    if (user.role === ROLES.VIEWER) return doc.distribution_list.includes(user.user_id);
    // Engineer / Reviewer: assigned, authored, distributed, or own discipline
    return (
      doc.current_assignee === user.user_id ||
      doc.originator === user.user_id ||
      doc.distribution_list.includes(user.user_id) ||
      user.disciplines.includes("ALL") ||
      user.disciplines.includes(doc.discipline)
    );
  }

  function canComment(user, doc) {
    return user.role !== ROLES.VIEWER && canSee(user, doc);
  }

  function canApprove(user, doc) {
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.REVIEWER || user.role === ROLES.PM) {
      if (doc.originator === user.user_id) return false; // no self-approval
      return doc.current_assignee === user.user_id;
    }
    return false;
  }

  function canUploadRevision(user, doc) {
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.DOC_CONTROLLER) return true;
    if (user.role === ROLES.ENGINEER || user.role === ROLES.CONTRACTOR) {
      return doc.originator === user.user_id;
    }
    return false;
  }

  // Same roles that can upload a revision may also originate a brand-new
  // document (creating one is just Rev A/0 of a record that doesn't exist
  // yet) — plus PM, who already originates commercial/BOQ documents.
  function canCreateDocument(user) {
    return [ROLES.ADMIN, ROLES.DOC_CONTROLLER, ROLES.ENGINEER, ROLES.CONTRACTOR, ROLES.PM].includes(user.role);
  }

  // Field masking (§2 authorization rules): commercial values and
  // internal-only remarks are hidden from roles not entitled to them.
  function maskDoc(user, doc) {
    const clone = JSON.parse(JSON.stringify(doc));
    const commercialRoles = [ROLES.PM, ROLES.ADMIN];
    if (clone.commercial_value && !commercialRoles.includes(user.role)) {
      delete clone.commercial_value;
    }
    if (user.role === ROLES.CONTRACTOR) {
      clone.comments = clone.comments.filter((c) => !c.internal_only);
      delete clone.distribution_list;
    } else {
      clone.comments = clone.comments.filter(
        (c) => !c.internal_only || commercialRoles.includes(user.role) || c.author === user.user_id
      );
    }
    return clone;
  }

  function requireAuth() {
    if (!session) return { ok: false, error: "NOT_AUTHENTICATED" };
    return null;
  }

  // ---------- §6 tool functions ----------

  function authenticate_user(username, password) {
    const user = USERS.find(
      (u) => u.username.toLowerCase() === String(username).trim().toLowerCase()
    );
    if (!user || user.password !== password) {
      const entry = {
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        user: "anonymous",
        action: "LOGIN_FAILED",
        detail: `username=${username}`,
      };
      AUDIT_LOG.push(entry);
      if (serverMode()) API.saveAudit(entry);
      else persistState();
      return { ok: false, error: "Invalid username or password." };
    }
    session = { user, token: "tok-" + Math.random().toString(36).slice(2), login_at: Date.now() };
    log("LOGIN", `role=${user.role}`);
    return {
      ok: true,
      data: {
        user_id: user.user_id,
        display_name: user.display_name,
        role: user.role,
        org: user.org,
        projects: user.projects,
        disciplines: user.disciplines,
      },
    };
  }

  function logout() {
    if (session) log("LOGOUT", "");
    session = null;
    return { ok: true };
  }

  function list_assigned_documents(status_filter) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    let docs = DOCUMENTS.filter(
      (d) =>
        canSee(me, d) &&
        (d.current_assignee === me.user_id ||
          d.originator === me.user_id ||
          d.distribution_list.includes(me.user_id))
    );
    if (status_filter) {
      const f = status_filter.toUpperCase();
      docs = docs.filter((d) => effectiveStatus(d).includes(f));
    }
    docs = docs.slice().sort(byUrgency);
    log("LIST_ASSIGNED", `count=${docs.length} filter=${status_filter || "none"}`);
    return { ok: true, data: docs.map((d) => maskDoc(me, d)) };
  }

  function search_documents({ query, doc_number, filters } = {}) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    let docs = DOCUMENTS.filter((d) => canSee(me, d));
    let mode = "keyword";

    if (doc_number) {
      const dn = doc_number.trim().toUpperCase();
      const exact = docs.filter((d) => d.doc_number.toUpperCase() === dn);
      if (exact.length) {
        log("SEARCH", `doc_number=${dn} exact`);
        return { ok: true, data: exact.map((d) => maskDoc(me, d)), mode: "exact" };
      }
      // fall back to partial doc-number match, then keyword
      const partial = docs.filter((d) => d.doc_number.toUpperCase().includes(dn));
      if (partial.length) {
        log("SEARCH", `doc_number=${dn} partial`);
        return { ok: true, data: partial.sort(byUrgency).map((d) => maskDoc(me, d)), mode: "partial" };
      }
      query = query || doc_number;
      mode = "fuzzy";
    }

    if (query) {
      const q = query.trim().toLowerCase();
      docs = docs.filter(
        (d) =>
          d.doc_number.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q) ||
          d.comments.some((c) => c.text.toLowerCase().includes(q))
      );
    }
    if (filters) {
      if (filters.status) docs = docs.filter((d) => effectiveStatus(d).includes(filters.status.toUpperCase()));
      if (filters.discipline) docs = docs.filter((d) => d.discipline === filters.discipline.toUpperCase());
      if (filters.type) docs = docs.filter((d) => d.type.toLowerCase().includes(filters.type.toLowerCase()));
    }
    docs = docs.slice().sort(byUrgency);
    log("SEARCH", `query=${query || ""} results=${docs.length}`);
    return { ok: true, data: docs.map((d) => maskDoc(me, d)), mode };
  }

  function get_document_details(doc_id_or_number) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    const key = String(doc_id_or_number).trim().toUpperCase();
    const doc = DOCUMENTS.find(
      (d) => d.doc_id.toUpperCase() === key || d.doc_number.toUpperCase() === key
    );
    // Never reveal out-of-scope existence (§2): same "not found" either way.
    if (!doc || !canSee(me, doc)) {
      log("OPEN_DENIED_OR_MISSING", key);
      return { ok: false, error: "NOT_FOUND" };
    }
    log("OPEN", doc.doc_number);
    return {
      ok: true,
      data: maskDoc(me, doc),
      permissions: {
        comment: canComment(me, doc),
        approve: canApprove(me, doc),
        upload: canUploadRevision(me, doc),
      },
    };
  }

  function add_comment(doc_id, text) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    const doc = DOCUMENTS.find((d) => d.doc_id === doc_id || d.doc_number === doc_id);
    if (!doc || !canSee(me, doc)) return { ok: false, error: "NOT_FOUND" };
    if (!canComment(me, doc)) {
      return { ok: false, error: `Your role (${me.role}) does not permit commenting on this document.` };
    }
    const comment = {
      author: me.user_id,
      role: me.role,
      timestamp: nowStamp(),
      text: String(text).trim(),
    };
    doc.comments.push(comment);
    persistDoc(doc);
    log("COMMENT", `${doc.doc_number}: ${comment.text.slice(0, 80)}`);
    return { ok: true, data: comment, doc };
  }

  const REVIEW_CODES = {
    "1": { status: "APPROVED", label: "Code 1 — Approved" },
    "2": { status: "APPROVED W/ COMMENTS", label: "Code 2 — Approved with Comments" },
    "3": { status: "REVISE & RESUBMIT", label: "Code 3 — Revise & Resubmit" },
    "4": { status: "REJECTED", label: "Code 4 — Rejected" },
  };

  function update_status(doc_id, review_code) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    const doc = DOCUMENTS.find((d) => d.doc_id === doc_id || d.doc_number === doc_id);
    if (!doc || !canSee(me, doc)) return { ok: false, error: "NOT_FOUND" };
    if (doc.originator === me.user_id && me.role !== ROLES.ADMIN) {
      return { ok: false, error: "Workflow rule: originators cannot action their own submission." };
    }
    if (!canApprove(me, doc)) {
      const holder = doc.current_assignee ? nameOf(doc.current_assignee) : "the assigned reviewer";
      return {
        ok: false,
        error: `You don't have approval rights for this document — it's assigned to ${holder}. I can add a comment on your behalf instead.`,
      };
    }
    const terminal = ["APPROVED", "APPROVED W/ COMMENTS", "REJECTED", "CLOSED", "SUPERSEDED"];
    if (terminal.includes(doc.status)) {
      return { ok: false, error: `Invalid transition: ${doc.doc_number} is already in state [${doc.status}].` };
    }
    const code = REVIEW_CODES[String(review_code)];
    if (!code) return { ok: false, error: "Review code must be 1, 2, 3, or 4." };

    doc.status = code.status;
    doc.workflow_trail = doc.workflow_trail.map((s) =>
      s.decision === "Pending" ? { ...s, actor: me.user_id, decision: code.label, date: TODAY } : s
    );
    if (code.status === "APPROVED" || code.status === "APPROVED W/ COMMENTS") {
      doc.closed_date = TODAY;
      doc.current_assignee = null;
    } else {
      doc.current_assignee = doc.originator; // back to originator to revise
    }
    persistDoc(doc);
    log("STATUS_CHANGE", `${doc.doc_number} → ${code.label}`);
    return { ok: true, data: { doc, code } };
  }

  // `stored` is the optional {file_id, size} returned by API.uploadFile when a
  // real file was picked; without it the attachment is metadata-only and the
  // UI falls back to generating a placeholder at open time.
  function upload_revision(doc_id, file_ref, revision_label, stored) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    const doc = DOCUMENTS.find((d) => d.doc_id === doc_id || d.doc_number === doc_id);
    if (!doc || !canSee(me, doc)) return { ok: false, error: "NOT_FOUND" };
    if (!canUploadRevision(me, doc)) {
      return { ok: false, error: `Your role (${me.role}) cannot upload revisions to this document.` };
    }
    const prev = doc.revision;
    doc.revision = revision_label;
    doc.status = "PENDING REVIEW";
    doc.doc_number = doc.doc_number.replace(/-[A-Z0-9]+$/, "-" + revision_label);
    doc.revision_history.push({
      revision: revision_label,
      date: TODAY,
      change_summary: `New revision uploaded (${file_ref}). Supersedes Rev ${prev}.`,
      uploaded_by: me.user_id,
    });
    doc.workflow_trail.push({
      step: `Rev ${revision_label} Review`,
      actor: doc.workflow_trail.length ? doc.workflow_trail[doc.workflow_trail.length - 1].actor : null,
      decision: "Pending",
      date: null,
    });
    doc.attachments.push({
      file_name: file_ref,
      type: (file_ref.split(".").pop() || "FILE").toUpperCase(),
      size: (stored && stored.size) || "—",
      uploaded_by: me.user_id,
      date: TODAY,
      file_id: (stored && stored.file_id) || null,
    });
    persistDoc(doc);
    log("UPLOAD_REVISION", `${doc.doc_number} Rev ${prev} → ${revision_label}`);
    return { ok: true, data: doc };
  }

  function create_document({ title, type, discipline, project_id, confidentiality, due_date, distribution_list, file_name, file_size, file_id } = {}) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    if (!canCreateDocument(me)) {
      return { ok: false, error: `Your role (${me.role}) cannot create new documents. Ask your Document Controller to raise it instead.` };
    }
    title = String(title || "").trim();
    if (!title) return { ok: false, error: "A document title is required." };
    if (!TYPE_CODES[type]) return { ok: false, error: "Unrecognized document type." };
    if (!DISCIPLINES.includes(discipline)) return { ok: false, error: "Unrecognized discipline." };
    const proj = project_id || me.projects[0];
    if (!me.projects.includes(proj) && me.role !== ROLES.ADMIN) {
      return { ok: false, error: "You cannot create documents outside your assigned project(s)." };
    }

    const typeCode = TYPE_CODES[type];
    const seq = nextSequence(typeCode);
    const revision = LETTERED_REVISION_TYPES.includes(type) ? "A" : "0";
    const doc_number = `${proj}-${discipline}-${typeCode}-${seq}-${revision}`;
    const doc_id = `d-${seq}-${typeCode.toLowerCase()}`;
    const assignee = routeAssignee(discipline, proj, me.user_id);

    const dist = Array.from(
      new Set([me.user_id, assignee, "u-priya", "u-admin", ...(distribution_list || [])].filter(Boolean))
    );

    const doc = {
      doc_id,
      doc_number,
      title,
      type,
      discipline,
      revision,
      status: "PENDING REVIEW",
      project_id: proj,
      originator: me.user_id,
      originator_org: me.org,
      current_assignee: assignee,
      distribution_list: dist,
      submitted_date: TODAY,
      due_date: due_date || null,
      closed_date: null,
      confidentiality: confidentiality || "Internal",
      comments: [],
      revision_history: [
        { revision, date: TODAY, change_summary: "Initial issue for review.", uploaded_by: me.user_id },
      ],
      workflow_trail: [
        { step: `Rev ${revision} Review`, actor: assignee, decision: "Pending", date: null },
      ],
      attachments: file_name
        ? [{
            file_name,
            type: (file_name.split(".").pop() || "FILE").toUpperCase(),
            size: file_size || "—",
            uploaded_by: me.user_id,
            date: TODAY,
            // Set when the bytes were uploaded to the server; the table links
            // straight at /api/files/{file_id} and the browser opens the real
            // document. Null for seeded/metadata-only attachments.
            file_id: file_id || null,
          }]
        : [],
    };
    DOCUMENTS.push(doc);
    persistDoc(doc);
    log("CREATE_DOCUMENT", `${doc.doc_number}: ${title}`);
    return { ok: true, data: doc };
  }

  // Auto-route a new document to whoever should review it: the discipline's
  // Reviewer/Approver first, falling back to the PM, then the Document
  // Controller, then any other Admin in scope. If nobody else has access to
  // this project (e.g. a single-user project like the LTRM seed data), keep
  // it with the creator rather than leaving a PENDING doc with no owner.
  function routeAssignee(discipline, project_id, creatorId) {
    const inScope = (u) => u.user_id !== creatorId && u.projects.includes(project_id);
    const reviewer = USERS.find(
      (u) => u.role === ROLES.REVIEWER && inScope(u) && (u.disciplines.includes("ALL") || u.disciplines.includes(discipline))
    );
    if (reviewer) return reviewer.user_id;
    const pm = USERS.find((u) => u.role === ROLES.PM && inScope(u));
    if (pm) return pm.user_id;
    const dc = USERS.find((u) => u.role === ROLES.DOC_CONTROLLER && inScope(u));
    if (dc) return dc.user_id;
    const admin = USERS.find((u) => u.role === ROLES.ADMIN && inScope(u));
    if (admin) return admin.user_id;
    return creatorId;
  }

  // Next sequence number for a doc-type code, scanning existing doc_numbers
  // ([Project]-[Discipline]-[DocType]-[Sequence]-[Rev]) so new documents
  // never collide with seeded or previously-created ones.
  function nextSequence(typeCode) {
    let max = 0;
    DOCUMENTS.forEach((d) => {
      const parts = d.doc_number.split("-");
      if (parts.length >= 4 && parts[2] === typeCode) {
        const n = parseInt(parts[3], 10);
        if (!isNaN(n)) max = Math.max(max, n);
      }
    });
    return String(max + 1).padStart(4, "0");
  }

  function download_attachment(doc_id, file_name) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    const doc = DOCUMENTS.find((d) => d.doc_id === doc_id || d.doc_number === doc_id);
    if (!doc || !canSee(me, doc)) return { ok: false, error: "NOT_FOUND" };
    const attachment = (doc.attachments || []).find((a) => a.file_name === file_name);
    if (!attachment) return { ok: false, error: "Attachment not found on this document." };
    log("DOWNLOAD", `${doc.doc_number}: ${file_name}`);
    return { ok: true, data: { doc: maskDoc(me, doc), attachment } };
  }

  function get_audit_trail(doc_id) {
    const authErr = requireAuth();
    if (authErr) return authErr;
    const me = session.user;
    if (me.role !== ROLES.ADMIN) {
      return { ok: false, error: "Audit trail access is restricted to Admin/Auditor roles." };
    }
    const entries = doc_id
      ? AUDIT_LOG.filter((e) => e.detail.includes(doc_id))
      : AUDIT_LOG;
    return { ok: true, data: entries };
  }

  // ---------- helpers ----------

  function effectiveStatus(doc) {
    const open = !["APPROVED", "APPROVED W/ COMMENTS", "REJECTED", "CLOSED", "SUPERSEDED"].includes(doc.status);
    if (open && doc.due_date && doc.due_date < TODAY) return doc.status + " · OVERDUE";
    return doc.status;
  }

  function isOverdue(doc) {
    return effectiveStatus(doc).includes("OVERDUE");
  }

  function byUrgency(a, b) {
    const oa = isOverdue(a) ? 0 : 1;
    const ob = isOverdue(b) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const da = a.due_date || "9999-12-31";
    const db = b.due_date || "9999-12-31";
    return da < db ? -1 : da > db ? 1 : 0;
  }

  function nowStamp() {
    return TODAY + " " + new Date().toTimeString().slice(0, 5);
  }

  return {
    connect,
    sync,
    materializeAttachments,
    authenticate_user,
    logout,
    list_assigned_documents,
    search_documents,
    get_document_details,
    add_comment,
    update_status,
    upload_revision,
    create_document,
    canCreateDocument,
    download_attachment,
    get_audit_trail,
    reset_demo_data,
    effectiveStatus,
    isOverdue,
    nameOf,
    REVIEW_CODES,
    get session() {
      return session;
    },
  };
})();
