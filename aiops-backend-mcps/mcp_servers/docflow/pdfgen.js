// ============================================================
// DocFlow AI — placeholder drawing-sheet PDF generator (POC)
// Builds an A3-landscape construction drawing sheet entirely
// with PDF vector operators: border, structural grid, a
// discipline-specific schematic, title block, review stamp,
// and the document's real comments as numbered inline markup
// clouds plus a review-comments panel.
// Used by the browser (app.js) and unit-testable in Node.
// ============================================================

function pdfEscape(s) {
  return String(s)
    .replace(/[—–·]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrapText(s, n) {
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n) {
      if (cur.trim()) lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

// doc: {doc_number, title, type, discipline, revision, status(effective),
//       project_id, originator_org, submitted_date}
// attachment: {file_name, date}
// comments: [{author, role, timestamp, text}] — already name-resolved
function makeDrawingPdf(doc, attachment, comments) {
  const ops = [];
  const RED = "0.8 0.05 0.05";
  const GREY = "0.45 0.45 0.45";
  const BLUE = "0 0.25 0.7";

  const text = (x, y, s, o = {}) =>
    ops.push(
      `BT ${o.color || "0 0 0"} rg /${o.font || "F1"} ${o.size || 8} Tf ${x} ${y} Td (${pdfEscape(s)}) Tj ET`
    );
  const stroke = (c = "0 0 0", w = 1, dash = null) =>
    ops.push(`${c} RG ${w} w ${dash ? `[${dash}] 0 d` : "[] 0 d"}`);
  const line = (x1, y1, x2, y2) => ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  const rect = (x, y, w, h, mode = "S") => ops.push(`${x} ${y} ${w} ${h} re ${mode}`);
  const fill = (c) => ops.push(`${c} rg`);
  const circle = (cx, cy, r, mode = "S") => {
    const k = +(0.5523 * r).toFixed(2);
    ops.push(
      `${cx + r} ${cy} m ` +
        `${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ` +
        `${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ` +
        `${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ` +
        `${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c ${mode}`
    );
  };
  const polyline = (pts) =>
    ops.push(pts.map((p, i) => `${p[0]} ${p[1]} ${i ? "l" : "m"}`).join(" ") + " S");

  // ---- sheet border & layout ----
  stroke("0 0 0", 2);
  rect(15, 15, 1160, 812);
  stroke("0 0 0", 0.7);
  rect(25, 25, 1140, 792);
  line(865, 25, 865, 817); // split: drawing area | right panel

  // ---- structural grid ----
  const gx = [90, 230, 370, 510, 650, 790];
  const gy = [110, 260, 410, 560, 710];
  stroke("0.62 0.62 0.62", 0.5, "2 3");
  gx.forEach((x) => line(x, 62, x, 748));
  gy.forEach((y) => line(58, y, 842, y));
  // grid bubbles
  stroke("0 0 0", 0.8);
  gx.forEach((x, i) => {
    circle(x, 772, 11);
    text(x - 2.5, 768.5, String(i + 1), { size: 8, font: "F2" });
  });
  const rows = ["A", "B", "C", "D", "E"];
  gy.forEach((y, i) => {
    circle(42, y, 11);
    text(39, y - 3, rows[rows.length - 1 - i], { size: 8, font: "F2" });
  });
  // columns at grid intersections
  fill("0.15 0.15 0.15");
  gx.forEach((x) => gy.forEach((y) => rect(x - 5, y - 5, 10, 10, "f")));

  // ---- discipline-specific schematic ----
  const disc = (doc.discipline || "").toUpperCase();
  if (disc === "MEP") {
    stroke(BLUE, 2.5);
    polyline([[110, 640], [640, 640], [640, 300], [300, 300]]);
    stroke(BLUE, 1.2);
    fill("1 1 1");
    circle(300, 640, 7, "B");
    circle(640, 470, 7, "B");
    text(285, 655, "GV-12", { size: 6.5, color: BLUE });
    text(652, 466, "GV-14", { size: 6.5, color: BLUE });
    rect(420, 600, 74, 44, "S");
    text(430, 618, "FCU-14", { size: 8, font: "F2", color: BLUE });
    text(115, 650, "CHW SUPPLY 150 DIA", { size: 7, color: BLUE });
    text(310, 285, "CHW RETURN 150 DIA", { size: 7, color: BLUE });
  } else if (disc === "ELE") {
    stroke(BLUE, 3);
    line(110, 500, 800, 500);
    text(115, 510, "MAIN LV BUSBAR 2500A", { size: 7, color: BLUE });
    stroke(BLUE, 1.2);
    [200, 350, 500, 650].forEach((x, i) => {
      line(x, 500, x, 400);
      rect(x - 12, 370, 24, 30, "S");
      line(x, 370, x, 300);
      text(x - 18, 350, `MCCB-${i + 1}`, { size: 6.5, color: BLUE });
    });
  } else {
    // CIV / STR / default: beams + hatched pour/detail zone
    stroke("0.25 0.25 0.25", 1.4);
    line(90, 635, 790, 635);
    line(90, 185, 790, 185);
    stroke("0.35 0.35 0.35", 0.5);
    for (let x = 510; x <= 770; x += 18) line(x, 110, x + 40, 410);
    stroke("0.25 0.25 0.25", 1);
    rect(510, 110, 280, 300);
    text(560, 420, "POUR / DETAIL ZONE", { size: 8, font: "F2", color: "0.3 0.3 0.3" });
  }

  // ---- review stamp ----
  stroke(RED, 1.2, "5 3");
  rect(560, 685, 270, 48);
  text(572, 709, `[${doc.status || "ISSUED FOR REVIEW"}]`, { size: 11, font: "F2", color: RED });
  text(572, 693, "ELECTRONIC REVIEW STAMP - DOCFLOW AI (POC)", { size: 5.5, color: GREY });

  // ---- inline markup clouds for real comments ----
  const anchors = [
    [255, 585],
    [560, 448],
    [345, 235],
  ];
  const marked = (comments || []).slice(0, anchors.length);
  marked.forEach((c, i) => {
    const [ax, ay] = anchors[i];
    stroke(RED, 1.1, "4 2");
    rect(ax - 48, ay - 24, 96, 48);
    stroke(RED, 1.2);
    fill("1 1 1");
    circle(ax + 48, ay + 24, 9.5, "B");
    text(ax + 45, ay + 20.5, String(i + 1), { size: 9, font: "F2", color: RED });
  });

  // ---- right panel: review comments ----
  const px = 875;
  text(px, 798, "REVIEW COMMENTS / INLINE MARKUPS", { size: 8.5, font: "F2" });
  stroke("0 0 0", 0.7);
  line(px, 792, 1165, 792);
  let y = 776;
  const list = comments || [];
  if (!list.length) {
    text(px, y, "No review comments on record.", { size: 7.5, color: GREY });
  }
  let shown = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const body = wrapText(c.text, 56);
    const needed = 22 + body.length * 9.5;
    if (y - needed < 265) break;
    stroke(RED, 1);
    fill("1 1 1");
    circle(px + 7, y + 2, 8, "B");
    text(px + 4.5, y - 1, String(i + 1), { size: 8, font: "F2", color: RED });
    text(px + 20, y, `${c.author} (${c.role})`, { size: 7.5, font: "F2" });
    y -= 10;
    text(px + 20, y, c.timestamp, { size: 6.5, color: GREY });
    y -= 11;
    for (const ln of body) {
      text(px + 20, y, ln, { size: 7.5 });
      y -= 9.5;
    }
    y -= 9;
    shown++;
  }
  if (shown < list.length)
    text(px, y, `+ ${list.length - shown} more comment(s) - open the document in DocFlow AI.`, {
      size: 7,
      color: GREY,
    });
  if (marked.length)
    text(px, 260, "Markers 1-3 correspond to clouded areas on the drawing.", { size: 6.5, color: GREY });

  // ---- title block ----
  const tx = 870, ty = 35, tw = 295;
  stroke("0 0 0", 1.2);
  rect(tx, ty, tw, 215);
  stroke("0 0 0", 0.6);
  [215, 172, 122, 92, 62].forEach((dy) => line(tx, ty + dy - 0.001, tx + tw, ty + dy - 0.001));
  text(tx + 10, ty + 198, "SP ENGINEERING (MAIN CONTRACTOR)", { size: 9, font: "F2" });
  text(tx + 10, ty + 186, doc.originator_org || "", { size: 6.5, color: GREY });
  text(tx + 10, ty + 176, `PROJECT: ${doc.project_id || ""}`, { size: 7 });
  text(tx + 10, ty + 158, "TITLE", { size: 5.5, color: GREY });
  wrapText(doc.title || "", 52)
    .slice(0, 2)
    .forEach((ln, i) => text(tx + 10, ty + 146 - i * 10, ln, { size: 7.5, font: "F2" }));
  text(tx + 10, ty + 112, "DOCUMENT NO.", { size: 5.5, color: GREY });
  text(tx + 10, ty + 100, doc.doc_number || "", { size: 9.5, font: "F2" });
  text(tx + 195, ty + 112, "REV", { size: 5.5, color: GREY });
  text(tx + 195, ty + 100, String(doc.revision || "-"), { size: 9.5, font: "F2" });
  text(tx + 240, ty + 112, "SCALE", { size: 5.5, color: GREY });
  text(tx + 240, ty + 100, "NTS", { size: 8 });
  text(tx + 10, ty + 82, "TYPE", { size: 5.5, color: GREY });
  text(tx + 10, ty + 70, `${doc.type || ""} / ${doc.discipline || ""}`, { size: 7.5 });
  text(tx + 160, ty + 82, "DATE", { size: 5.5, color: GREY });
  text(tx + 160, ty + 70, attachment.date || doc.submitted_date || "", { size: 7.5 });
  text(tx + 10, ty + 50, "STATUS", { size: 5.5, color: GREY });
  text(tx + 10, ty + 36, `[${doc.status || ""}]`, { size: 8.5, font: "F2", color: RED });
  text(tx + 10, ty + 12, `FILE: ${attachment.file_name || ""}`, { size: 6, color: GREY });

  // ---- footer note ----
  text(
    30,
    30,
    "Placeholder drawing generated by DocFlow AI (POC) at download time - NOT a controlled document. Original file content is not stored in this demo.",
    { size: 6.5, color: GREY }
  );

  // ---- assemble PDF ----
  const content = ops.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1190 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { makeDrawingPdf, pdfEscape, wrapText };
}
