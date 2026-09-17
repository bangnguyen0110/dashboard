import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const DIR = "c:/Users/LAPTOP cua Bang/Downloads/dashboard";
const OUT = DIR + "/app/api/v1/reports/export/fonts-data.ts";

function parseCmap(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = dv.getUint16(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    tables[tag] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
  }
  const cmap = tables["cmap"];
  const n = dv.getUint16(cmap.off + 2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const e = cmap.off + 4 + i * 8;
    const pid = dv.getUint16(e), eid = dv.getUint16(e + 2), soff = cmap.off + dv.getUint32(e + 4);
    const score = pid === 3 && eid === 10 ? 4 : pid === 3 && eid === 1 ? 3 : pid === 0 ? 2 : 1;
    if (!best || score > best.score) best = { off: soff, score };
  }
  const map = new Map();
  if (best) {
    const s = best.off;
    const fmt = dv.getUint16(s);
    if (fmt === 4) {
      const segX2 = dv.getUint16(s + 6);
      const seg = segX2 / 2;
      const endBase = s + 14, startBase = endBase + segX2 + 2, deltaBase = startBase + segX2, rangeBase = deltaBase + segX2;
      for (let i = 0; i < seg; i++) {
        const end = dv.getUint16(endBase + i * 2), start = dv.getUint16(startBase + i * 2);
        const delta = dv.getInt16(deltaBase + i * 2), rangeOff = dv.getUint16(rangeBase + i * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let gid;
          if (rangeOff === 0) gid = (c + delta) & 0xffff;
          else {
            const gi = rangeBase + i * 2 + rangeOff + (c - start) * 2;
            gid = dv.getUint16(gi);
            if (gid !== 0) gid = (gid + delta) & 0xffff;
          }
          if (gid !== 0) map.set(c, gid);
        }
      }
    } else if (fmt === 12) {
      const nGroups = dv.getUint32(s + 12);
      for (let g = 0; g < nGroups; g++) {
        const go = s + 16 + g * 12;
        const start = dv.getUint32(go), end = dv.getUint32(go + 4), sg = dv.getUint32(go + 8);
        for (let c = start; c <= end; c++) { const gid = sg + (c - start); if (gid) map.set(c, gid); }
      }
    }
  }
  return { map, tables, dv };
}

const tests = ["ư", "ơ", "ệ", "Ậ", "đ", "Đ", "á", "Ở"];
for (const [label, path] of [["Regular", DIR + "/assets/fonts/Roboto-Regular.ttf"], ["Bold", DIR + "/assets/fonts/Roboto-Bold.ttf"]]) {
  const bytes = new Uint8Array(readFileSync(path));
  const { map } = parseCmap(bytes);
  const missing = tests.filter((ch) => !map.has(ch.codePointAt(0)));
  console.log(`Roboto-${label}: ${bytes.length}B | glyphs=${map.size} | thiếu: ${missing.join("") || "KHÔNG (đủ tiếng Việt)"}`);
}

mkdirSync(DIR + "/app/api/v1/reports/export", { recursive: true });
const reg = readFileSync(DIR + "/assets/fonts/Roboto-Regular.ttf").toString("base64");
const bold = readFileSync(DIR + "/assets/fonts/Roboto-Bold.ttf").toString("base64");
const ts = `/**
 * FONT DỮ LIỆU NHÚNG CHO XUẤT PDF TIẾNG VIỆT (tính năng Xuất bảng báo cáo).
 *
 * Roboto Regular & Bold (Apache License 2.0 — google/fonts), hỗ trợ đầy đủ
 * bảng chữ tiếng Việt có dấu. Được nhúng dạng base64 để đảm bảo bundle được
 * cả khi deploy (Cloudflare/OpenNext) mà không cần đọc file từ hệ thống.
 *
 * TỆP NÀY ĐƯỢC SINH TỰ ĐỘNG — KHÔNG CHỈNH SỬA TRỰC TIẾP.
 */

export const PDF_FONT_REGULAR_B64 =
  "${reg}";

export const PDF_FONT_BOLD_B64 =
  "${bold}";
`;
writeFileSync(OUT, ts);
console.log("Ghi:", OUT, `(${reg.length + bold.length} ký tự base64)`);