// ============================================================
// DocFlow AI — server sync layer (POC)
// Talks to server/app.py so the document register is shared by
// every user and every browser, instead of living in one
// browser's localStorage.
//
// Degrades on purpose: if the API can't be reached (someone
// opened index.html over file://, or is still running a plain
// `python -m http.server`), mode stays "local" and dms.js falls
// back to its original localStorage mirror. The app keeps working
// single-browser rather than showing an error wall.
// ============================================================

const API = (() => {
  let mode = "local"; // "server" once /api/state answers
  const REQUEST_TIMEOUT_MS = 10000;

  // Writes are queued behind one promise chain so they reach the server in
  // the order the user made them — a comment can't land before the document
  // it was added to. A failed write degrades the session to local mode
  // rather than silently dropping state.
  let queue = Promise.resolve();
  let failures = 0;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(path, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const type = res.headers.get("Content-Type") || "";
      return type.includes("application/json") ? await res.json() : await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  function json(path, method, body) {
    return request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // Fire-and-forget write: keeps DMS.* synchronous for every existing call
  // site in app.js/chat.js. The local array is already updated; this pushes
  // the same change to the shared store.
  function enqueue(label, run) {
    if (mode !== "server") return;
    queue = queue
      .then(run)
      .then(() => { failures = 0; })
      .catch((err) => {
        failures += 1;
        console.warn(`[docflow] ${label} failed to sync:`, err.message);
        if (failures >= 3) {
          mode = "local";
          console.warn("[docflow] server unreachable — falling back to localStorage");
          document.dispatchEvent(new CustomEvent("docflow:offline"));
        }
      });
    return queue;
  }

  async function connect() {
    try {
      const state = await request("/api/state");
      mode = "server";
      return state;
    } catch (err) {
      mode = "local";
      return null;
    }
  }

  const fetchState = () => request("/api/state");
  const seed = (documents) => json("/api/seed", "POST", { documents });

  const saveDoc = (doc) =>
    enqueue(`document ${doc.doc_number}`, () =>
      json(`/api/documents/${encodeURIComponent(doc.doc_id)}`, "PUT", doc));

  const saveAudit = (entry) =>
    enqueue("audit entry", () => json("/api/audit", "POST", entry));

  const reset = () => request("/api/reset", { method: "POST" });

  // Raw-body upload — no multipart assembly needed on either side.
  async function uploadFile(file, uploadedBy) {
    const qs = `?name=${encodeURIComponent(file.name)}&by=${encodeURIComponent(uploadedBy || "")}`;
    return request(`/api/files${qs}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
  }

  const fileUrl = (fileId) => `/api/files/${encodeURIComponent(fileId)}`;

  // Fully-qualified form of the same link, for showing and copying: it stays
  // valid pasted into an email, another browser, or a different app. Resolved
  // against the page origin, so it picks up the real host once deployed
  // rather than hardcoding localhost.
  const fileUrlAbsolute = (fileId) => new URL(fileUrl(fileId), window.location.origin).href;
  const flush = () => queue;

  return {
    connect,
    fetchState,
    seed,
    saveDoc,
    saveAudit,
    reset,
    uploadFile,
    fileUrl,
    fileUrlAbsolute,
    flush,
    get mode() {
      return mode;
    },
    get online() {
      return mode === "server";
    },
  };
})();
