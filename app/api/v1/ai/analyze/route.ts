import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ====================================================================
 * QUẢN LÝ 2 GEMINI API KEY (Failover Rotation) — chống lỗi 503 (High Demand)
 * --------------------------------------------------------------------
 * - Key 1: GEMINI_API_KEY hoặc GOOGLE_API_KEY
 * - Key 2: GEMINI_API_KEY_2 (lấy từ biến môi trường để tránh bị GitHub chặn push)
 * - Khi gặp lỗi 503 / UNAVAILABLE / "high demand": chờ ~1.5s rồi tự động
 *   thử lại bằng key còn lại. Cả 2 key cùng quá tải mới trả lỗi về client.
 * ==================================================================== */
const GEMINI_API_KEY_1 = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const GEMINI_API_KEY_2 = process.env.GEMINI_API_KEY_2 || "";

// Danh sách key hợp lệ (loại bỏ key rỗng để không gọi API với key trống).
const GEMINI_KEYS: string[] = [GEMINI_API_KEY_1, GEMINI_API_KEY_2].filter(Boolean);

/** Chờ đơn giản bằng setTimeout (async). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Phát hiện lỗi quá tải / dịch vụ tạm thời không khả dụng (503 High Demand). */
function isOverloadedError(status: number, errText: string): boolean {
  if (status === 503 || status === 429) return true;
  const lower = (errText || "").toLowerCase();
  return lower.includes("unavailable") || lower.includes("high demand") || lower.includes("overloaded");
}

interface GeminiCallResult {
  ok: boolean;
  status?: number;
  errText?: string;
  data?: GeminiResponse;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/**
 * Gọi Gemini generateContent với 1 key cụ thể.
 */
async function callGeminiWithKey(
  key: string,
  modelName: string,
  prompt: string
): Promise<GeminiCallResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, status: res.status, errText };
  }

  const data = await res.json();
  return { ok: true, data };
}

/**
 * Wrapper chính: thử lần lượt các key với cơ chế Failover.
 */
async function callGeminiWithFailover(
  modelName: string,
  prompt: string
): Promise<GeminiResponse> {
  const keys = GEMINI_KEYS.length > 0 ? GEMINI_KEYS : [GEMINI_API_KEY_1];

  let lastStatus = 0;
  let lastErrText = "";

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const result = await callGeminiWithKey(key, modelName, prompt);

      if (result.ok && result.data) {
        return result.data;
      }

      lastStatus = result.status ?? 0;
      lastErrText = result.errText || "";

      if (!isOverloadedError(lastStatus, lastErrText)) {
        throw new Error(`Gemini API Error: ${lastErrText}`);
      }

      if (i < keys.length - 1) {
        console.warn(
          `[Gemini Failover] Key #${i + 1} bị quá tải (HTTP ${lastStatus}). Chờ 1.5s và thử Key #${i + 2}...`
        );
        await sleep(1500);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.startsWith("Gemini API Error:")) {
        throw err;
      }
      lastErrText = lastErrText || errMsg;
      if (i < keys.length - 1) {
        console.warn(
          `[Gemini Failover] Key #${i + 1} gặp sự cố (${lastErrText.slice(0, 200)}). Chờ 1.5s và thử Key #${i + 2}...`
        );
        await sleep(1500);
      }
    }
  }

  throw new Error(
    `Gemini API Error: Tất cả API key đều bị quá tải hoặc không khả dụng (HTTP ${lastStatus}). ${lastErrText.slice(0, 500)}`
  );
}

function cleanMarkdownToPlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .trim();
}

/* ====================================================================
 * TRỢ LÝ AI — DỮ LIỆU XÃ/PHƯỜNG TRỰC THUỘC + KIỂM SOÁT PHẠM VI (Scope)
 * ==================================================================== */

interface CommuneKpiRow {
  dashboardId: string;
  name: string;
  sme: number;
  hkd: number;
  htx: number;
  smeDx: number;
  hkdDx: number;
  htxDx: number;
  dxTotal: number;
  dxRate: string;
  ocop3: number;
  ocop4: number;
  ocop5: number;
  ocopTotal: number;
}

