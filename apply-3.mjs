// apply-3.mjs — thay extractNumberFromContent bằng phiên bản mạnh (pattern cron-sync)
import { readFileSync, writeFileSync } from "node:fs";
const p = "app/api/v1/metrics/refresh-all/route.ts";
let src = readFileSync(p, "utf8");

const start = src.indexOf("function extractNumberFromContent");
if (start < 0) throw new Error("Khong thay extractNumberFromContent");
const braceStart = src.indexOf("{", start);
let depth = 0, end = -1;
for (let i = braceStart; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) throw new Error("Khong tim end brace extractNumberFromContent");

const newExtract = `function extractNumberFromContent(content: string, specificKey?: string): number | null {
  if (!content) return null;
  const trimmed = content.trim();

  try {
    const parsedJson = JSON.parse(trimmed);
    if (typeof parsedJson === "number") return isNaN(parsedJson) ? null : parsedJson;
    if (typeof parsedJson === "string" && !isNaN(Number(parsedJson))) return Number(parsedJson);
    if (typeof parsedJson === "object" && parsedJson !== null) {
      if (specificKey) {
        const cleanKey = specificKey.toLowerCase().replace(/^(b1_|b2_)/, "");
        const candidates = [specificKey, cleanKey, "value", "total", "count", "quantity", "so_luong", "tong", "data", "result"];
        for (const k of candidates) {
          if (typeof parsedJson[k] === "number") return parsedJson[k];
          if (typeof parsedJson[k] === "string" && !isNaN(Number(parsedJson[k]))) return Number(parsedJson[k]);
        }
      }
      for (const k of ["value", "total", "count", "quantity", "so_luong", "tong", "data", "result"]) {
        if (typeof parsedJson[k] === "number") return parsedJson[k];
        if (typeof parsedJson[k] === "string" && !isNaN(Number(parsedJson[k]))) return Number(parsedJson[k]);
      }
    }
  } catch {
    // Khong phai JSON -> xu ly HTML
  }

  // Pattern CHUAN (giong cron-sync / sync-live): class/id/meta/nhan tieng Viet
  const regexPatterns: RegExp[] = [
    /<(?:span|div|b|strong|p|h\\d)[^>]*class="[^"]*(?:count|total|stat|number|value|qty|badge|highlight)[^"]*"[^>]*>\\s*([\\d.,]+)\\s*<\\//i,
    /<(?:span|div|b|strong|p|h\\d)[^>]*id="[^"]*(?:count|total|stat|number|value|qty)[^"]*"[^>]*>\\s*([\\d.,]+)\\s*<\\//i,
    /<meta\\s+property="[^"]*(?:count|total|value)[^"]*"\\s+content="([\\d.,]+)"/i,
    /(?:Tổng|Số lượng|Hiện có|Đã có|SME|HKD|HTX)\\s*[:\-]?\\s*([\\d.,]+)/i,
  ];

  for (const regex of regexPatterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/,/g, "").replace(/\\.(?=\\d{3})/g, "");
      const val = parseFloat(cleanNum);
      if (!isNaN(val) && val >= 0) return val;
    }
  }

  // Bo script/style roi moi tim so trong van ban rut gon
  const strippedText = trimmed
    .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, " ")
    .replace(/<style\\b[^<]*(?:(?!<\\/style>)<[^<]*)*<\\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\s+/g, " ");

  const directNum = Number(strippedText.replace(/,/g, "").trim());
  if (!isNaN(directNum) && strippedText !== "") return directNum;

  const fallbackMatch = strippedText.match(/(\\b\\d{1,3}(?:[.,]\\d{3})*(?:\\.\\d+)?\\b|\\b\\d+\\b)/);
  if (fallbackMatch && fallbackMatch[1]) {
    const cleanNum = fallbackMatch[1].replace(/,/g, "").replace(/\\.(?=\\d{3})/g, "");
    const val = parseFloat(cleanNum);
    if (!isNaN(val)) return val;
  }

  return null;
}`;

src = src.slice(0, start) + newExtract + src.slice(end + 1);
writeFileSync(p, src, "utf8");
console.log("apply-3 OK - extractNumberFromContent");