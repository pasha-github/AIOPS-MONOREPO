// ============================================================
// DocFlow AI — Assistant layer (POC)
// A deterministic intent engine that behaves per the spec §2
// system prompt: auth-gated, tool-backed, table-first output,
// confirm-before-write, strict permission refusals.
// In production this parser is replaced by an LLM with function
// calling against the same DMS.* tools.
// ============================================================

const Chat = (() => {
  let pendingAction = null; // {kind, doc, review_code?, text?, describe}

  // ---------- rendering helpers ----------

  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function statusTag(doc) {
    const s = DMS.effectiveStatus(doc);
    const cls = s.includes("OVERDUE")
      ? "overdue"
      : s.startsWith("APPROVED")
      ? "approved"
      : s === "REJECTED"
      ? "rejected"
      : s === "REVISE & RESUBMIT"
      ? "revise"
      : s === "CLOSED" || s === "SUPERSEDED"
      ? "closed"
      : "pending";
    return `<span class="tag ${cls}">[${esc(s)}]</span>`;
  }

  function docTable(docs) {
    if (!docs.length) return "";
    const rows = docs
      .map(
        (d) => `<tr data-doc="${esc(d.doc_number)}" class="doc-row">
        <td class="mono docno">${esc(d.doc_number)}</td>
        <td>${esc(d.title)}</td>
        <td>${esc(d.type)}</td>
        <td>${esc(d.discipline)}</td>
        <td>${esc(d.revision)}</td>
        <td>${statusTag(d)}</td>
        <td>${esc(DMS.nameOf(d.current_assignee))}</td>
        <td>${esc(d.due_date || "—")}</td>
        <td title="${
          d.comments.length
            ? esc(d.comments.map((c) => `${DMS.nameOf(c.author)}: ${c.text}`).join("\n\n")).replace(/"/g, "&quot;")
            : "No comments"
        }">${d.comments.length}${
          d.comments.length
            ? `<div class="c-sum">${esc(d.comments[d.comments.length - 1].text.slice(0, 40))}…</div>`
            : ""
        }</td>
      </tr>`
      )
      .join("");
    return `<div class="tbl-wrap"><table class="doc-table">
      <thead><tr><th>Doc No.</th><th>Document Name</th><th>Type</th><th>Disc.</th><th>Rev</th><th>Status</th><th>Assigned To</th><th>Due Date</th><th>💬</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <div class="hint">Click a row (or say "open &lt;doc no.&gt;") to see full details.</div>`;
  }

  function docDetail(doc, perms) {
    let h = `<div class="detail">
      <div class="detail-head">
        <span class="mono docno">${esc(doc.doc_number)}</span> ${statusTag(doc)}<br>
        <strong>${esc(doc.title)}</strong><br>
        <span class="meta">${esc(doc.type)} · ${esc(doc.discipline)} · Rev ${esc(doc.revision)} · ${esc(doc.confidentiality)}</span>
      </div>
      <div class="kv">
        <div><span>Originator</span>${esc(DMS.nameOf(doc.originator))} (${esc(doc.originator_org || "")})</div>
        <div><span>Project</span>${esc(doc.project_id)}</div>
        <div><span>Submitted</span>${esc(doc.submitted_date || "—")}</div>
        <div><span>Due</span>${esc(doc.due_date || "—")}</div>
        <div><span>Current holder</span>${esc(DMS.nameOf(doc.current_assignee))}</div>
        ${doc.commercial_value ? `<div><span>Commercial value</span>${esc(doc.commercial_value)}</div>` : ""}
        ${
          doc.distribution_list
            ? `<div><span>Distribution</span>${doc.distribution_list.map((u) => esc(DMS.nameOf(u))).join(", ")}</div>`
            : ""
        }
      </div>`;

    h += `<div class="sect">Comments / Remarks (${doc.comments.length})</div>`;
    h += doc.comments.length
      ? doc.comments
          .map(
            (c) => `<div class="comment"><div class="c-head">${esc(DMS.nameOf(c.author))} <em>(${esc(
              c.role
            )})</em> · ${esc(c.timestamp)}</div><div class="c-text">${esc(c.text)}</div></div>`
          )
          .join("")
      : `<div class="hint">No comments on record.</div>`;

    h += `<div class="sect">Revision History</div><div class="tbl-wrap"><table class="doc-table">
      <thead><tr><th>Rev</th><th>Date</th><th>Change</th><th>By</th></tr></thead><tbody>`;
    h += doc.revision_history
      .map(
        (r) =>
          `<tr><td>${esc(r.revision)}</td><td>${esc(r.date)}</td><td>${esc(r.change_summary)}</td><td>${esc(
            DMS.nameOf(r.uploaded_by)
          )}</td></tr>`
      )
      .join("");
    h += `</tbody></table></div>`;

    h += `<div class="sect">Workflow / Approval Trail</div><div class="tbl-wrap"><table class="doc-table">
      <thead><tr><th>Step</th><th>Actor</th><th>Decision</th><th>Date</th></tr></thead><tbody>`;
    h += doc.workflow_trail
      .map(
        (w) =>
          `<tr><td>${esc(w.step)}</td><td>${esc(DMS.nameOf(w.actor))}</td><td>${esc(w.decision)}</td><td>${esc(
            w.date || "—"
          )}</td></tr>`
      )
      .join("");
    h += `</tbody></table></div>`;

    if (doc.attachments && doc.attachments.length) {
      h += `<div class="sect">Attachments</div>`;
      h += doc.attachments
        .map(
          (a) => `<div class="attach">📎 ${esc(a.file_name)} <span class="meta">(${esc(a.type)}, ${esc(a.size)})</span>
            <button class="dl-btn" data-dl="${esc(doc.doc_number)}" data-file="${esc(a.file_name)}">⬇ Download</button></div>`
        )
        .join("");
    }

    const actions = [];
    if (perms.comment) actions.push(`comment on ${doc.doc_number}: &lt;text&gt;`);
    if (perms.approve) actions.push(`approve / reject ${doc.doc_number}`);
    if (perms.upload) actions.push(`upload revision to ${doc.doc_number}`);
    if (actions.length)
      h += `<div class="hint next">Available actions for your role: <code>${actions.join("</code> · <code>")}</code></div>`;
    h += `</div>`;
    return h;
  }

  // ---------- intent handling ----------

  const DOCNO_RE = /\b([A-Z]{2,5}-[A-Z]{2,4}-[A-Z]{2,4}-\d{2,5}(?:-[A-Z0-9]{1,3})?)\b/i;

  function reply(text) {
    return { html: `<p>${text}</p>` };
  }

  function handle(input) {
    const raw = input.trim();
    const lower = raw.toLowerCase();

    // ----- unauthenticated: everything routes to login -----
    if (!DMS.session) {
      return reply(
        `Please sign in before I can show any document data. Use the login panel on the left, or type <code>login &lt;username&gt; &lt;password&gt;</code>.<br><span class="hint">Demo users: maha (Doc Controller), khalid (Reviewer), omar (Engineer), noura (PM), yousef (Subcontractor), layla (Auditor) — password <code>demo123</code>.</span>`
      );
    }

    // ----- pending confirmation flow -----
    if (pendingAction) {
      if (/^(yes|y|confirm|ok|proceed|go ahead)\b/i.test(lower)) {
        const act = pendingAction;
        pendingAction = null;
        return executeAction(act);
      }
      if (/^(no|n|cancel|stop|abort)\b/i.test(lower)) {
        const d = pendingAction.describe;
        pendingAction = null;
        return reply(`Cancelled — no change made. (${esc(d)})`);
      }
      const d = pendingAction.describe;
      pendingAction = null;
      // fall through and treat as a new request
      var note = `<span class="hint">Previous pending action discarded: ${esc(d)}.</span><br>`;
    }
    const prefix = typeof note !== "undefined" ? note : "";

    // ----- login while already logged in -----
    if (/^login\b/i.test(lower)) {
      return reply(`You are already signed in as <strong>${esc(DMS.session.user.display_name)}</strong> (${esc(DMS.session.user.role)}). Say <code>logout</code> to switch users.`);
    }
    if (/^log\s*out|^logout|^sign\s*out/i.test(lower)) {
      DMS.logout();
      UI.onLogout();
      return reply(`You have been signed out. Session closed and logged for audit.`);
    }

    if (/^(help|what can you do|\?)$/i.test(lower)) {
      return reply(
        `I can: <code>show my documents</code> · <code>search &lt;keyword or doc no.&gt;</code> · <code>open &lt;doc no.&gt;</code> · <code>what's overdue</code> · <code>comment on &lt;doc no.&gt;: &lt;text&gt;</code> · <code>approve/reject &lt;doc no.&gt;</code> (Code 1–4) · <code>upload revision to &lt;doc no.&gt;</code> · <code>new document</code> · <code>audit trail</code> (Admin only) · <code>reset demo data</code> (Admin only) · <code>logout</code>`
      );
    }

    // ----- create a new document -----
    if (/^(new|create|add|raise)\s+(a\s+|an\s+)?document\b/i.test(lower)) {
      if (!DMS.canCreateDocument(DMS.session.user)) {
        return reply(
          `Your role (${esc(DMS.session.user.role)}) can't create new documents — ask your Document Controller to raise it instead.`
        );
      }
      return reply(
        `Use the <strong>+ New document</strong> button above the table. It captures the title, type, discipline, distribution list and an optional initial attachment, auto-routes it to the right reviewer, and generates the document number — a multi-field record like that isn't something I take through free text, to avoid partial or garbled submissions.`
      );
    }

    // ----- guardrails (§2) -----
    if (/\b(delete|remove)\b.*\b(document|doc|comment|file|record)\b/i.test(lower)) {
      return reply(
        `Deletion is out of scope for this assistant — documents and comments are never deleted, only superseded, to preserve the audit trail. Please contact an Admin for retention actions.`
      );
    }
    if (/\b(backdate|back-date|fake|fabricate|falsify|alter the audit|bypass|skip (the )?(review|workflow|approval))\b/i.test(lower)) {
      return reply(
        `I can't do that. Backdating approvals, fabricating records, or skipping workflow steps would break audit integrity — every action here is logged with user, timestamp, and action. If a deadline is at risk, I can flag the document to the PM or Document Controller instead.`
      );
    }
    if (/\b(password|token|credential)s?\b.*\b(show|reveal|what|tell|give)\b|\b(show|reveal|tell me|give me)\b.*\b(password|token|credential)s?\b/i.test(lower)) {
      return reply(`I never expose passwords, tokens, or session data — for any user, including you.`);
    }

    // ----- audit trail -----
    if (/audit (trail|log)/i.test(lower)) {
      const m = raw.match(DOCNO_RE);
      const res = DMS.get_audit_trail(m ? m[1].toUpperCase() : undefined);
      if (!res.ok) return reply(esc(res.error));
      if (!res.data.length) return reply(`No audit entries recorded yet.`);
      const rows = res.data
        .slice(-25)
        .map(
          (e) =>
            `<tr><td class="mono">${esc(e.timestamp)}</td><td>${esc(DMS.nameOf(e.user))}</td><td>${esc(e.action)}</td><td>${esc(e.detail)}</td></tr>`
        )
        .join("");
      return {
        html: `<p>Audit trail (last ${Math.min(25, res.data.length)} of ${res.data.length} entries on record):</p>
        <div class="tbl-wrap"><table class="doc-table"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      };
    }

    // ----- reset demo data (Admin only) -----
    if (/^reset\b.*\b(demo|seed|data)\b/i.test(lower)) {
      if (DMS.session.user.role !== ROLES.ADMIN) {
        return reply(
          `Resetting demo data is restricted to Admin/Auditor roles — ask an Admin to do this instead.`
        );
      }
      pendingAction = { kind: "reset", describe: "reset all demo data back to the seed state" };
      return reply(
        `This clears every document, comment, and audit entry created or changed since the last reset — for <strong>every</strong> user, not just you — and reloads the page back to the original seed data. This cannot be undone.<br>Reply <code>yes</code> to confirm or <code>no</code> to cancel.`
      );
    }

    // ----- my documents -----
    if (/(my documents|my docs|assigned to me|show me my|my pending|my tasks|documents for me)/i.test(lower)) {
      const res = DMS.list_assigned_documents();
      if (!res.ok) return sessionExpired();
      const docs = res.data;
      if (!docs.length) return reply(`No documents are currently assigned to you, submitted by you, or awaiting your action.`);
      const overdue = docs.filter((d) => DMS.isOverdue(d));
      let head = `You have <strong>${docs.length}</strong> document${docs.length > 1 ? "s" : ""} assigned to you, submitted by you, or awaiting your action`;
      head += overdue.length
        ? ` — <strong class="warn">${overdue.length} overdue</strong> (shown first):`
        : `, sorted by nearest due date:`;
      return { html: prefix + `<p>${head}</p>` + docTable(docs) };
    }

    // ----- overdue / pending summaries -----
    if (/(overdue|past due|late|stuck|beyond sla)/i.test(lower)) {
      const res = DMS.list_assigned_documents();
      if (!res.ok) return sessionExpired();
      const docs = res.data.filter((d) => DMS.isOverdue(d));
      if (!docs.length) return reply(`Good news — nothing in your scope is past its due date.`);
      return {
        html: `<p><strong class="warn">${docs.length} item${docs.length > 1 ? "s are" : " is"} past due</strong> in your scope:</p>` + docTable(docs),
      };
    }
    if (/(pending|awaiting|to review|for review|action items)/i.test(lower) && !/comment/i.test(lower)) {
      const res = DMS.list_assigned_documents("PENDING");
      if (!res.ok) return sessionExpired();
      const under = DMS.list_assigned_documents("UNDER REVIEW");
      const docs = [...res.data, ...(under.ok ? under.data.filter((d) => !res.data.some((x) => x.doc_id === d.doc_id)) : [])];
      if (!docs.length) return reply(`Nothing is pending your review right now.`);
      return { html: `<p><strong>${docs.length}</strong> item${docs.length > 1 ? "s" : ""} pending review in your scope:</p>` + docTable(docs) };
    }

    // ----- comment -----
    let m = raw.match(/comment (?:on )?(?:doc(?:ument)? )?([A-Z0-9-]+)\s*[:—-]\s*(.+)/i);
    if (m) {
      const target = resolveDoc(m[1]);
      if (!target.ok) return target.reply;
      pendingAction = {
        kind: "comment",
        doc: target.doc,
        text: m[2].trim(),
        describe: `add comment to ${target.doc.doc_number}`,
      };
      return reply(
        `Add this comment to <strong>${esc(target.doc.doc_number)}</strong>?<br><em>"${esc(m[2].trim())}"</em><br>Reply <code>yes</code> to confirm or <code>no</code> to cancel.`
      );
    }

    // ----- approve / reject / revise (Code 1–4) -----
    m = raw.match(/\b(approve|reject|revise|resubmit|code\s*([1-4]))\b/i);
    if (m && !/comment on/i.test(lower)) {
      const docMatch = raw.match(DOCNO_RE);
      let doc = null;
      let perms = null;
      if (docMatch) {
        const t = resolveDoc(docMatch[1]);
        if (!t.ok) return t.reply;
        doc = t.doc;
        perms = t.perms;
      } else if (UI.lastOpenedDoc) {
        doc = UI.lastOpenedDoc;
        const det = DMS.get_document_details(doc.doc_id);
        if (det.ok) perms = det.permissions;
      } else {
        return reply(`Which document? Say e.g. <code>approve SPCL-MEP-DWG-0452-C</code>, or open one first.`);
      }
      if (perms && !perms.approve) {
        const me = DMS.session.user;
        if (doc.originator === me.user_id)
          return reply(
            `Workflow rule: you can't action your own submission — <strong>${esc(doc.doc_number)}</strong> is with ${esc(DMS.nameOf(doc.current_assignee))} for review. I can add a comment on your behalf instead.`
          );
        return reply(
          `You don't have approval rights for this document — it's assigned to ${esc(DMS.nameOf(doc.current_assignee) || "the assigned reviewer")}. I can add a comment on your behalf instead, if you'd like.`
        );
      }
      let code = m[2];
      if (!code) {
        const verb = m[1].toLowerCase();
        const withComments = /with comments/i.test(lower);
        code = verb === "approve" ? (withComments ? "2" : "1") : verb === "reject" ? "4" : "3";
      }
      const label = DMS.REVIEW_CODES[code].label;
      pendingAction = { kind: "status", doc, review_code: code, describe: `${label} on ${doc.doc_number}` };
      return reply(
        `Apply <strong>${esc(label)}</strong> to <strong>${esc(doc.doc_number)}</strong> — "${esc(doc.title)}"?<br>Reply <code>yes</code> to confirm or <code>no</code> to cancel.`
      );
    }

    // ----- upload revision -----
    m = raw.match(/upload (?:a )?(?:new )?revision(?: to| for| on)?\s*([A-Z0-9-]+)?/i);
    if (m) {
      let doc = null;
      let uPerms = null;
      if (m[1]) {
        const t = resolveDoc(m[1]);
        if (!t.ok) return t.reply;
        doc = t.doc;
        uPerms = t.perms;
      } else if (UI.lastOpenedDoc) {
        doc = UI.lastOpenedDoc;
        const det = DMS.get_document_details(doc.doc_id);
        if (det.ok) uPerms = det.permissions;
      } else return reply(`Which document should the new revision go to? e.g. <code>upload revision to SPCL-CIV-DWG-0089-B</code>`);
      if (uPerms && !uPerms.upload)
        return reply(`Your role (${esc(DMS.session.user.role)}) cannot upload revisions to <strong>${esc(doc.doc_number)}</strong> — only the originator or the Document Controller can.`);
      const nextRev = nextRevision(doc.revision);
      pendingAction = { kind: "upload", doc, revision_label: nextRev, describe: `upload Rev ${nextRev} to ${doc.doc_number}` };
      return reply(
        `Upload new revision <strong>Rev ${esc(nextRev)}</strong> to <strong>${esc(doc.doc_number)}</strong> (current Rev ${esc(doc.revision)})? This will supersede Rev ${esc(doc.revision)} and reset status to [PENDING REVIEW].<br>Reply <code>yes</code> to confirm or <code>no</code> to cancel.`
      );
    }

    // ----- open a specific document -----
    m = raw.match(/^(?:open|show|view|get|details? (?:of|for))\s+(.+)$/i) || (DOCNO_RE.test(raw) && raw.match(DOCNO_RE));
    if (m) {
      const key = (m[1] || m[0]).trim();
      const docNo = key.match(DOCNO_RE);
      if (docNo) return openDoc(docNo[1]);
      // "open" with a non doc-number → treat as search
      return doSearch(key);
    }

    // ----- search -----
    m = raw.match(/^(?:search|find|look ?up|locate)\s*(?:for )?(.+)$/i);
    if (m) return doSearch(m[1]);

    // ----- bare alphanumeric code → probable doc number (§2 search behavior) -----
    if (/^[A-Z0-9-]{4,}$/i.test(raw)) return openDoc(raw);

    // ----- fallback: keyword search -----
    return doSearch(raw, true);
  }

  // ---------- action executors ----------

  function executeAction(act) {
    if (act.kind === "comment") {
      const res = DMS.add_comment(act.doc.doc_id, act.text);
      if (!res.ok) return reply(esc(res.error));
      UI.refresh();
      const n = res.doc.comments.length;
      return reply(
        `✅ Comment added to <strong>${esc(act.doc.doc_number)}</strong> by ${esc(DMS.session.user.display_name)} at ${esc(res.data.timestamp)}. The document now has ${n} comment${n > 1 ? "s" : ""}. Action logged for audit.`
      );
    }
    if (act.kind === "status") {
      const res = DMS.update_status(act.doc.doc_id, act.review_code);
      if (!res.ok) return reply(esc(res.error));
      UI.refresh();
      const d = res.data.doc;
      return reply(
        `✅ <strong>${esc(res.data.code.label)}</strong> applied to <strong>${esc(d.doc_number)}</strong> by ${esc(DMS.session.user.display_name)}. New status: ${statusTag(d)}${
          d.current_assignee ? ` — returned to ${esc(DMS.nameOf(d.current_assignee))} for action.` : "."
        } Action logged for audit.`
      );
    }
    if (act.kind === "upload") {
      const file = act.doc.doc_number.replace(/-[A-Z0-9]+$/, "") + "-" + act.revision_label + ".pdf";
      const res = DMS.upload_revision(act.doc.doc_id, file, act.revision_label);
      if (!res.ok) return reply(esc(res.error));
      UI.refresh();
      return reply(
        `✅ Rev <strong>${esc(act.revision_label)}</strong> uploaded to <strong>${esc(res.data.doc_number)}</strong> (file <code>${esc(file)}</code>). Prior revision retained in history; status reset to [PENDING REVIEW] and routed to the reviewer. Action logged for audit.`
      );
    }
    if (act.kind === "reset") {
      const res = DMS.reset_demo_data();
      if (!res.ok) return reply(esc(res.error));
      // In server mode the wipe + reseed is a round-trip; wait for it to
      // finish before reloading or we'd reload into a half-empty register.
      if (res.pending) res.pending.finally(() => window.location.reload());
      else setTimeout(() => window.location.reload(), 500);
      return reply(
        res.pending
          ? `✅ Demo data reset on the shared server — this affects every user. Reloading to the seed state…`
          : `✅ Demo data reset. Reloading to the seed state…`
      );
    }
    return reply(`Unknown action.`);
  }

  // ---------- lookup helpers ----------

  function resolveDoc(key) {
    const res = DMS.get_document_details(key);
    if (res.ok) return { ok: true, doc: res.data, perms: res.permissions };
    // spec: identical "not found" for missing vs out-of-scope
    return {
      ok: false,
      reply: reply(
        `No document matching <code>${esc(key)}</code> was found in your accessible scope. Try <code>search &lt;keyword&gt;</code> to look it up by title or content.`
      ),
    };
  }

  function openDoc(key) {
    const t = resolveDoc(key);
    if (!t.ok) {
      // fuzzy fallback on title/content, and say which mode was used (§2)
      const s = DMS.search_documents({ query: key });
      if (s.ok && s.data.length) {
        return {
          html: `<p>No exact document number match for <code>${esc(key)}</code> — showing <strong>${s.data.length}</strong> keyword match${s.data.length > 1 ? "es" : ""} on title/content instead:</p>` + docTable(s.data),
        };
      }
      return t.reply;
    }
    UI.lastOpenedDoc = t.doc;
    UI.openDetail(t.doc.doc_number);
    return { html: docDetail(t.doc, t.perms) };
  }

  function doSearch(q, isFallback) {
    const docNo = q.match(DOCNO_RE);
    const res = docNo
      ? DMS.search_documents({ doc_number: docNo[1] })
      : DMS.search_documents({ query: q });
    if (!res.ok) return sessionExpired();
    if (!res.data.length) {
      return reply(
        `No results for <code>${esc(q)}</code> in your accessible scope${isFallback ? " (I treated that as a keyword search)" : ""}. Try a broader term, a discipline (MEP, CIV, STR…), or a document type (RFI, NCR, drawing…).`
      );
    }
    if (res.data.length === 1) {
      const d = res.data[0];
      const det = DMS.get_document_details(d.doc_id);
      UI.lastOpenedDoc = det.data;
      UI.openDetail(det.data.doc_number);
      return {
        html: `<p>One ${res.mode === "exact" ? "exact" : "match"} found — opening it:</p>` + docDetail(det.data, det.permissions),
      };
    }
    const modeNote = res.mode === "partial" ? " (partial document-number match)" : res.mode === "fuzzy" ? " (keyword search on title/content)" : "";
    return {
      html: `<p><strong>${res.data.length}</strong> result${res.data.length > 1 ? "s" : ""} for <code>${esc(q)}</code>${modeNote}:</p>` + docTable(res.data),
    };
  }

  function sessionExpired() {
    UI.onLogout();
    return reply(`Your session has expired. Please sign in again.`);
  }

  function nextRevision(rev) {
    if (/^\d+$/.test(rev)) return String(Number(rev) + 1);
    return String.fromCharCode(rev.charCodeAt(0) + 1);
  }

  function greeting(user) {
    const res = DMS.list_assigned_documents();
    const docs = res.ok ? res.data : [];
    const overdue = docs.filter((d) => DMS.isOverdue(d));
    let h = `<p>Welcome, <strong>${esc(user.display_name)}</strong> — signed in as <em>${esc(user.role)}</em>, ${esc(user.org)}, project ${user.projects.join(", ")}.</p>`;
    if (overdue.length)
      h += `<p>⚠️ <strong class="warn">${overdue.length} item${overdue.length > 1 ? "s" : ""} in your scope ${overdue.length > 1 ? "are" : "is"} past due.</strong> Say <code>what's overdue</code> to see ${overdue.length > 1 ? "them" : "it"}.</p>`;
    h += `<p>You have <strong>${docs.length}</strong> document${docs.length === 1 ? "" : "s"} in your queue. Try <code>show my documents</code>, <code>search chilled water</code>, or <code>open SPCL-MEP-DWG-0452-C</code>. Type <code>help</code> for everything I can do.</p>`;
    return { html: h };
  }

  return { handle, greeting, docTable, docDetail, statusTag };
})();