interface SupaUnitLite {
  id: string;
  name: string;
}

interface SupaDashLite {
  id: string;
  unit_id: string;
}

type DynEItem = { title?: string; value?: string | number };
interface SupaUnitName { name?: string | null; }

function toSafeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normVi(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortCommuneName(name: string): string {
  return normVi(name)
    .replace(/^(xa|phuong|thi tran|thi xa|thanh pho|dac khu|huyen|quan)\s+/, "")
    .trim();
}

function resolveDashUnit(dash: unknown): Record<string, unknown> | null {
  const u = (dash as { unit?: unknown } | null)?.unit;
  if (Array.isArray(u)) return (u[0] as Record<string, unknown>) || null;
  return (u as Record<string, unknown>) || null;
}

async function fetchProvinceCommuneDataset(provinceUnitId: string): Promise<CommuneKpiRow[] | null> {
  try {
    if (!provinceUnitId) return null;

    const { data: childUnits, error: unitErr } = await supabase
      .from("administrative_units")
      .select("id, name")
      .eq("parent_id", provinceUnitId)
      .order("name")
      .limit(300);
    if (unitErr || !childUnits || childUnits.length === 0) return null;

    const unitIds = childUnits.map((u: SupaUnitLite) => u.id);
    const nameByUnit = new Map<string, string>(childUnits.map((u: SupaUnitLite) => [u.id, u.name]));

    const dashRows: Array<{ id: string; unit_id: string }> = [];
    for (let i = 0; i < unitIds.length; i += 100) {
      const chunk = unitIds.slice(i, i + 100);
      const { data } = await supabase
        .from("dashboards")
        .select("id, unit_id")
        .in("unit_id", chunk)
        .limit(500);
      if (data) dashRows.push(...(data as SupaDashLite[]));
    }
    if (dashRows.length === 0) return null;

    const dashIds = dashRows.map((d) => d.id);
    const b1By = new Map<string, Record<string, unknown>>();
    const b2By = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < dashIds.length; i += 100) {
      const chunk = dashIds.slice(i, i + 100);
      const [b1Res, b2Res] = await Promise.all([
        supabase.from("kpi_business_units").select("*").in("dashboard_id", chunk).limit(500),
        supabase.from("kpi_products").select("*").in("dashboard_id", chunk).limit(500),
      ]);
      ((b1Res.data || []) as Array<Record<string, unknown>>).forEach((r) =>
        b1By.set(String(r.dashboard_id), r)
      );
      ((b2Res.data || []) as Array<Record<string, unknown>>).forEach((r) =>
        b2By.set(String(r.dashboard_id), r)
      );
    }

    return dashRows.map((d) => {
      const b1 = b1By.get(d.id) || {};
      const b2 = b2By.get(d.id) || {};
      const sme = toSafeNum(b1.sme_total);
      const hkd = toSafeNum(b1.hkd_total);
      const htx = toSafeNum(b1.htx_total);
      const smeDx = toSafeNum(b1.sme_dx) || toSafeNum(b1.sme_cds);
      const hkdDx = toSafeNum(b1.hkd_dx) || toSafeNum(b1.hkd_cds);
      const htxDx = toSafeNum(b1.htx_dx) || toSafeNum(b1.htx_cds);
      const dxTotal = smeDx + hkdDx + htxDx;
      const base = sme + hkd + htx;
      const ocop3 = toSafeNum(b2.ocop_3star) || toSafeNum(b2.ocop_3);
      const ocop4 = toSafeNum(b2.ocop_4star) || toSafeNum(b2.ocop_4);
      const ocop5 = toSafeNum(b2.ocop_5star) || toSafeNum(b2.ocop_5);
      return {
        dashboardId: d.id,
        name: nameByUnit.get(d.unit_id) || d.id,
        sme,
        hkd,
        htx,
        smeDx,
        hkdDx,
        htxDx,
        dxTotal,
        dxRate: base > 0 ? ((dxTotal / base) * 100).toFixed(1) : "0",
        ocop3,
        ocop4,
        ocop5,
        ocopTotal: ocop3 + ocop4 + ocop5,
      };
    });
  } catch {
    return null;
  }
}

