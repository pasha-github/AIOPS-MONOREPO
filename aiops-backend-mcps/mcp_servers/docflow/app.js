// ============================================================
// DocFlow AI — UI wiring (POC)
// Implements the "DocFlow AI.dc.html" design: split login,
// dark header, sidebar views/disciplines, stat tiles, document
// table, tabbed detail drawer, notifications, audit modal,
// confirm dialogs and the collapsible chat assistant.
// All data flows through the DMS.* tool layer — the UI never
// reads DOCUMENTS directly (defense in depth, spec §9).
// ============================================================

const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const escH = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ---- state ----
  let view = "all"; // all | pending | overdue | mine
  let disc = "";
  let activeTab = "overview";
  let currentDoc = null; // masked doc shown in drawer
  let currentPerms = null;
  const api = { lastOpenedDoc: null };

  // ---------------- shared helpers ----------------

  function statusMeta(d) {
    const raw = d.status;
    let cls = "pending";
    if (/^APPROVED/.test(raw)) cls = "approved";
    else if (raw === "UNDER REVIEW") cls = "review";
    else if (raw === "PENDING REVIEW") cls = "pending";
    else if (raw === "REVISE & RESUBMIT") cls = "revise";
    else if (raw === "REJECTED") cls = "rejected";
    else if (raw === "CLOSED" || raw === "SUPERSEDED") cls = "closed";
    const label = raw.replace("W/ COMMENTS", "w/ comments");
    return { cls, label: label.charAt(0) + label.slice(1).toLowerCase() };
  }

  function statusCell(d) {
    const m = statusMeta(d);
    return `<span class="tag ${m.cls}">${escH(m.label)}</span>${DMS.isOverdue(d) ? '<span class="od-flag">Overdue</span>' : ""}`;
  }

  function myDocs() {
    const res = DMS.list_assigned_documents();
    return res.ok ? res.data : [];
  }

  // Attachment links for the document table. Two kinds of link, deliberately
  // indistinguishable to the user:
  //   • file_id set  → a real href at /api/files/{id}; the browser opens the
  //     stored PDF/image in a new tab, and ctrl/middle-click work natively.
  //   • no file_id   → seeded (or pre-server) attachments whose bytes were
  //     never stored; the click handler generates the placeholder and opens
  //     that instead, so the link is never dead.
  // Either way the click is routed through DMS.download_attachment first for
  // the RBAC check and the audit entry.
  function attachmentLink(doc, a) {
    const common =
      `class="att-link" title="${escH(a.file_name)} · ${escH(a.size || "—")}"` +
      ` data-open="${escH(doc.doc_number)}" data-file="${escH(a.file_name)}"`;
    const icon = `<span class="att-chip">${escH((a.type || "FILE").slice(0, 4))}</span>`;
    if (a.file_id) {
      // The link reads "Open file" and carries the fully-qualified URL in its
      // href, so the column stays readable while Copy still yields a link that
      // works anywhere — the endpoint needs no DocFlow session. Which file it
      // is comes from the type chip and the hover title.
      const url = API.fileUrlAbsolute(a.file_id);
      return `<span class="att-item">
        <a ${common} href="${escH(url)}" target="_blank" rel="noopener" data-stored="1">
          ${icon}<span class="att-url">Open file</span></a>
        <button class="att-copy" type="button" data-copy="${escH(url)}" title="Copy link to clipboard">Copy</button>
      </span>`;
    }
    // No stored bytes — only reachable in offline mode now, where the click
    // generates the placeholder instead of fetching it.
    return `<span class="att-item"><a ${common} href="#">${icon}<span class="att-url">Open file</span></a></span>`;
  }

  function attachmentCell(d) {
    const list = d.attachments || [];
    if (!list.length) return `<span class="att-none">—</span>`;
    const shown = list.slice(0, 2).map((a) => attachmentLink(d, a)).join("");
    const extra = list.length > 2 ? `<span class="att-more">+${list.length - 2} more</span>` : "";
    return `<div class="att-links">${shown}${extra}</div>`;
  }

  // ---------------- login ----------------

  function renderDemoUsers() {
    $("demo-grid").innerHTML = (typeof USERS !== "undefined" ? USERS : [])
      .map(
        (u) => `<button type="button" class="demo-user" data-username="${escH(u.username)}">
          <span class="du-name">${escH(u.username)}</span>
          <span class="du-role">${escH(u.role)}</span>
        </button>`
      )
      .join("");
  }
  renderDemoUsers();

  $("demo-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".demo-user");
    if (!btn) return;
    $("login-user").value = btn.dataset.username;
    $("login-pass").value = "demo123";
    $("login-error").hidden = true;
  });

  $("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const res = DMS.authenticate_user($("login-user").value, $("login-pass").value);
    if (!res.ok) {
      $("login-error-text").textContent = res.error;
      $("login-error").hidden = false;
      $("login-pass").value = "";
      return;
    }
    $("login-error").hidden = true;
    $("login-pass").value = "";
    enterApp(res.data);
  });

  function enterApp(user) {
    view = "all";
    disc = "";
    $("filter-q").value = "";
    $("login-screen").style.display = "none";
    $("app").hidden = false;
    const initials = (user.display_name || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
    $("user-avatar").textContent = initials;
    $("user-name").textContent = user.display_name;
    $("user-role").textContent = user.role;
    $("audit-btn").hidden = user.role !== ROLES.ADMIN;
    $("new-doc-btn").hidden = !DMS.canCreateDocument(DMS.session.user);
    setChatOpen(true);
    $("chat-log").innerHTML = "";
    addMsg("ai", Chat.greeting(user).html);
    refresh();
  }

  function onLogout() {
    $("app").hidden = true;
    $("login-screen").style.display = "flex";
    $("login-user").value = "";
    $("login-pass").value = "";
    closeDrawer();
    closeBell();
    $("audit-modal").hidden = true;
    $("confirm-modal").hidden = true;
    pendingConfirm = null;
  }

  $("logout-btn").addEventListener("click", () => {
    DMS.logout();
    onLogout();
  });

  // ---------------- dashboard ----------------

  function refresh() {
    if (!DMS.session) return;
    renderSidebar();
    renderTiles();
    renderTable();
    renderBell();
    renderCrumb();
    if (currentDoc) {
      const det = DMS.get_document_details(currentDoc.doc_id);
      if (det.ok) {
        currentDoc = det.data;
        currentPerms = det.permissions;
        renderDrawerHead();
        renderDrawerTab(activeTab);
        renderDrawerActions();
      }
    }
    if (!$("audit-modal").hidden) renderAudit();
  }

  function renderCrumb() {
    if (!DMS.session) return;
    $("crumb").textContent =
      currentDoc
        ? `Project ${currentDoc.project_id} › ${currentDoc.discipline} › ${currentDoc.doc_number}`
        : `Project ${DMS.session.user.projects[0]} › ${disc || "All disciplines"}`;
  }

  function setView(v) {
    view = v;
    closeBell();
    refresh();
  }

  document.querySelectorAll("[data-view]").forEach((el) =>
    el.addEventListener("click", () => setView(el.dataset.view))
  );

  function renderSidebar() {
    const docs = myDocs();
    const me = DMS.session.user.user_id;
    $("count-all").textContent = docs.length;
    $("count-pending").textContent = docs.filter((d) => d.current_assignee === me).length;
    $("count-overdue").textContent = docs.filter((d) => DMS.isOverdue(d)).length;
    $("count-mine").textContent = docs.filter((d) => d.originator === me).length;
    document.querySelectorAll(".navitem[data-view]").forEach((b) =>
      b.classList.toggle("on", b.dataset.view === view)
    );

    const discCounts = {};
    docs.forEach((d) => { discCounts[d.discipline] = (discCounts[d.discipline] || 0) + 1; });
    const items = [
      `<button class="navitem ${disc === "" ? "on" : ""}" data-disc="">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span>All disciplines</span></button>`,
    ].concat(
      Object.keys(discCounts).sort().map(
        (name) => `<button class="navitem ${disc === name ? "on" : ""}" data-disc="${escH(name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
          <span>${escH(name)}</span><span class="nc">${discCounts[name]}</span></button>`
      )
    );
    $("disc-nav").innerHTML = items.join("");
  }

  $("disc-nav").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-disc]");
    if (!btn) return;
    disc = btn.dataset.disc;
    refresh();
  });

  function filteredDocs() {
    let docs = myDocs();
    const q = $("filter-q").value.trim().toLowerCase();
    const me = DMS.session.user.user_id;
    if (view === "pending")
      docs = docs.filter(
        (d) => d.current_assignee === me && (DMS.effectiveStatus(d).includes("PENDING") || DMS.effectiveStatus(d).includes("UNDER REVIEW"))
      );
    if (view === "overdue") docs = docs.filter((d) => DMS.isOverdue(d));
    if (view === "mine") docs = docs.filter((d) => d.originator === me);
    if (disc) docs = docs.filter((d) => d.discipline === disc);
    if (q)
      docs = docs.filter(
        (d) => d.doc_number.toLowerCase().includes(q) || d.title.toLowerCase().includes(q) || d.type.toLowerCase().includes(q)
      );
    return docs;
  }

  function renderTiles() {
    const docs = myDocs();
    const me = DMS.session.user.user_id;
    const overdue = docs.filter((d) => DMS.isOverdue(d)).length;
    $("tile-total").textContent = docs.length;
    $("tile-awaiting").textContent = docs.filter((d) => d.current_assignee === me).length;
    $("tile-mine").textContent = docs.filter((d) => d.originator === me).length;
    $("tile-overdue").textContent = overdue;
    $("tile-overdue-btn").classList.toggle("alert", overdue > 0);
  }

  function renderTable() {
    const docs = filteredDocs();
    const q = $("filter-q").value.trim();
    const viewTitles = { all: "All my documents", pending: "Awaiting my review", overdue: "Overdue", mine: "Submitted by me" };
    $("view-title").textContent = (viewTitles[view] || "My documents") + (disc ? " · " + disc : "");
    $("result-line").textContent = `${docs.length} document${docs.length === 1 ? "" : "s"}${q ? " matching “" + q + "”" : ""}`;

    if (!docs.length) {
      $("doc-panel").innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l6 6v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v6h6"/><path d="m9 15 2 2 4-4"/></svg>
        <div class="es-title">No documents match this view</div>
        <div class="es-sub">Try clearing the keyword filter or switching to “All my documents” in the sidebar.</div>
      </div>`;
      return;
    }

    const rows = docs
      .map((d) => {
        const od = DMS.isOverdue(d);
        const last = d.comments[d.comments.length - 1];
        let snip = "";
        if (last) {
          const t = last.text.length > 60 ? last.text.slice(0, 60) + "…" : last.text;
          snip = DMS.nameOf(last.author).split(" ")[0] + ": " + t;
        }
        return `<tr class="doc-row ${od ? "od" : ""}" data-doc="${escH(d.doc_number)}">
          <td><span class="docno">${escH(d.doc_number)}</span></td>
          <td><span class="dtitle">${escH(d.title)}</span></td>
          <td class="nowrap">${escH(d.type)}</td>
          <td>${escH(d.discipline)}</td>
          <td class="mono">${escH(d.revision)}</td>
          <td class="nowrap">${statusCell(d)}</td>
          <td>${attachmentCell(d)}</td>
          <td class="nowrap">${escH(DMS.nameOf(d.current_assignee))}</td>
          <td class="mono nowrap">${escH(d.due_date || "—")}</td>
          <td class="mono nowrap">${escH(d.closed_date || d.submitted_date || "—")}</td>
          <td><span class="c-count">${d.comments.length}</span>${snip ? `<div class="c-sum">${escH(snip)}</div>` : ""}</td>
        </tr>`;
      })
      .join("");
    $("doc-panel").innerHTML = `<div class="tbl-wrap"><table class="doc-table">
      <thead><tr><th>Doc No.</th><th>Document name</th><th>Type</th><th>Disc.</th><th>Rev</th><th>Status</th>
      <th>Attachments</th><th>Assigned to</th><th>Due date</th><th>Last updated</th><th>Comments</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  $("filter-q").addEventListener("input", () => { renderTable(); });

  // row clicks (dashboard + chat tables), attachment opens and downloads
  document.addEventListener("click", (e) => {
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      e.stopPropagation();
      e.preventDefault();
      copyLink(copy);
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) {
      // Never let an attachment click bubble into the row handler and pop the
      // detail drawer open behind the new tab.
      e.stopPropagation();
      const allowed = logAttachmentAccess(open.dataset.open, open.dataset.file);
      if (!allowed) {
        e.preventDefault();
        return;
      }
      // Stored files have a real href — let the browser navigate. Only the
      // generated placeholders need us to build the blob ourselves.
      if (!open.dataset.stored) {
        e.preventDefault();
        openGeneratedPlaceholder(allowed.doc, allowed.attachment);
      }
      return;
    }
    const dl = e.target.closest("[data-dl]");
    if (dl) {
      e.stopPropagation();
      downloadAttachment(dl.dataset.dl, dl.dataset.file);
      return;
    }
    const row = e.target.closest("tr.doc-row");
    if (row && row.dataset.doc) openDetail(row.dataset.doc);
  });

  // Clipboard write needs a secure context (https, or localhost); over plain
  // http on a LAN address navigator.clipboard is undefined. The URL is no
  // longer on screen for the user to select by hand, so fall back to the
  // legacy execCommand path, and only if that fails too put the link in the
  // chat panel where it can at least be selected.
  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  async function copyLink(btn) {
    const url = btn.dataset.copy;
    const original = btn.textContent;
    const done = (label) => {
      btn.textContent = label;
      setTimeout(() => { btn.textContent = original; }, 1500);
    };
    try {
      await navigator.clipboard.writeText(url);
      return done("Copied");
    } catch (err) {
      // falls through to the legacy path
    }
    if (legacyCopy(url)) return done("Copied");
    done("Copy failed");
    addMsg("ai", `<p>Your browser blocked the clipboard. Here's the link — select and copy it:</p><p><code>${escH(url)}</code></p>`);
  }

  // RBAC check + audit entry for an attachment access. Returns the resolved
  // {doc, attachment} on success, or null after reporting the refusal.
  function logAttachmentAccess(docKey, fileName) {
    const res = DMS.download_attachment(docKey, fileName);
    if (!res.ok) {
      addMsg("ai", `<p>Couldn't open that attachment: ${res.error === "NOT_FOUND" ? "document not found in your accessible scope." : escH(res.error)}</p>`);
      return null;
    }
    return res.data;
  }

  // Opens a generated stand-in in a new tab for attachments whose bytes were
  // never uploaded (the seeded register). Same generator as the download
  // path, but rendered inline rather than saved.
  function openGeneratedPlaceholder(doc, attachment) {
    const blob = buildPlaceholder(doc, attachment);
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      addMsg("ai", `<p>Your browser blocked the popup for <code>${escH(attachment.file_name)}</code>. Allow popups for this site, or use the Download button in the document's Attachments tab.</p>`);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---------------- attachment open & download ----------------
  // Files uploaded through the New Document modal are stored server-side and
  // served from /api/files/{file_id} — those open and download for real. The
  // seeded register has metadata only, so for those a valid placeholder is
  // still generated client-side (PDF/JPG/plain text) from the document's
  // metadata. Both paths are validated and audit-logged through
  // DMS.download_attachment.

  function makeJpeg(doc, fileName) {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 600;
    const g = c.getContext("2d");
    g.fillStyle = "#FAF7F1";
    g.fillRect(0, 0, 900, 600);
    g.fillStyle = "#FF6600";
    g.fillRect(40, 40, 44, 44);
    g.fillStyle = "#fff";
    g.font = "bold 18px 'Space Grotesk', sans-serif";
    g.fillText("DF", 52, 68);
    g.fillStyle = "#1A1714";
    g.font = "bold 30px 'Space Grotesk', sans-serif";
    g.fillText("DocFlow AI — placeholder image", 104, 70);
    g.font = "20px 'Geist', sans-serif";
    g.fillText(fileName, 40, 140);
    g.fillText(doc.doc_number + " — " + doc.title.slice(0, 60), 40, 180);
    g.fillStyle = "#8A8178";
    g.font = "16px 'Geist', sans-serif";
    g.fillText("Generated by the POC; the original file is not stored in this demo.", 40, 230);
    const bin = atob(c.toDataURL("image/jpeg", 0.9).split(",")[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: "image/jpeg" });
  }

  // Builds the stand-in file for an attachment with no stored bytes: a vector
  // drawing sheet for PDFs, a rendered image for JPGs, metadata text for
  // anything else.
  function buildPlaceholder(doc, attachment) {
    const meta = [
      "DocFlow AI — placeholder attachment (POC)",
      "",
      "File:        " + attachment.file_name,
      "Document:    " + doc.doc_number,
      "Title:       " + doc.title,
      "Type:        " + doc.type + "  ·  Discipline: " + doc.discipline + "  ·  Rev " + doc.revision,
      "Status:      " + DMS.effectiveStatus(doc),
      "Uploaded by: " + DMS.nameOf(attachment.uploaded_by) + " on " + attachment.date,
      "Size on record: " + attachment.size,
      "",
      "The original file content is not stored in this demo;",
      "this placeholder was generated at download time.",
    ];
    const ext = (attachment.file_name.split(".").pop() || "").toLowerCase();
    let blob;
    if (ext === "pdf") {
      // Drawing-sheet placeholder with the document's real comments as inline markups
      const resolvedComments = doc.comments.map((c) => ({
        author: DMS.nameOf(c.author),
        role: c.role,
        timestamp: c.timestamp,
        text: c.text,
      }));
      const sheet = makeDrawingPdf(
        { ...doc, status: DMS.effectiveStatus(doc) },
        attachment,
        resolvedComments
      );
      blob = new Blob([sheet], { type: "application/pdf" });
    } else if (ext === "jpg" || ext === "jpeg") blob = makeJpeg(doc, attachment.file_name);
    else blob = new Blob([meta.join("\r\n")], { type: "text/plain" });
    return blob;
  }

  function downloadAttachment(docKey, fileName) {
    const data = logAttachmentAccess(docKey, fileName);
    if (!data) return;
    const { doc, attachment } = data;

    const a = document.createElement("a");
    let objectUrl = null;
    if (attachment.file_id) {
      a.href = API.fileUrl(attachment.file_id);
    } else {
      objectUrl = URL.createObjectURL(buildPlaceholder(doc, attachment));
      a.href = objectUrl;
    }
    a.download = attachment.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    addMsg("ai", `<p>⬇️ Downloaded <code>${escH(attachment.file_name)}</code> from <strong>${escH(doc.doc_number)}</strong>. Download logged for audit.</p>`);
  }

  // ---------------- notification bell ----------------

  function notifications() {
    const me = DMS.session.user.user_id;
    const items = [];
    myDocs().forEach((d) => {
      if (DMS.isOverdue(d))
        items.push({ doc: d.doc_number, icon: "⏰", color: "var(--danger)", text: `Past its due date (${d.due_date}).` });
      else if (d.current_assignee === me)
        items.push({ doc: d.doc_number, icon: "📋", color: "var(--warning)", text: `Awaiting your action${d.due_date ? " — due " + d.due_date : ""}.` });
    });
    return items;
  }

  function renderBell() {
    const items = notifications();
    $("bell-count").textContent = items.length;
    $("bell-count").hidden = !items.length;
    $("bell-pop").innerHTML =
      `<div class="bell-head">Notifications${items.length ? `<span class="tag pending">${items.length} open</span>` : ""}</div>` +
      (items.length
        ? items
            .map(
              (n) => `<button class="n-item" data-doc="${escH(n.doc)}">
                <span class="n-icon" style="color:${n.color}">${n.icon}</span>
                <span><span class="docno">${escH(n.doc)}</span><br>${escH(n.text)}</span>
              </button>`
            )
            .join("")
        : `<div class="n-empty">You're all caught up — no pending items.</div>`);
  }

  function closeBell() {
    $("bell-pop").hidden = true;
    $("bell-scrim").hidden = true;
  }

  $("bell").addEventListener("click", () => {
    const show = $("bell-pop").hidden;
    $("bell-pop").hidden = !show;
    $("bell-scrim").hidden = !show;
  });
  $("bell-scrim").addEventListener("click", closeBell);
  $("bell-pop").addEventListener("click", (e) => {
    const item = e.target.closest(".n-item");
    if (item && item.dataset.doc) {
      closeBell();
      openDetail(item.dataset.doc);
    }
  });

  // ---------------- audit modal (admin) ----------------

  function renderAudit() {
    const r = DMS.get_audit_trail();
    const entries = r.ok ? r.data.slice(-60).reverse() : [];
    $("audit-body").innerHTML = entries.length
      ? `<table class="doc-table">
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>${entries
            .map(
              (e) => `<tr>
                <td class="mono nowrap">${escH(e.timestamp)}</td>
                <td class="nowrap">${escH(DMS.nameOf(e.user))}</td>
                <td><span class="tag closed">${escH(e.action)}</span></td>
                <td style="color:var(--ink)">${escH(e.detail)}</td>
              </tr>`
            )
            .join("")}</tbody></table>`
      : `<div class="audit-empty">No audit entries recorded yet.</div>`;
  }

  $("audit-btn").addEventListener("click", () => {
    closeBell();
    renderAudit();
    $("audit-modal").hidden = false;
  });
  $("audit-close").addEventListener("click", () => { $("audit-modal").hidden = true; });
  $("audit-modal").addEventListener("click", (e) => {
    if (e.target === $("audit-modal")) $("audit-modal").hidden = true;
  });

  // ---------------- new document modal ----------------

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function plusDays(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  function openNewDocModal() {
    const me = DMS.session.user;
    if (!DMS.canCreateDocument(me)) return;

    $("nd-error").hidden = true;
    $("newdoc-form").reset();
    $("nd-type").innerHTML = DOC_TYPES.map((t) => `<option>${escH(t)}</option>`).join("");
    $("nd-disc").innerHTML = DISCIPLINES.map((d) => `<option>${escH(d)}</option>`).join("");
    $("nd-project").innerHTML = me.projects.map((p) => `<option>${escH(p)}</option>`).join("");
    $("nd-due").value = plusDays(TODAY, 14);

    $("nd-dist").innerHTML = USERS.filter((u) => u.user_id !== me.user_id)
      .map(
        (u) => `<label class="nd-dist-item">
          <input type="checkbox" value="${escH(u.user_id)}">
          ${escH(u.display_name)} <span class="role">(${escH(u.role)})</span>
        </label>`
      )
      .join("");

    $("newdoc-modal").hidden = false;
  }

  function closeNewDocModal() {
    $("newdoc-modal").hidden = true;
  }

  $("new-doc-btn").addEventListener("click", openNewDocModal);
  $("newdoc-close").addEventListener("click", closeNewDocModal);
  $("nd-cancel").addEventListener("click", closeNewDocModal);
  $("newdoc-modal").addEventListener("click", (e) => {
    if (e.target === $("newdoc-modal")) closeNewDocModal();
  });

  $("newdoc-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = $("nd-file").files[0];
    const distribution_list = Array.from($("nd-dist").querySelectorAll("input:checked")).map((i) => i.value);

    // Upload the bytes before creating the record, so the attachment carries a
    // file_id and its link in the table opens the real document. If the upload
    // fails we still create the document — losing the file is bad, losing the
    // submission the user just typed is worse — but we say so plainly.
    let stored = null;
    if (file && API.online) {
      const submit = $("nd-submit");
      const label = submit.textContent;
      submit.disabled = true;
      submit.textContent = "Uploading…";
      try {
        stored = await API.uploadFile(file, DMS.session.user.user_id);
      } catch (err) {
        addMsg("ai", `<p>⚠️ <code>${escH(file.name)}</code> couldn't be uploaded (${escH(err.message)}). The document was still created, with the file recorded as metadata only — re-upload it from the Attachments tab.</p>`);
      } finally {
        submit.disabled = false;
        submit.textContent = label;
      }
    }

    const res = DMS.create_document({
      title: $("nd-title").value,
      type: $("nd-type").value,
      discipline: $("nd-disc").value,
      project_id: $("nd-project").value,
      confidentiality: $("nd-conf").value,
      due_date: $("nd-due").value || null,
      distribution_list,
      file_name: file ? file.name : null,
      file_size: file ? formatBytes(file.size) : null,
      file_id: stored ? stored.file_id : null,
    });

    if (!res.ok) {
      $("nd-error-text").textContent = res.error;
      $("nd-error").hidden = false;
      return;
    }
    closeNewDocModal();
    refresh();
    openDetail(res.data.doc_number);
    addMsg(
      "ai",
      `<p>✅ Created <strong>${escH(res.data.doc_number)}</strong> — "${escH(res.data.title)}". Routed to ${escH(DMS.nameOf(res.data.current_assignee))} for review. Action logged for audit.</p>`
    );
  });

  // ---------------- confirm modal ----------------

  let pendingConfirm = null;

  function askConfirm(title, msg, cta, onYes) {
    pendingConfirm = onYes;
    $("confirm-title").textContent = title;
    $("confirm-msg").textContent = msg;
    $("confirm-yes").textContent = cta;
    $("confirm-modal").hidden = false;
  }
  $("confirm-yes").addEventListener("click", () => {
    const fn = pendingConfirm;
    pendingConfirm = null;
    $("confirm-modal").hidden = true;
    if (fn) fn();
  });
  $("confirm-no").addEventListener("click", () => {
    pendingConfirm = null;
    $("confirm-modal").hidden = true;
  });
  $("confirm-modal").addEventListener("click", (e) => {
    if (e.target === $("confirm-modal")) {
      pendingConfirm = null;
      $("confirm-modal").hidden = true;
    }
  });

  // ---------------- detail drawer ----------------

  function openDetail(docNumber) {
    const det = DMS.get_document_details(docNumber);
    if (!det.ok) return;
    currentDoc = det.data;
    currentPerms = det.permissions;
    api.lastOpenedDoc = det.data;
    activeTab = "overview";
    closeBell();
    document.querySelectorAll("#drawer-tabs .dtab").forEach((b) => b.classList.toggle("on", b.dataset.tab === "overview"));
    renderDrawerHead();
    renderDrawerTab("overview");
    renderDrawerActions();
    $("drawer").hidden = false;
    $("drawer-backdrop").hidden = false;
    renderCrumb();
  }

  function renderDrawerHead() {
    const d = currentDoc;
    if (!d) return;
    $("drawer-title").innerHTML = `
      <div class="dh-tags">
        <span class="docno">${escH(d.doc_number)}</span>
        ${statusCell(d)}
      </div>
      <h2>${escH(d.title)}</h2>`;
    $("drawer-tabs").querySelector('[data-tab="comments"]').textContent = `Comments (${d.comments.length})`;
  }

  function closeDrawer() {
    $("drawer").hidden = true;
    $("drawer-backdrop").hidden = true;
    currentDoc = null;
    currentPerms = null;
    renderCrumb();
  }
  $("drawer-close").addEventListener("click", closeDrawer);
  $("drawer-backdrop").addEventListener("click", closeDrawer);

  $("drawer-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".dtab");
    if (!btn) return;
    activeTab = btn.dataset.tab;
    document.querySelectorAll("#drawer-tabs .dtab").forEach((b) => b.classList.toggle("on", b === btn));
    renderDrawerTab(activeTab);
  });

  function renderDrawerTab(tab) {
    const d = currentDoc;
    if (!d) return;
    let h = "";
    if (tab === "overview") {
      const ov = [
        ["Type", d.type], ["Discipline", d.discipline],
        ["Revision", d.revision], ["Confidentiality", d.confidentiality],
        ["Originator", DMS.nameOf(d.originator)], ["Originator org", d.originator_org || "—"],
        ["Project", d.project_id], ["Current holder", DMS.nameOf(d.current_assignee)],
        ["Submitted", d.submitted_date || "—"], ["Due date", d.due_date || "—"], ["Closed", d.closed_date || "—"],
      ];
      if (d.commercial_value) ov.push(["Commercial value", d.commercial_value]);
      h = `<div class="kvbox">${ov.map(([k, v]) => `<div><span class="k">${escH(k)}</span><span class="v">${escH(v)}</span></div>`).join("")}</div>`;
      if (d.distribution_list)
        h += `<div class="dist-block"><div class="dsect">Distribution list</div>
          <div class="dist-names">${d.distribution_list.map((u) => escH(DMS.nameOf(u))).join(", ")}</div></div>`;
    } else if (tab === "comments") {
      h = `<div class="dcomments">${
        d.comments.length
          ? d.comments
              .map(
                (c) => `<div class="dcomment">
                  <div class="dc-head"><span class="dc-author">${escH(DMS.nameOf(c.author))}</span><span class="dc-role">${escH(c.role)}</span><span class="dc-time">${escH(c.timestamp)}</span></div>
                  <div class="dc-text">${escH(c.text)}</div>
                </div>`
              )
              .join("")
          : `<div class="d-empty">No comments on record.</div>`
      }</div>`;
      if (currentPerms.comment)
        h += `<div class="add-comment">
          <div class="dsect">Add comment</div>
          <textarea id="drawer-comment" class="df-in" rows="3" placeholder="Add a remark — logged with your name, role and timestamp."></textarea>
          <button id="drawer-comment-btn" class="btn secondary sm">Post comment</button>
        </div>`;
    } else if (tab === "revisions") {
      h = `<div class="tbl-wrap rev-wrap"><table class="doc-table">
        <thead><tr><th>Rev</th><th>Date</th><th>Change summary</th><th>Uploaded by</th></tr></thead>
        <tbody>${d.revision_history
          .map(
            (r) => `<tr><td class="mono rev">${escH(r.revision)}</td><td class="mono nowrap">${escH(r.date)}</td><td style="color:var(--ink)">${escH(r.change_summary)}</td><td class="nowrap">${escH(DMS.nameOf(r.uploaded_by))}</td></tr>`
          )
          .join("")}</tbody></table></div>`;
    } else if (tab === "workflow") {
      h = `<div class="steps">${d.workflow_trail
        .map((w) => {
          const done = w.decision && !["Pending", "Not started"].includes(w.decision);
          const cls = done ? "done" : w.decision === "Pending" ? "pend" : "";
          return `<div class="step ${cls}">
            <div class="rail"><div class="dot"></div><div class="line"></div></div>
            <div class="s-body">
              <div class="s-title">${escH(w.step)}</div>
              <div class="s-meta">${escH(DMS.nameOf(w.actor))} · ${escH(w.decision)}${w.date ? ` · <span class="mono">${escH(w.date)}</span>` : ""}</div>
            </div>
          </div>`;
        })
        .join("")}</div>`;
    } else if (tab === "attachments") {
      h = `<div class="attach-list">${
        d.attachments && d.attachments.length
          ? d.attachments
              .map(
                (a) => `<div class="attach-row">
                  <div class="attach-type">${escH(a.type || "FILE")}</div>
                  <div class="attach-info">
                    <div class="attach-name">${
                      a.file_id
                        ? `<a class="attach-open" href="${escH(API.fileUrl(a.file_id))}" target="_blank" rel="noopener"
                             data-open="${escH(d.doc_number)}" data-file="${escH(a.file_name)}" data-stored="1">${escH(a.file_name)}</a>`
                        : `<a class="attach-open" href="#" data-open="${escH(d.doc_number)}" data-file="${escH(a.file_name)}">${escH(a.file_name)}</a>`
                    }</div>
                    <div class="attach-meta">${escH(a.type)} · ${escH(a.size)} · ${escH(DMS.nameOf(a.uploaded_by))} · ${escH(a.date)}${a.file_id ? "" : " · placeholder"}</div>
                  </div>
                  <button class="attach-dl" data-dl="${escH(d.doc_number)}" data-file="${escH(a.file_name)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>Download
                  </button>
                </div>`
              )
              .join("")
          : `<div class="d-empty">No attachments on this document.</div>`
      }</div>`;
    }
    $("drawer-body").innerHTML = h;
    const btn = $("drawer-comment-btn");
    if (btn)
      btn.addEventListener("click", () => {
        const text = $("drawer-comment").value.trim();
        if (!text) return;
        const res = DMS.add_comment(currentDoc.doc_id, text);
        if (res.ok) {
          refresh();
          addMsg("ai", `<p>✅ Comment added to <strong>${escH(currentDoc.doc_number)}</strong> via the detail view. Action logged for audit.</p>`);
        }
      });
  }

  function renderDrawerActions() {
    const p = currentPerms;
    const d = currentDoc;
    if (!p || !d) return;
    const parts = [];
    if (p.approve) {
      parts.push(`<button class="btn primary sm" data-act="1">Code 1 · Approve</button>`);
      parts.push(`<button class="btn secondary sm" data-act="2">Code 2 · Approve w/ comments</button>`);
      parts.push(`<button class="btn secondary sm" data-act="3">Code 3 · Revise &amp; resubmit</button>`);
      parts.push(`<button class="btn ghost sm" data-act="4">Code 4 · Reject</button>`);
    }
    if (p.upload) parts.push(`<button class="btn secondary sm" data-act="upload">Upload new revision</button>`);
    if (!parts.length)
      parts.push(`<span class="no-perm">Your role (${escH(DMS.session.user.role)}) has view${p.comment ? " and comment" : ""}-only access to this document.</span>`);
    $("drawer-actions").innerHTML = parts.join("");
    $("drawer-actions").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.act === "upload") {
          const next = /^\d+$/.test(d.revision) ? String(Number(d.revision) + 1) : String.fromCharCode(d.revision.charCodeAt(0) + 1);
          askConfirm(
            "Upload new revision",
            `Upload Rev ${next} to ${d.doc_number}? Current Rev ${d.revision} will be superseded (retained in history) and status reset to Pending review.`,
            "Upload Rev " + next,
            () => {
              const file = d.doc_number.replace(/-[A-Z0-9]+$/, "") + "-" + next + ".pdf";
              const res = DMS.upload_revision(d.doc_id, file, next);
              addMsg("ai", `<p>${res.ok ? `✅ Rev <strong>${next}</strong> uploaded to <strong>${escH(res.data.doc_number)}</strong>. Status reset to [PENDING REVIEW]. Action logged for audit.` : escH(res.error)}</p>`);
              if (res.ok) refresh();
            }
          );
          return;
        }
        const code = DMS.REVIEW_CODES[b.dataset.act];
        askConfirm(
          "Apply review decision",
          `Apply ${code.label} to ${d.doc_number} — “${d.title}”? This is recorded in the workflow trail and audit log.`,
          code.label.split(" — ")[0],
          () => {
            const res = DMS.update_status(d.doc_id, b.dataset.act);
            addMsg("ai", `<p>${res.ok ? `✅ <strong>${code.label}</strong> applied to <strong>${escH(d.doc_number)}</strong> by ${escH(DMS.session.user.display_name)}. Action logged for audit.` : escH(res.error)}</p>`);
            if (res.ok) refresh();
          }
        );
      })
    );
  }

  // ---------------- chat ----------------

  function setChatOpen(open) {
    $("chat").hidden = !open;
    $("chat-rail").hidden = open;
    if (open) $("chat-unread").hidden = true;
  }

  $("chat-toggle").addEventListener("click", () => setChatOpen(false));
  $("chat-open").addEventListener("click", () => setChatOpen(true));

  function addMsg(who, html) {
    const div = document.createElement("div");
    div.className = "msg " + who;
    if (who === "user") div.textContent = html;
    else div.innerHTML = html;
    $("chat-log").appendChild(div);
    $("chat-log").scrollTop = $("chat-log").scrollHeight;
    if (who === "ai" && $("chat").hidden) $("chat-unread").hidden = false;
  }

  $("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("chat-input");
    const text = input.value.trim();
    if (!text) return;
    addMsg("user", text);
    input.value = "";
    // never echo raw passwords typed as "login user pass" (§2)
    const loginMatch = text.match(/^login\s+(\S+)\s+(\S+)/i);
    if (!DMS.session && loginMatch) {
      const last = $("chat-log").lastChild;
      last.textContent = `login ${loginMatch[1]} ••••••••`;
      const res = DMS.authenticate_user(loginMatch[1], loginMatch[2]);
      if (res.ok) {
        enterApp(res.data);
      } else {
        addMsg("ai", `<p>${res.error} Please try again, or use the login panel.</p>`);
      }
      return;
    }
    const out = Chat.handle(text);
    addMsg("ai", out.html);
  });

  // ---------------- boot & background sync ----------------
  // The document register now lives on the server, so nothing may be read or
  // written until the first /api/state round-trip lands. Sign-in stays
  // disabled until then rather than letting someone log in against the raw
  // data.js seeds and write divergent state back.

  const SYNC_INTERVAL_MS = 15000;

  // The connected case is the expected one and says nothing — only the
  // degraded fallback is worth a line on the login screen.
  function setStorageMode(mode) {
    const el = $("storage-mode");
    if (!el) return;
    if (mode === "server") {
      el.hidden = true;
      el.textContent = "";
    } else {
      el.className = "storage-mode warn";
      el.textContent = "Offline mode — no server reachable, so changes stay in this browser only.";
      el.hidden = false;
    }
  }

  document.addEventListener("docflow:offline", () => {
    setStorageMode("local");
    addMsg("ai", `<p>⚠️ Lost contact with the shared document store. You can keep working, but changes are being kept in this browser only until you reload.</p>`);
  });

  // Poll for other users' comments, approvals and new documents. Skipped while
  // a modal or the drawer's comment box is in use so the UI can't refresh out
  // from under someone mid-edit.
  async function syncNow(force) {
    if (!DMS.session || !API.online) return;
    if (!force) {
      if (document.hidden) return;
      const typing = document.activeElement;
      if (typing && ["INPUT", "TEXTAREA", "SELECT"].includes(typing.tagName)) return;
      if (!$("newdoc-modal").hidden || !$("confirm-modal").hidden) return;
    }
    await API.flush(); // don't overwrite our own not-yet-pushed writes
    if (await DMS.sync()) refresh();
  }

  function startBackgroundSync() {
    setInterval(() => syncNow(false), SYNC_INTERVAL_MS);
    // Hidden tabs don't poll; catch up the moment one is looked at again
    // rather than showing a stale register for up to a full interval.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncNow(true);
    });
  }

  DMS.connect()
    .then((info) => {
      setStorageMode(info.mode);
      startBackgroundSync();
      // Not awaited: sign-in shouldn't wait on ~30 uploads. The table renders
      // with filenames for a moment on a cold database, then swaps to real
      // URLs when the backfill lands.
      DMS.materializeAttachments(buildPlaceholder).then((stored) => {
        if (stored) {
          console.info(`[docflow] stored ${stored} placeholder attachments`);
          refresh();
        }
      });
    })
    .catch((err) => {
      console.error("[docflow] boot failed", err);
      setStorageMode("local");
    })
    .finally(() => {
      const btn = $("login-submit");
      btn.disabled = false;
      btn.textContent = "Sign in";
    });

  api.refresh = refresh;
  api.onLogout = onLogout;
  api.openDetail = openDetail;
  api.addMsg = addMsg;
  Object.defineProperty(api, "lastOpenedDoc", {
    get() {
      return currentDoc;
    },
    set(v) {
      currentDoc = v;
    },
  });
  return api;
})();
