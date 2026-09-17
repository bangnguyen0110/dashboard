import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PROV = "e1dec74a-eefa-4452-b72d-2ef34e43dc9d"; // Tỉnh An Giang
const COMMUNE = "9527d393-5d12-4a96-999b-458e60199c45"; // Xã An Phú

function callExport(dashboardId, format, scope, outFile) {
  writeFileSync("test-body.json", JSON.stringify({ dashboardId, format, scope }));
  execFileSync("curl.exe", [
    "-s", "-m", "110", "-X", "POST",
    "http://localhost:3111/api/v1/reports/export",
    "-H", "Content-Type: application/json",
    "--data-binary", "@test-body.json",
    "-o", "test-res.json",
  ], { cwd: "c:/Users/LAPTOP cua Bang/Downloads/dashboard", stdio: "ignore" });
  const j = JSON.parse(readFileSync("test-res.json", "utf8"));
  if (!j.success) throw new Error("API fail: " + j.error);
  const b = Buffer.from(j.fileBase64, "base64");
  writeFileSync(outFile, b);
  return { name: j.fileName, bytes: b.length };
}

// ===== 1 & 3: XLSX layout mới + số liệu Tầng 1 từ metadata =====
{
  const r = callExport(COMMUNE, "xlsx", "all", "test-out-xa.xlsx");
  console.log(`[Xã-Excel] ${r.name} ${r.bytes}B`);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(readFileSync("test-out-xa.xlsx"), { type: "buffer" });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
    console.log(`  ${name}: header=${JSON.stringify(rows[0])}`);
    console.log(`  ${name}: row1=${JSON.stringify(rows[1])}`);
  }
}
{
  const r = callExport(PROV, "xlsx", "all", "test-out-tinh.xlsx");
  console.log(`[Tỉnh-Excel] ${r.name} ${r.bytes}B`);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(readFileSync("test-out-tinh.xlsx"), { type: "buffer" });
  const t1 = XLSX.utils.sheet_to_json(wb.Sheets["Tang 1"], { header: 1 });
  const nonZero = t1.slice(1).filter((r) => r.slice(2).some((v) => Number(v) > 0)).length;
  console.log(`  Tang 1: ${t1.length - 1} đơn vị | dòng có số liệu >0: ${nonZero}`);
  console.log(`  Row Tỉnh: ${JSON.stringify(t1[1]).slice(0, 160)}`);
}

// ===== 1: PDF tiếng Việt có dấu =====
{
  const r = callExport(COMMUNE, "pdf", "all", "test-out-xa.pdf");
  console.log(`[Xã-PDF] ${r.name} ${r.bytes}B`);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(() => import("pdfjs-dist/build/pdf.mjs"));
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync("test-out-xa.pdf")), useSystemFonts: true }).promise;
    const page1 = await pdf.getPage(1);
    const text = await page1.getTextContent();
    const sample = text.items.map((i) => i.str).filter((s) => s.trim()).slice(0, 8).join(" | ");
    console.log(`  PDF page1 text: ${sample}`);
    const hasDiactrics = /[áàảãạăâêôơưđÁÀẠÃÂÊÔƠƯĐ]/.test(sample);
    console.log(`  CÓ DẤU TIẾNG VIỆT: ${hasDiactrics}`);
  } finally {
    console.warn = origWarn;
  }
}

// ===== DOCX vẫn hoạt động (zero regression) =====
{
  const r = callExport(PROV, "docx", "tier1", "test-out-tinh.docx");
  console.log(`[Tỉnh-Word] ${r.name} ${r.bytes}B magic=${readFileSync("test-out-tinh.docx").subarray(0, 2).toString()}`);
}
console.log("DONE");