const COMMUNE_INTENT_WORDS = [
  "xa", "phuong", "thi tran", "xa phuong", "top", "dan dau", "dung cuoi",
  "xep hang", "bang xep hang", "so sanh", "liet ke", "thong ke", "ocop",
];

const CROSS_SCOPE_WORDS = [
  "top", "dan dau", "dung cuoi", "xep hang", "bang xep hang",
  "so sanh", "cac xa", "cac phuong", "xa khac", "phuong khac",
  "xa nao", "phuong nao", "toan tinh", "ca tinh", "khap tinh",
  "dia phuong khac", "dia ban khac", "truc thuoc",
];

function hasNormPhrase(haystack: string, phrase: string): boolean {
  const p = phrase.trim().replace(/\s+/g, " ");
  if (!p) return false;
  return ` ${haystack} `.includes(` ${p} `);
}

function mentionsCommuneIntent(qNorm: string): boolean {
  return COMMUNE_INTENT_WORDS.some((w) => hasNormPhrase(qNorm, w));
}

function findMentionedCommunes(qNorm: string, rows: CommuneKpiRow[]): CommuneKpiRow[] {
  const hits: CommuneKpiRow[] = [];
  for (const row of rows) {
    const full = normVi(row.name);
    const short = shortCommuneName(row.name);
    if (full.length >= 3 && hasNormPhrase(qNorm, full)) {
      hits.push(row);
      continue;
    }
    if (short.length >= 4 && hasNormPhrase(qNorm, short)) hits.push(row);
  }
  return hits;
}

function formatCommuneLine(r: CommuneKpiRow): string {
  return (
    `- ${r.name}: SME ${r.sme} (CDS ${r.smeDx}) | ` +
    `HKD ${r.hkd} (CDS ${r.hkdDx}) | HTX ${r.htx} (CDS ${r.htxDx}) | ` +
    `Tong CDS ${r.dxTotal} (ty le ${r.dxRate}%) | ` +
    `OCOP 3s/4s/5s: ${r.ocop3}/${r.ocop4}/${r.ocop5} (tong ${r.ocopTotal})`
  );
}

function buildProvinceQaPrompt(
  provinceName: string,
  rows: CommuneKpiRow[],
  mentioned: CommuneKpiRow[],
  question: string
): string {
  const sum = (pick: (r: CommuneKpiRow) => number): number =>
    rows.reduce((acc, r) => acc + pick(r), 0);
  const bySmeDx = [...rows].sort((a, b) => b.smeDx - a.smeDx);
  const byRate = [...rows].sort((a, b) => parseFloat(b.dxRate) - parseFloat(a.dxRate));
  const byOcop = [...rows].sort((a, b) => b.ocopTotal - a.ocopTotal);
  const topList = (list: CommuneKpiRow[], pick: (r: CommuneKpiRow) => string): string =>
    list.slice(0, 5).map((r, i) => `${i + 1}. ${r.name} (${pick(r)})`).join("; ") || "Chua co du lieu.";
  const bottomList = (list: CommuneKpiRow[], pick: (r: CommuneKpiRow) => string): string =>
    list.slice(-5).reverse().map((r, i) => `${i + 1}. ${r.name} (${pick(r)})`).join("; ") || "Chua co du lieu.";
  const focus =
    mentioned.length > 0
      ? `\n[XA DUOC HOI TRUC TIEP]\n${mentioned.map(formatCommuneLine).join("\n")}\n`
      : "";
  return `Ban la Co van Cap cao ve Chuyen doi so va Kinh te so dia phuong tai Viet Nam.
PHAM VI DU LIEU: Ban dang ho tro o cap Tinh (${provinceName}). Ban co quyen truy xuat, tong hop va phan tich du lieu cua toan bo ${rows.length} xa/phuong truc thuoc duoi day.

BANG SO LIEU THUC TE CAC XA/PHUONG TRUC THUOC (nguon duy nhat duoc phep dung):
[TONG HOP TOAN TINH] SME: ${sum((r) => r.sme)} (CDS ${sum((r) => r.smeDx)}) | HKD: ${sum((r) => r.hkd)} (CDS ${sum((r) => r.hkdDx)}) | HTX: ${sum((r) => r.htx)} (CDS ${sum((r) => r.htxDx)}) | Tong CDS: ${sum((r) => r.dxTotal)} | OCOP 3s/4s/5s: ${sum((r) => r.ocop3)}/${sum((r) => r.ocop4)}/${sum((r) => r.ocop5)}.
${focus}[XEP HANG SME CDS] Top 5: ${topList(bySmeDx, (r) => `${r.smeDx} DN`)} | Cuoi 5: ${bottomList(bySmeDx, (r) => `${r.smeDx} DN`)}.
[XEP HANG TY LE CDS] Top 5: ${topList(byRate, (r) => `${r.dxRate}%`)} | Cuoi 5 (yeu nhat): ${bottomList(byRate, (r) => `${r.dxRate}%`)}.
[XEP HANG OCOP] Top 5: ${topList(byOcop, (r) => `${r.ocopTotal} SP`)} | Cuoi 5: ${bottomList(byOcop, (r) => `${r.ocopTotal} SP`)}.
[CHI TIET TUNG XA]
${rows.map(formatCommuneLine).join("\n")}

CAU HOI CUA NGUOI DUNG:
"${question}"

YEU CAU TRA LOI:
1. Chi dung so lieu trong bang tren; tuyet doi khong tu bia so lieu. Neu cau hoi nhac xa khog co trong bang, hay noi ro khong co du lieu.
2. Voi cau hoi top/cuoi/so sanh/xa yeu: dua dung thu hang da cho, neu ten va con so cu the tung xa.
3. KHONG DUNG BAT KY KY TU MARKDOWN NAO (Khong dung *, **, #, _, >).`;
}

async function fetchOwnCommuneLine(
  dash: { id: string } | null | undefined,
  communeName: string
): Promise<string | null> {
  try {
    const dashId = dash?.id;
    if (!dashId) return null;
    const [b1Res, b2Res] = await Promise.all([
      supabase.from("kpi_business_units").select("*").eq("dashboard_id", dashId).maybeSingle(),
      supabase.from("kpi_products").select("*").eq("dashboard_id", dashId).maybeSingle(),
    ]);
    const b1 = ((b1Res.data || {}) as Record<string, unknown>) || {};
    const b2 = ((b2Res.data || {}) as Record<string, unknown>) || {};
    const row: CommuneKpiRow = {
      dashboardId: dashId,
      name: communeName,
      sme: toSafeNum(b1.sme_total),
      smeDx: toSafeNum(b1.sme_dx) || toSafeNum(b1.sme_cds),
      hkd: toSafeNum(b1.hkd_total),
      hkdDx: toSafeNum(b1.hkd_dx) || toSafeNum(b1.hkd_cds),
      htx: toSafeNum(b1.htx_total),
      htxDx: toSafeNum(b1.htx_dx) || toSafeNum(b1.htx_cds),
      dxTotal: 0,
      dxRate: "0",
      ocop3: toSafeNum(b2.ocop_3sao ?? b2.ocop_3_sao),
      ocop4: toSafeNum(b2.ocop_4sao ?? b2.ocop_4_sao),
      ocop5: toSafeNum(b2.ocop_5sao ?? b2.ocop_5_sao),
      ocopTotal: 0,
    };
    row.dxTotal = row.smeDx + row.hkdDx + row.htxDx;
    const base = row.sme + row.hkd + row.htx;
    row.dxRate = base > 0 ? ((row.dxTotal / base) * 100).toFixed(1) : "0";
    row.ocopTotal = row.ocop3 + row.ocop4 + row.ocop5;
    return formatCommuneLine(row);
  } catch {
    return null;
  }
}

async function fetchSiblingCommuneNames(provinceUnitId: string): Promise<string[]> {
  try {
    if (!provinceUnitId) return [];
    const { data } = await supabase
      .from("administrative_units")
      .select("name")
      .eq("parent_id", provinceUnitId)
      .limit(500);
    return (((data || []) as SupaUnitName[]) || [])
      .map((u) => u.name || "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isCrossCommuneRequest(qNorm: string, currentName: string, siblings: string[]): boolean {
  if (CROSS_SCOPE_WORDS.some((w) => hasNormPhrase(qNorm, w))) return true;
  const curFull = normVi(currentName);
  const curShort = shortCommuneName(currentName);
  for (const n of siblings) {
    const full = normVi(n);
    const short = shortCommuneName(n);
    if (full === curFull || short === curShort) continue;
    if (curFull.includes(full) || curFull.includes(short)) continue;
    if (full.length >= 3 && hasNormPhrase(qNorm, full)) return true;
    if (short.length >= 4 && hasNormPhrase(qNorm, short)) return true;
  }
  return false;
}

type ScopedQa = { refused: true; message: string } | { refused: false; prompt: string };

async function resolveScopedQa(
  args: {
    question: string;
    isProvince: boolean;
    provinceUnitId: string;
    communeName: string;
    communeParentId: string;
    dash?: unknown;
  }
): Promise<ScopedQa> {
  const { question, isProvince, provinceUnitId, communeName, communeParentId, dash } = args;
  if (isProvince) {
    const scopeLine =
      `PHẠM VI DỮ LIỆU: Bạn đang hỗ trợ ở cấp Tỉnh (${communeName}). ` +
      `Bạn có quyền truy xuất, tổng hợp và phân tích dữ liệu của toàn bộ các xã/phường trực thuộc.\n` +
      `QUY TẮC SỐ LIỆU: Chỉ sử dụng số liệu thực tế được cung cấp; tuyệt đối không tự bịa số liệu.\n\n`;
    const qNorm = normVi(question);
    if (!mentionsCommuneIntent(qNorm)) return { refused: false, prompt: `${scopeLine}${question}` };
    const rows = await fetchProvinceCommuneDataset(provinceUnitId);
    if (!rows || rows.length === 0) {
      return {
        refused: false,
        prompt:
          `${scopeLine}CAU HOI: ${question}\n` +
          `(Lưu ý: Hiện chưa truy xuất được bảng xã/phường trực thuộc, hãy trả lời dựa trên số liệu tổng đã biết và nêu rõ hạn chế dữ liệu.)`,
      };
    }
    const mentioned = findMentionedCommunes(qNorm, rows);
    return { refused: false, prompt: buildProvinceQaPrompt(communeName, rows, mentioned, question) };
  }

  // ---- Cấp Xã/Phường: Strictly Isolated ----
  const qNorm = normVi(question);
  const siblings = communeParentId ? await fetchSiblingCommuneNames(communeParentId) : [];
  if (isCrossCommuneRequest(qNorm, communeName, siblings)) {
    return {
      refused: true,
      message:
        `Tôi đang hỗ trợ ở Dashboard của xã ${communeName}. Theo quy định phân quyền dữ liệu, ` +
        `tôi chỉ được phép phân tích dữ liệu của riêng xã này nên không thể cung cấp hay so sánh số liệu của các xã/phường khác.\n` +
        `Để xem bức tranh toàn tỉnh (xếp hạng, top/cuối, so sánh OCOP giữa các xã), vui lòng mở Dashboard cấp Tỉnh và hỏi Trợ lý AI tại đó. ` +
        `Nếu cần, bạn có thể đặt câu hỏi về số liệu chuyển đổi số, SME, HKD, HTX hoặc OCOP của riêng xã ${communeName}.`,
    };
  }

  const own = await fetchOwnCommuneLine(
    dash as unknown as { id: string } | null,
    communeName
  );
  
  const scopeLine =
    `PHẠM VI DỮ LIỆU (TUYỆT ĐỐI): Bạn đang hỗ trợ ở Dashboard của xã ${communeName}. ` +
    `Bạn chỉ được phép thảo luận và phân tích dữ liệu của riêng xã này${own ? ` theo SỐ LIỆU THỰC TẾ dưới đây` : ``}. ` +
    `Tuyệt đối không cung cấp, so sánh hay suy đoán số liệu của bất kỳ xã/phường nào khác; ` +
    `nếu bị hỏi, hãy từ chối và hướng người dùng lên Dashboard cấp Tỉnh.\n` +
    (own
      ? `SỐ LIỆU THỰC TẾ CỦA XÃ ${communeName} (nguồn duy nhất được phép dùng):\n${own}\n`
      : `(Lưu ý: hiện chưa truy xuất được số liệu KPI của xã này; hãy nêu rõ hạn chế, không tự bịa số liệu.)\n`) +
    `QUY TẮC SỐ LIỆU: Chỉ sử dụng số liệu thực tế của xã ${communeName} vừa cho; tuyệt đối không tự bịa số liệu.\n\n`;

  return { refused: false, prompt: `${scopeLine}${question}` };
}

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, level = 0, scope = "all", forceRefresh = false, customPrompt } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    const { data: dash, error: dashErr } = await supabase
      .from("dashboards")
      .select("id, title, unit_id, metadata, unit:administrative_units(id, name, type, parent_id)")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !dash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard" }, { status: 404 });
    }

    if (GEMINI_KEYS.length === 0) {
      return NextResponse.json(
        { success: false, error: "Chưa cấu hình GEMINI_API_KEY hoặc GEMINI_API_KEY_2 trong biến môi trường" },
        { status: 500 }
      );
    }

    const [b1Res, b2Res] = await Promise.all([
      supabase
        .from("kpi_business_units")
        .select("*")
        .eq("dashboard_id", dashboardId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("kpi_products")
        .select("*")
        .eq("dashboard_id", dashboardId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    interface DashAny {
      b1?: Record<string, unknown>;
      b2?: Record<string, unknown>;
      b3?: Record<string, unknown>;
      level2?: Record<string, unknown>;
      metadata?: {
        b1?: Record<string, unknown>;
        b2?: Record<string, unknown>;
        b3?: Record<string, unknown>;
        level2?: Record<string, unknown>;
        level2_e_items?: Array<{ title?: string; value?: string | number }>;
        ai_analysis?: Record<string, { content: string; updated_at: string }>;
      };
    }

    type DashCast = DashAny & { title?: string; unit_id?: string };

    const dashAny = dash as unknown as DashCast;
    const b1 = b1Res.data || dashAny.b1 || dashAny.metadata?.b1 || {};
    const b2 = b2Res.data || dashAny.b2 || dashAny.metadata?.b2 || {};

    let promptToRun = customPrompt;

    const dashUnit = resolveDashUnit(dash);
    const isProvince = dashUnit?.type === "PROVINCE";
    const scopeName: string = dashUnit?.name || dash.title || "Địa phương";
    const scopeUnitId: string | null = dashUnit?.id || dash.unit_id || null;

    if (promptToRun) {
      const resolved = await resolveScopedQa({
        question: String(promptToRun),
        isProvince,
        provinceUnitId: isProvince ? String(scopeUnitId || "") : "",
        communeName: scopeName,
        communeParentId: isProvince ? "" : String(String(dashUnit?.parent_id || "")),
        dash,
      });
      if (resolved.refused) {
        return NextResponse.json({ success: true, data: resolved.message });
      }
      promptToRun = resolved.prompt;
    }

    if (!promptToRun) {
      const cacheKey = scope || (level === 0 ? "all" : `level_${level}`);
      const cachedAnalysis = dash.metadata?.ai_analysis?.[cacheKey];

      if (cachedAnalysis && !forceRefresh) {
        return NextResponse.json({
          success: true,
          data: cachedAnalysis.content,
          updatedAt: cachedAnalysis.updated_at,
          isCached: true,
        });
      }

      const unitName = scopeName;
      const unitType = isProvince ? "Cấp Tỉnh" : "Cấp Xã/Phường";

      const totalUnits = Number(b1.sme_total || 0) + Number(b1.hkd_total || 0) + Number(b1.htx_total || 0);
      const totalDx = Number(b1.sme_dx || b1.sme_cds || 0) + Number(b1.hkd_dx || b1.hkd_cds || 0) + Number(b1.htx_dx || b1.htx_cds || 0);
      const dxRate = totalUnits > 0 ? ((totalDx / totalUnits) * 100).toFixed(1) : "0";

      const b3 = dashAny.b3 || dashAny.metadata?.b3 || {};
      const l2 = dashAny.level2 || dashAny.metadata?.level2 || {};
      const dynamicE = dashAny.metadata?.level2_e_items || [];

      let scopeExtra = "";
      if (isProvince && scopeUnitId) {
        const rows = await fetchProvinceCommuneDataset(String(scopeUnitId));
        if (rows && rows.length > 0) {
          const bySmeDx = [...rows].sort((a, b) => b.smeDx - a.smeDx);
          const byRate = [...rows].sort((a, b) => parseFloat(b.dxRate) - parseFloat(a.dxRate));
          const byOcop = [...rows].sort((a, b) => b.ocopTotal - a.ocopTotal);
          const pick = (list: CommuneKpiRow[], k: (r: CommuneKpiRow) => string): string =>
            list.slice(0, 5).map((r, i) => `${i + 1}. ${r.name} (${k(r)})`).join("; ") || "Chua co.";
          scopeExtra =
            `\n[3. BUC TRANH XA/PHUONG TRUC THUOC - ${rows.length} XA ` +
            `(chi dung so lieu duoi day, khong tu bia)]\n` +
            `- Xep hang SME CDS: Top 5: ${pick(bySmeDx, (r) => `${r.smeDx} DN`)} | ` +
            `Cuoi 5: ${pick([...bySmeDx].reverse(), (r) => `${r.smeDx} DN`)}.\n` +
            `- Xep hang ty le CDS: Top 5: ${pick(byRate, (r) => `${r.dxRate}%`)} | ` +
            `Yeu nhat: ${pick([...byRate].reverse(), (r) => `${r.dxRate}%`)}.\n` +
            `- Xep hang OCOP: Top 5: ${pick(byOcop, (r) => `${r.ocopTotal} SP`)}.\n` +
            `- Quyen phan tich: cap Tinh duoc phep so sanh, xep hang, danh gia chi tiet tung xa/phuong trong bang duoi day.\n` +
            rows.map(formatCommuneLine).join("\n") + "\n";
        }
      } else if (!isProvince) {
        scopeExtra =
          `\n[3. PHAM VI XA/PHUONG - ${scopeName}] ` +
          `Chi duoc phep phan tich du lieu cua rieng xa nay, ` +
          `tuyet doi khong so sanh hay suy doan so lieu cac xa/phuong khac, khong tu bia so lieu.\n`;
      }

      const contextData = `
BÁO CÁO CƠ SỞ DỮ LIỆU ĐỊA BÀN: ${unitName.toUpperCase()} (${unitType.toUpperCase()})

[1. DỮ LIỆU TẦNG 1 - TỔNG QUAN KINH TẾ ĐỊA BÀN & CHUYỂN ĐỔI SỐ]
- Tổng số đơn vị kinh tế: ${totalUnits} cơ sở.
  + Doanh nghiệp nhỏ và vừa (SME): ${b1.sme_total || 0} DN (Đã CĐS: ${b1.sme_dx || b1.sme_cds || 0} DN).
  + Hộ kinh doanh cá thể: ${b1.hkd_total || 0} hộ (Đã CĐS: ${b1.hkd_dx || b1.hkd_cds || 0} hộ).
  + Hợp tác xã (HTX): ${b1.htx_total || 0} HTX (Đã CĐS: ${b1.htx_dx || b1.htx_cds || 0} HTX).
- Tỷ lệ chuyển đổi số chung: ${dxRate}%.
- Sản phẩm OCOP & Đặc sản địa phương: 
  + OCOP 3 sao: ${b2.ocop_3star || b2.ocop_3 || 0} SP
  + OCOP 4 sao: ${b2.ocop_4star || b2.ocop_4 || 0} SP
  + OCOP 5 sao: ${b2.ocop_5star || b2.ocop_5 || 0} SP
- Doanh thu ghi nhận: ${b3.doanh_thu || 0} triệu VNĐ.

[2. DỮ LIỆU TẦNG 2 - BỘ TIÊU CHÍ HỆ SINH THÁI SỐ (NHÓM A - E)]
- Nhóm A (Hạ tầng số): DN số hóa=${l2.l2_a_dn_cds_year || l2.l2_a_dn_cds || 0}, Cloud=${l2.l2_a_cloud_year || l2.l2_a_cloud || 0}.
- Nhóm B (TMĐT): Website=${l2.l2_b_web_year || l2.l2_b_web_ecom || 0}, Đơn hàng=${l2.l2_b_don_hang_year || l2.l2_b_don_hang || 0}.
- Nhóm C (Vận hành): ERP=${l2.l2_c_erp_year || l2.l2_c_erp || 0}.
- Nhóm D (Thị trường): Lượt xem=${l2.l2_d_trang_xem_year || l2.l2_d_trang_xem || 0}.
- Nhóm E (Bóc tách hệ sinh thái):
${dynamicE.length > 0 ? dynamicE.map((i: DynEItem) => `  - ${i.title}: ${i.value}`).join("\n") : "  - Không có mục bổ sung."}
${scopeExtra}`;

      promptToRun = `
Bạn là Cố vấn Cấp cao về Chiến lược Chuyển đổi số Quốc gia và Phát triển Kinh tế số Địa phương tại Việt Nam.
Hãy nghiên cứu kỹ các số liệu thực tế dưới đây của ${unitName} (${unitType}) và lập BÁO CÁO PHÂN TÍCH HIỆN TRẠNG & TƯ VẤN HÀNH ĐỘNG ĐIỀU HÀNH.

DỮ LIỆU ĐẦU VÀO:
${contextData}

YÊU CẦU NỘI DUNG VÀ CHIỀU SÂU:
1. Đánh giá tính cân đối giữa các chủ thể (SME, Hộ kinh doanh, HTX). Chỉ rõ "vùng trũng".
2. Phân tích chiều sâu công nghệ (Bề nổi vs Vận hành thực chất).
3. Đánh giá hệ sinh thái sản phẩm và nguồn lực bản địa.
4. Đưa ra khuyến nghị hành động cấp bách (30 ngày) và trung hạn (trong năm).
5. Đưa ra 3 chỉ số mục tiêu định lượng cụ thể.

QUY CÁCH TRÌNH BÀY:
- KHÔNG DÙNG BẤT KỲ KÝ TỰ MARKDOWN NÀO (Không dùng *, **, #, _, >).
- Định dạng báo cáo chuẩn mực hành chính:
  + Các phần lớn đánh số La Mã: I., II., III., IV., V.
  + Các mục con dùng số: 1., 2., 3.
  + Ý chi tiết dùng gạch đầu dòng (-) hoặc a., b.
`;
    }

    // Sửa đoạn này trong file app/api/v1/ai/analyze/route.ts:
    const MODEL_NAME = "gemini-3.6-flash"; // Cập nhật model ổn định
    const geminiData = await callGeminiWithFailover(MODEL_NAME, promptToRun);

    const candidate = geminiData?.candidates?.[0];
    const rawAnalysisText = candidate?.content?.parts?.[0]?.text || "Không thể tạo nội dung.";
    const cleanResultText = cleanMarkdownToPlainText(rawAnalysisText);

    if (!customPrompt) {
      const cacheKey = scope || (level === 0 ? "all" : `level_${level}`);
      const nowIso = new Date().toISOString();
      const updatedMeta = {
        ...(dash.metadata || {}),
        ai_analysis: {
          ...(dash.metadata?.ai_analysis || {}),
          [cacheKey]: {
            content: cleanResultText,
            updated_at: nowIso,
          },
        },
      };
      await supabase.from("dashboards").update({ metadata: updatedMeta }).eq("id", dashboardId);
      return NextResponse.json({
        success: true,
        data: cleanResultText,
        updatedAt: nowIso,
        isCached: false,
      });
    }

    return NextResponse.json({
      success: true,
      data: cleanResultText,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Lỗi xử lý yêu cầu AI" },
      { status: 500 }
    );
  }
}