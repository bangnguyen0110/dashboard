import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { PDF_FONT_BOLD_B64, PDF_FONT_REGULAR_B64 } from "./fonts-data";

/**
 * ============================================================================
 * API XUẤT BẢNG BÁO CÁO — POST /api/v1/reports/export
 * ============================================================================
 * Body: { dashboardId, format: "docx" | "pdf" | "xlsx" }
 *
 * NỘI DUNG BÁO CÁO (cố định — chỉ TẦNG 1):
 * - kpi_business_units: SME / Hộ kinh doanh / HTX (+ chỉ số CĐS).
 * - kpi_products: OCOP 3-4-5 sao, sản phẩm thường, sản phẩm dịch vụ.
 * Lựa chọn "Phạm vi nội dung báo cáo" (Tầng 1 / Tầng 2 / Toàn bộ) đã được BỎ
 * HOÀN TOÀN ở giao diện; máy chủ cũng cố định phạm vi xuất qua hằng số
 * EXPORT_SCOPE = "tier1" — xem buildSectionsForUnit / buildXlsxBytes.
 *
 * Phạm vi dữ liệu:
 * - Dashboard cấp TỈNH (unit.type === "PROVINCE"): số liệu của Tỉnh VÀ danh sách
 *   toàn bộ Xã/Phường trực thuộc. Nếu bảng KPI riêng của Tỉnh (kpi_business_units
 *   / kpi_products) CHƯA CÓ BẢN GHI hoặc BẰNG 0 thì hệ thống tự động CỘNG DỒN
 *   (SUM) chỉ tiêu đó từ các Xã/Phường trực thuộc — xem applyProvinceTier1Fallback.
 * - Dashboard cấp XÃ/PHƯỜNG (mặc định): CÔ LẬP NGHIÊM NGẶT — chỉ truy vấn đúng
 *   dashboard đó, tuyệt đối không lấy dữ liệu Tỉnh hoặc các Xã khác.
 * ============================================================================
 */

type ExportFormat = "docx" | "pdf" | "xlsx";
type ExportScope = "all" | "tier1" | "tier2";

const ALLOWED_FORMATS: ExportFormat[] = ["docx", "pdf", "xlsx"];

/**
 * PHẠM VI XUẤT — CỐ ĐỊNH TẦNG 1.
 *
 * Giao diện Modal đã bỏ hoàn toàn lựa chọn phạm vi nội dung báo cáo nên máy chủ
 * không đọc tham số `scope` từ client nữa; file báo cáo xuất ra luôn chỉ chứa
 * số liệu Tầng 1 (SME, Hộ kinh doanh, HTX, CĐS & OCOP).
 */
const EXPORT_SCOPE: ExportScope = "tier1";

/* ========================= 1. ĐỊNH NGHĨA DỮ LIỆU ========================= */

interface Tier1Field {
  key: string;
  label: string;
  altKey?: string;
}

const TIER1_FIELDS: Tier1Field[] = [
  { key: "sme_total", label: "Tổng số Doanh nghiệp SME" },
  { key: "sme_cds", label: "Doanh nghiệp SME CĐS", altKey: "sme_dx" },
  { key: "hkd_total", label: "Tổng số Hộ kinh doanh" },
  { key: "hkd_cds", label: "Hộ kinh doanh CĐS", altKey: "hkd_dx" },
  { key: "htx_total", label: "Tổng số Hợp tác xã" },
  { key: "htx_cds", label: "Hợp tác xã CĐS", altKey: "htx_dx" },
  { key: "ocop_3star", label: "Sản phẩm OCOP 3 sao" },
  { key: "ocop_4star", label: "Sản phẩm OCOP 4 sao" },
  { key: "ocop_5star", label: "Sản phẩm OCOP 5 sao" },
  { key: "sp_thuong", label: "Sản phẩm OCOP thường" },
  { key: "dich_vu", label: "Sản phẩm dịch vụ OCOP" },
];

interface Tier2Item {
  label: string;
  base: string;
  altBase?: string;
}

interface Tier2Group {
  group: string;
  label: string;
  items: Tier2Item[];
}

const TIER2_GROUPS: Tier2Group[] = [
  {
    group: "A",
    label: "A. Hạ tầng số & Sẵn sàng",
    items: [
      { label: "Doanh nghiệp CĐS", base: "l2_a_dn_cds" },
      { label: "Doanh nghiệp lên Cloud", base: "l2_a_cloud" },
      { label: "NetID", base: "l2_a_netid" },
    ],
  },
  {
    group: "B",
    label: "B. Hiện diện số & Thương mại",
    items: [
      { label: "Web / Thương mại điện tử", base: "l2_b_web", altBase: "l2_b_web_ecom" },
      { label: "Đơn hàng trực tuyến", base: "l2_b_don_hang" },
      { label: "Tăng trưởng (%)", base: "l2_b_tang_truong" },
    ],
  },
  {
    group: "C",
    label: "C. Vận hành số",
    items: [
      { label: "Hệ thống QLDN (ERP)", base: "l2_c_erp" },
      { label: "Tổng nhân sự", base: "l2_c_nhan_su" },
      { label: "Khóa đào tạo", base: "l2_c_dao_tao" },
    ],
  },
  {
    group: "D",
    label: "D. Thị trường & Tương tác",
    items: [
      { label: "Lượt xem trang", base: "l2_d_trang_xem" },
      { label: "Người xem", base: "l2_d_nguoi_xem" },
      { label: "Google SEO", base: "l2_d_seo" },
      { label: "Khách hàng", base: "l2_d_khach_hang" },
      { label: "Tổng doanh thu (TR VNĐ)", base: "l2_d_doanh_thu" },
    ],
  },
];

interface Tier2Row {
  group: string;
  groupLabel: string;
  label: string;
  month: number;
  year: number;
}

interface EItem {
  key: string;
  title: string;
  value: number;
}

interface UnitDataset {
  name: string;
  isProvince: boolean;
  tier1: Record<string, number>;
  tier2: Tier2Row[];
  eItems: EItem[];
}

/* ========================= 2. TIỆN ÍCH CHUNG ========================= */

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number): string {
  return Number(n || 0).toLocaleString("vi-VN");
}

/** Bỏ dấu tiếng Việt (chỉ cần cho PDF font cơ bản, không ảnh hưởng DOCX/XLSX). */
function stripViAccents(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7E]/g, "?");
}

function slugify(input: string): string {
  return (
    stripViAccents(input)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dashboard"
  );
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/* ========================= 3. TRUY VẤN DỮ LIỆU ========================= */

interface DashRowLike {
  id: string;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  level2?: Record<string, unknown> | null;
  unit?: { id?: string; name?: string; type?: string } | null;
}

async function fetchDashboardWithUnit(dashboardId: string): Promise<DashRowLike | null> {
  const { data, error } = await supabase
    .from("dashboards")
    .select("id, title, metadata, level2, unit:administrative_units(id, name, type)")
    .eq("id", dashboardId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as DashRowLike;
}

/**
 * Dashboard của các Xã/Phường trực thuộc Tỉnh.
 * HÀM NÀY CHỈ được gọi khi dashboard hiện tại đã xác định là cấp TỈNH.
 */
async function fetchCommuneDashboards(provinceUnitId: string): Promise<DashRowLike[]> {
  const { data: childUnits } = await supabase
    .from("administrative_units")
    .select("id, name")
    .eq("parent_id", provinceUnitId)
    .order("name")
    .limit(500);
  const unitIds = ((childUnits ?? []) as Array<{ id: string; name: string }>).map((u) => u.id);
  if (unitIds.length === 0) return [];

  const { data: dashes } = await supabase
    .from("dashboards")
    .select("id, title, metadata, level2, unit:administrative_units(id, name, type)")
    .in("unit_id", unitIds)
    .limit(1000);
  return (dashes ?? []) as unknown as DashRowLike[];
}

/**
 * Tầng 1: bản ghi KPI MỚI NHẤT của từng dashboard
 * (B1 = kpi_business_units: SME/HKD/HTX; B2 = kpi_products: OCOP/SP/DV).
 *
 * Truy vấn được CHIA NHỎ THEO LÔ (100 dashboard/lô) để quét ĐỦ và ĐẦY ĐỦ
 * toàn bộ số liệu của Tỉnh + tất cả Xã/Phường trực thuộc, tránh bị giới hạn
 * LIMIT khi số dòng KPI lớn (nhiều snapshot lịch sử mỗi dashboard).
 */
function chunkIds(ids: string[], size = 100): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

async function fetchTier1Map(dashboardIds: string[]): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  if (dashboardIds.length === 0) return map;

  const wanted = new Set<string>();
  for (const f of TIER1_FIELDS) {
    wanted.add(f.key);
    if (f.altKey) wanted.add(f.altKey);
  }

  const absorbInto = (target: Map<string, Record<string, number>>, rows: Array<Record<string, unknown>> | null) => {
    for (const row of rows ?? []) {
      const dashId = String(row.dashboard_id ?? "");
      // Bảng đã ORDER BY created_at DESC -> dòng đầu tiên gặp phải của mỗi
      // dashboard chính là bản ghi MỚI NHẤT (first-wins).
      if (!dashId || target.has(dashId)) continue;
      const vals: Record<string, number> = {};
      for (const key of wanted) {
        // ️ CHỈ đọc những cột THỰC SỰ TỒN TẠI trong bảng này.
        // `kpi_business_units` không có cột ocop_*/sp_thuong/dich_vu và
        // `kpi_products` không có cột sme_*/hkd_*/htx_*. Nếu gán 0 cho mọi key
        // "muốn có" thì khi gộp 2 bảng (bên dưới) các key của bảng này sẽ GHI ĐÈ
        // số liệu THẬT của bảng kia bằng 0 — đây chính là nguyên nhân số liệu
        // SME/HKD/HTX (Tầng 1) bị hiển thị 0 trên Dashboard và trong file báo cáo.
        if (!(key in row)) continue;
        vals[key] = toNum(row[key]);
      }
      target.set(dashId, vals);
    }
  };

  const mapB1 = new Map<string, Record<string, number>>();
  const mapB2 = new Map<string, Record<string, number>>();

  for (const chunk of chunkIds(dashboardIds, 100)) {
    const [b1Res, b2Res] = await Promise.all([
      supabase
        .from("kpi_business_units")
        .select("*")
        .in("dashboard_id", chunk)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("kpi_products")
        .select("*")
        .in("dashboard_id", chunk)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);
    absorbInto(mapB1, (b1Res.data ?? []) as Array<Record<string, unknown>>);
    absorbInto(mapB2, (b2Res.data ?? []) as Array<Record<string, unknown>>);
  }

  for (const id of dashboardIds) {
    map.set(id, { ...(mapB1.get(id) ?? {}), ...(mapB2.get(id) ?? {}) });
  }
  return map;
}

function buildTier2Rows(level2: Record<string, unknown>): Tier2Row[] {
  const rows: Tier2Row[] = [];
  for (const grp of TIER2_GROUPS) {
    for (const item of grp.items) {
      const yearRaw = level2[`${item.base}_year`] ?? level2[item.altBase ?? item.base] ?? level2[item.base];
      const monthRaw = level2[`${item.base}_month`];
      rows.push({
        group: grp.group,
        groupLabel: grp.label,
        label: item.label,
        month: toNum(monthRaw),
        year: toNum(yearRaw),
      });
    }
  }
  return rows;
}

/** Nhóm E: danh mục động từ metadata.level2_e_items (giống logic Level2View). */
function buildEItems(dash: DashRowLike, level2: Record<string, unknown>): EItem[] {
  const meta = (dash.metadata ?? {}) as Record<string, unknown> & {
    level2_e_items?: unknown;
    level2_metrics?: Record<string, unknown>;
  };
  const raw = meta.level2_e_items;
  const items: EItem[] = [];
  if (Array.isArray(raw)) {
    for (const it of raw) {
      if (!it || typeof it !== "object") continue;
      const obj = it as Record<string, unknown>;
      const key = String(obj.key ?? "").trim();
      if (!key) continue;
      const title = String(obj.title ?? key);
      const value = toNum(level2[key] ?? meta.level2_metrics?.[key] ?? obj.value);
      items.push({ key, title, value });
    }
  }
  return items;
}

/**
 * Ảnh xạ key trong metadata (metrics / level2_metrics / top-level) sang cột
 * KPI Tầng 1 — đồng bộ đúng logic hiển thị của DashboardDetail (B1/B2 QTY).
 */
const TIER1_META_KEYS: Record<string, string[]> = {
  b1_sme_total: ["sme_total"],
  b1_sme_dx: ["sme_dx", "sme_cds"],
  b1_hkd_total: ["hkd_total"],
  b1_hkd_dx: ["hkd_dx", "hkd_cds"],
  b1_htx_total: ["htx_total"],
  b1_htx_dx: ["htx_dx", "htx_cds"],
  b2_ocop_3: ["ocop_3star"],
  b2_ocop_4: ["ocop_4star"],
  b2_ocop_5: ["ocop_5star"],
  b2_sp_thuong: ["sp_thuong"],
  b2_dich_vu: ["dich_vu"],
};

/** Đọc số từ giá trị metadata (số, chuỗi, hoặc object { value }). */
function extractNumeric(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "object") {
    const maybe = (raw as { value?: unknown }).value;
    if (maybe !== undefined && maybe !== null) return extractNumeric(maybe);
  }
  return null;
}

/**
 * GHI ĐÈ số liệu Tầng 1 từ metadata (nguồn cào/sync mà UI đang hiển thị)
 * lên trên số liệu đọc từ bảng kpi_business_units / kpi_products,
 * để file xuất LUÔN KHỚP với những gì người dùng thấy trên Dashboard.
 */
function overlayTier1FromMeta(dash: DashRowLike, tier1: Record<string, number>): Record<string, number> {
  const meta = (dash.metadata ?? {}) as Record<string, unknown> & {
    metrics?: Record<string, unknown>;
    level2_metrics?: Record<string, unknown>;
  };
  for (const src of [meta.metrics, meta.level2_metrics, meta as Record<string, unknown>]) {
    if (!src || typeof src !== "object") continue;
    for (const [metaKey, fields] of Object.entries(TIER1_META_KEYS)) {
      const val = extractNumeric((src as Record<string, unknown>)[metaKey]);
      if (val !== null) {
        for (const f of fields) tier1[f] = val;
      }
    }
  }
  return tier1;
}

/** GHI ĐÈ số liệu Tầng 2 (keys l2_*) từ metadata lên bản ghi level2. */
function overlayLevel2FromMeta(dash: DashRowLike, level2: Record<string, unknown>): void {
  const meta = (dash.metadata ?? {}) as Record<string, unknown> & {
    metrics?: Record<string, unknown>;
    level2_metrics?: Record<string, unknown>;
  };
  for (const src of [meta.metrics, meta.level2_metrics]) {
    if (!src || typeof src !== "object") continue;
    for (const [metaKey, raw] of Object.entries(src)) {
      if (!metaKey.startsWith("l2_")) continue;
      const val = extractNumeric(raw);
      if (val === null) continue;
      level2[metaKey] = val; // ví dụ: l2_a_dn_cds_year
      level2[metaKey.replace(/^l2_/, "")] = val; // ví dụ: a_dn_cds_year
    }
  }
}

function buildUnitDataset(dash: DashRowLike, tier1Raw: Record<string, number>, isProvince: boolean): UnitDataset {
  const name = String(dash.unit?.name || dash.title || "Không xác định");
  const meta = (dash.metadata ?? {}) as Record<string, unknown> & { level2?: Record<string, unknown> };
  // dash.level2 (cột bảng) ưu tiên; metadata.level2 bổ sung các key còn thiếu
  const level2: Record<string, unknown> = {
    ...((meta.level2 ?? {}) as Record<string, unknown>),
    ...((dash.level2 ?? {}) as Record<string, unknown>),
  };
  const tier1 = overlayTier1FromMeta(dash, { ...tier1Raw });
  overlayLevel2FromMeta(dash, level2);
  return {
    name,
    isProvince,
    tier1,
    tier2: buildTier2Rows(level2),
    eItems: buildEItems(dash, level2),
  };
}

/* ========================= 4. NỘI DUNG BÁO CÁO ========================= */

interface ReportRow {
  cells: string[];
}

interface ReportSection {
  title: string;
  header: string[];
  rows: ReportRow[];
}

/**
 * Giá trị hiển thị của một chỉ tiêu Tầng 1: ưu tiên cột chính, nếu cột chính
 * đang bằng 0/trống thì lấy cột thay thế tương ứng (sme_cds ↔ sme_dx,
 * hkd_cds ↔ hkd_dx, htx_cds ↔ htx_dx) — tránh việc một cột 0 "che mất" số liệu
 * thật đang nằm ở cột còn lại. Chỉ đọc dữ liệu CỦA CHÍNH đơn vị đó nên không
 * ảnh hưởng đến cơ chế cô lập nghiêm ngặt ở cấp Xã/Phường.
 */
function tier1Value(unit: UnitDataset, f: Tier1Field): number {
  const primary = toNum(unit.tier1[f.key]);
  if (primary !== 0) return primary;
  return toNum(unit.tier1[f.altKey ?? ""]);
}

/**
 * Tổng một chỉ tiêu Tầng 1 trên toàn bộ đơn vị trong tập dữ liệu.
 * Dùng chung `tier1Value` (đã xử lý cặp cột *_cds ↔ *_dx) nên không bỏ sót số
 * liệu của bất kỳ xã/phường nào.
 */
function sumTier1Field(units: UnitDataset[], field: Tier1Field): number {
  return units.reduce((sum, unit) => sum + tier1Value(unit, field), 0);
}

/**
 * BÙ SỐ LIỆU TẦNG 1 CHO DASHBOARD CẤP TỈNH — khắc phục lỗi "Tỉnh hiển thị 0".
 *
 * Khi bảng dữ liệu riêng của Tỉnh (`kpi_business_units` / `kpi_products`, đã gộp
 * cả giá trị ghi đè từ metadata) CHƯA CÓ BẢN GHI hoặc BẰNG 0, hệ thống tự động
 * CỘNG DỒN (SUM) chỉ tiêu đó từ danh sách Xã/Phường trực thuộc để số liệu hiển
 * thị và file báo cáo xuất ra không bị rỗng.
 *
 * AN TOÀN:
 * - Chỉ thay thế khi giá trị của Tỉnh ĐANG BẰNG 0 → số liệu Tỉnh đã có (khác 0)
 *   luôn được giữ nguyên, không bao giờ bị ghi đè hay bị làm nhỏ đi.
 * - CHỈ áp dụng cho cấp TỈNH. Dashboard cấp XÃ/PHƯỜNG không đi qua hàm này nên
 *   vẫn giữ cô lập nghiêm ngặt (chỉ đúng số liệu của xã/phường đó).
 */
function applyProvinceTier1Fallback(province: UnitDataset, communes: UnitDataset[]): void {
  if (communes.length === 0) return;

  for (const field of TIER1_FIELDS) {
    if (tier1Value(province, field) !== 0) continue; // Tỉnh đã có số liệu riêng
    const communeSum = sumTier1Field(communes, field);
    if (communeSum === 0) continue; // Các xã cũng chưa có số liệu
    // Ghi đồng thời key chính và key thay thế (sme_cds/sme_dx, hkd_cds/hkd_dx...)
    province.tier1[field.key] = communeSum;
    if (field.altKey) province.tier1[field.altKey] = communeSum;
  }
}

function buildSectionsForUnit(unit: UnitDataset, scope: ExportScope): ReportSection[] {
  const sections: ReportSection[] = [];

  if (scope !== "tier2") {
    sections.push({
      title: "TẦNG 1: BỘ TIÊU CHÍ KINH TẾ SỐ UBND CẤP XÃ (SME, HKD, HTX, CĐS & OCOP)",
      header: ["Chỉ tiêu", "Giá trị"],
      rows: TIER1_FIELDS.map((f) => ({ cells: [f.label, fmt(tier1Value(unit, f))] })),
    });
  }

  if (scope !== "tier1") {
    sections.push({
      title: "TẦNG 2: BỘ TIÊU CHÍ HỆ SINH THÁI KINH TẾ SỐ (NHÓM A - E)",
      header: ["Nhóm", "Chỉ tiêu", "Trong tháng", "Trong năm"],
      rows: unit.tier2.map((r) => ({
        cells: [r.group, r.label, r.month ? fmt(r.month) : "-", r.year ? fmt(r.year) : "-"],
      })),
    });

    if (unit.eItems.length > 0) {
      sections.push({
        title: "TẦNG 2 - NHÓM E: CHỈ SỐ THEO DÕI HỆ SINH THÁI (ĐỘNG)",
        header: ["Mục theo dõi", "Giá trị"],
        rows: unit.eItems.map((e) => ({ cells: [e.title, fmt(e.value)] })),
      });
    }
  }

  return sections;
}

/* ========================= 5. TẠO FILE DOCX (OOXML + ZIP) ========================= */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** ZIP tối giản (phương thức STORE — không nén) đủ để Word mở file .docx. */
function createStoredZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime =
    ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | (Math.floor(now.getSeconds() / 2) & 31);
  const dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);
    local.push(lh, entry.data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += lh.length + size;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + 22);
  let pos = 0;
  for (const chunk of [...local, ...central, eocd]) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

/* ========================= 6. BỘ TẠO DOCX ========================= */

function docxRun(text: string, opts: { bold?: boolean; sizePt?: number } = {}): string {
  const sz = (opts.sizePt ?? 11) * 2; // half-points
  return `<w:r><w:rPr>${opts.bold ? "<w:b/>" : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function docxPara(
  text: string,
  opts: { bold?: boolean; sizePt?: number; spacingBefore?: number; spacingAfter?: number; align?: "center" } = {}
): string {
  const spacing = `<w:spacing w:before="${opts.spacingBefore ?? 0}" w:after="${opts.spacingAfter ?? 120}"/>`;
  const jc = opts.align === "center" ? `<w:jc w:val="center"/>` : "";
  return `<w:p><w:pPr>${spacing}${jc}</w:pPr>${docxRun(text, opts)}</w:p>`;
}

const DOCX_BORDERS = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"]
  .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>`)
  .join("")}</w:tblBorders>`;

function docxTable(header: string[], rows: ReportRow[]): string {
  const cell = (text: string, bold: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>${docxRun(
      text,
      { bold, sizePt: 10 }
    )}</w:p></w:tc>`;
  const trs = [
    `<w:tr>${header.map((h) => cell(h, true)).join("")}</w:tr>`,
    ...rows.map((r) => `<w:tr>${r.cells.map((c) => cell(c, false)).join("")}</w:tr>`),
  ].join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${DOCX_BORDERS}</w:tblPr>${trs}</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>`;
}

function buildDocxBytes(units: UnitDataset[], scope: ExportScope, generatedAt: string): Uint8Array {
  const parts: string[] = [];
  parts.push(
    docxPara("BÁO CÁO SỐ LIỆU DASHBOARD KINH TẾ SỐ", { bold: true, sizePt: 16, align: "center", spacingAfter: 60 })
  );
  parts.push(docxPara(generatedAt, { sizePt: 10, align: "center", spacingAfter: 240 }));

  for (const unit of units) {
    parts.push(
      docxPara(
        unit.isProvince ? `TỔNG HỢP CẤP TỈNH: ${unit.name.toUpperCase()}` : `ĐƠN VỊ: ${unit.name.toUpperCase()}`,
        { bold: true, sizePt: 13, spacingBefore: 240 }
      )
    );
    for (const section of buildSectionsForUnit(unit, scope)) {
      parts.push(docxPara(section.title, { bold: true, sizePt: 11, spacingBefore: 160, spacingAfter: 80 }));
      parts.push(docxTable(section.header, section.rows));
    }
  }

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join(
      ""
    )}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const enc = new TextEncoder();
  return createStoredZip([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(documentXml) },
  ]);
}

/* ========================= 7. BỘ TẠO PDF ========================= */

interface PdfLine {
  text: string;
  sizePt?: number;
  bold?: boolean;
  indentPt?: number;
  gapBeforePt?: number;
}

/**
 * [FALLBACK] PDF font cơ bản (Helvetica) — CHỈ dùng khi không tải được font
 * Unicode nhúng. Văn bản tiếng Việt được bỏ dấu để đảm bảo hiển thị được.
 */
function buildPdfBytesFallback(units: UnitDataset[], scope: ExportScope, generatedAt: string): Uint8Array {
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN_X = 56;
  const MARGIN_TOP = 64;
  const MARGIN_BOTTOM = 56;

  const lines: PdfLine[] = [
    { text: "BAO CAO SO LIEU DASHBOARD KINH TE SO", sizePt: 16, bold: true },
    { text: stripViAccents(generatedAt), sizePt: 10 },
  ];
  for (const unit of units) {
    lines.push({
      text: `${unit.isProvince ? "TONG HOP CAP TINH" : "DON VI"}: ${stripViAccents(unit.name).toUpperCase()}`,
      sizePt: 13,
      bold: true,
      gapBeforePt: 18,
    });
    for (const section of buildSectionsForUnit(unit, scope)) {
      lines.push({ text: stripViAccents(section.title), sizePt: 11, bold: true, gapBeforePt: 12 });
      const isFourCol = section.header.length === 4;
      for (const row of section.rows) {
        const text = isFourCol
          ? `  [${stripViAccents(row.cells[0])}] ${stripViAccents(row.cells[1])}: Thang ${row.cells[2]} | Nam ${row.cells[3]}`
          : `  - ${stripViAccents(row.cells[0])}: ${row.cells[1]}`;
        lines.push({ text, sizePt: 10, indentPt: 6 });
      }
    }
  }

  const contentStreams: string[] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN_TOP;

  for (const line of lines) {
    const size = line.sizePt ?? 10;
    const indent = line.indentPt ?? 0;
    const maxChars = Math.max(20, Math.floor((PAGE_W - MARGIN_X * 2 - indent) / (size * 0.5)));
    let remaining = line.text;
    let first = true;
    do {
      const chunk = remaining.slice(0, maxChars);
      remaining = remaining.slice(maxChars);
      const gap = first ? line.gapBeforePt ?? 0 : 0;
      const lh = size * 1.5 + gap;
      if (y - lh < MARGIN_BOTTOM) {
        contentStreams.push(ops.join("\n"));
        ops = [];
        y = PAGE_H - MARGIN_TOP;
      }
      y -= lh;
      const font = line.bold ? "/F2" : "/F1";
      ops.push(`BT ${font} ${size} Tf ${MARGIN_X + indent} ${y.toFixed(1)} Td (${pdfEscape(chunk)}) Tj ET`);
      first = false;
    } while (remaining.length > 0);
  }
  contentStreams.push(ops.join("\n"));

  const objects: string[] = [];
  const kids = contentStreams.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Count ${contentStreams.length} /Kids [${kids}] >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  contentStreams.forEach((stream, i) => {
    const pageNum = 5 + i * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNum + 1} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const chunks: string[] = ["%PDF-1.4\n"];
  let pos = chunks[0].length;
  const offsets: number[] = [];
  objects.forEach((obj, idx) => {
    offsets.push(pos);
    const s = `${idx + 1} 0 obj\n${obj}\nendobj\n`;
    chunks.push(s);
    pos += s.length;
  });
  const xrefPos = pos;
  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  chunks.push(xref);

  return new TextEncoder().encode(chunks.join(""));
}

/* ---------- Font Unicode nhúng (Roboto) cho PDF tiếng Việt có dấu ---------- */

interface EmbeddedFont {
  name: string;
  bytes: Uint8Array;
  /** unicode -> glyph id */
  cmap: Map<number, number>;
  widthOfGid: (gid: number) => number;
  ascent: number;
  descent: number;
  bbox: [number, number, number, number];
}

/** Đọc bảng điều khiển của TTF: head/hhea/hmtx/cmap (format 4 & 12). */
function parseTtf(raw: Uint8Array, name: string): EmbeddedFont | null {
  try {
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const numTables = dv.getUint16(4);
    const tables: Record<string, { off: number; len: number }> = {};
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = String.fromCharCode(raw[o], raw[o + 1], raw[o + 2], raw[o + 3]);
      tables[tag] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
    }
    const head = tables["head"];
    const hhea = tables["hhea"];
    const hmtx = tables["hmtx"];
    const cmap = tables["cmap"];
    if (!head || !hhea || !hmtx || !cmap) return null;

    const upem = dv.getUint16(head.off + 18) || 1000;
    const scale = 1000 / upem;
    const bbox: [number, number, number, number] = [
      Math.round(dv.getInt16(head.off + 36) * scale),
      Math.round(dv.getInt16(head.off + 38) * scale),
      Math.round(dv.getInt16(head.off + 40) * scale),
      Math.round(dv.getInt16(head.off + 42) * scale),
    ];
    const ascent = Math.round(dv.getInt16(hhea.off + 4) * scale);
    const descent = Math.round(dv.getInt16(hhea.off + 6) * scale);
    const numH = dv.getUint16(hhea.off + 34);
    const widthOfGid = (gid: number): number =>
      Math.round(dv.getUint16(hmtx.off + Math.min(gid, numH - 1) * 4) * scale);

    const map = new Map<number, number>();
    const nSub = dv.getUint16(cmap.off + 2);
    let bestScore = -1;
    let bestOff = 0;
    for (let i = 0; i < nSub; i++) {
      const e = cmap.off + 4 + i * 8;
      const pid = dv.getUint16(e);
      const eid = dv.getUint16(e + 2);
      const soff = cmap.off + dv.getUint32(e + 4);
      const score = pid === 3 && eid === 10 ? 4 : pid === 3 && eid === 1 ? 3 : pid === 0 ? 2 : 1;
      if (score > bestScore) {
        bestScore = score;
        bestOff = soff;
      }
    }
    if (bestOff) {
      const fmt = dv.getUint16(bestOff);
      if (fmt === 4) {
        const segX2 = dv.getUint16(bestOff + 6);
        const seg = segX2 / 2;
        const endBase = bestOff + 14;
        const startBase = endBase + segX2 + 2;
        const deltaBase = startBase + segX2;
        const rangeBase = deltaBase + segX2;
        for (let i = 0; i < seg; i++) {
          const end = dv.getUint16(endBase + i * 2);
          const start = dv.getUint16(startBase + i * 2);
          const delta = dv.getInt16(deltaBase + i * 2);
          const rangeOff = dv.getUint16(rangeBase + i * 2);
          for (let c = start; c <= end && c !== 0xffff; c++) {
            let gid: number;
            if (rangeOff === 0) {
              gid = (c + delta) & 0xffff;
            } else {
              const gi = rangeBase + i * 2 + rangeOff + (c - start) * 2;
              gid = dv.getUint16(gi);
              if (gid !== 0) gid = (gid + delta) & 0xffff;
            }
            if (gid !== 0) map.set(c, gid);
          }
        }
      } else if (fmt === 12) {
        const nGroups = dv.getUint32(bestOff + 12);
        for (let g = 0; g < nGroups; g++) {
          const go = bestOff + 16 + g * 12;
          const start = dv.getUint32(go);
          const end = dv.getUint32(go + 4);
          const sg = dv.getUint32(go + 8);
          for (let c = start; c <= end; c++) {
            const gid = sg + (c - start);
            if (gid) map.set(c, gid);
          }
        }
      }
    }
    if (map.size === 0) return null;
    return { name, bytes: raw, cmap: map, widthOfGid, ascent, descent, bbox };
  } catch {
    return null;
  }
}

let PDF_FONT_REGULAR: EmbeddedFont | null | undefined;
let PDF_FONT_BOLD: EmbeddedFont | null | undefined;

function loadPdfFonts(): { regular: EmbeddedFont | null; bold: EmbeddedFont | null } {
  if (PDF_FONT_REGULAR === undefined) {
    try {
      PDF_FONT_REGULAR = parseTtf(new Uint8Array(Buffer.from(PDF_FONT_REGULAR_B64, "base64")), "Roboto-Regular");
    } catch {
      PDF_FONT_REGULAR = null;
    }
  }
  if (PDF_FONT_BOLD === undefined) {
    try {
      PDF_FONT_BOLD = parseTtf(new Uint8Array(Buffer.from(PDF_FONT_BOLD_B64, "base64")), "Roboto-Bold");
    } catch {
      PDF_FONT_BOLD = null;
    }
  }
  return { regular: PDF_FONT_REGULAR, bold: PDF_FONT_BOLD };
}

function hex2(n: number): string {
  return n.toString(16).padStart(4, "0");
}

/** Ngắt dòng theo chiều rộng glyph thực tế của font (giữ nguyên dấu tiếng Việt). */
function wrapTextWithFont(text: string, font: EmbeddedFont, size: number, maxWidth: number): string[] {
  const charW = (ch: string): number => {
    const gid = font.cmap.get(ch.codePointAt(0)!) ?? 0;
    return (font.widthOfGid(gid) * size) / 1000;
  };
  const out: string[] = [];
  let current = "";
  let currentW = 0;
  let lastSpaceIdx = -1;
  for (const ch of text) {
    const w = charW(ch);
    if (currentW + w > maxWidth && current.length > 0) {
      let cutAt = current.length;
      if (lastSpaceIdx > 0) cutAt = lastSpaceIdx;
      out.push(current.slice(0, cutAt).trimEnd());
      current = current.slice(cutAt).trimStart();
      currentW = 0;
      for (const c2 of current) currentW += charW(c2);
      lastSpaceIdx = -1;
    }
    current += ch;
    currentW += w;
    if (ch === " ") lastSpaceIdx = current.length;
  }
  if (current.trim()) out.push(current.trimEnd());
  return out;
}

/** Sinh bảng ToUnicode để copy/tra cứu text từ PDF đúng nội dung. */
function buildToUnicodeCMap(entries: Array<[number, number]>): string {
  const blocks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    const rows = chunk.map(([gid, uni]) => `<${hex2(gid)}> <${hex2(uni)}>`).join("\n");
    blocks.push(`${chunk.length} beginbfchar\n${rows}\nendbfchar`);
  }
  return (
    `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n` +
    `/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n` +
    `/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n` +
    `1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n` +
    blocks.join("\n") +
    `\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\nend`
  );
}

/**
 * PDF với FONT UNICODE NHÚNG (Roboto) — hiển thị ĐẦY ĐỦ dấu tiếng Việt.
 * Kiểu font: Type0/CIDFontType2, mã hoá Identity-H (CID = Glyph ID),
 * kèm bảng ToUnicode để copy text chính xác.
 */
function buildPdfBytes(units: UnitDataset[], scope: ExportScope, generatedAt: string): Uint8Array {
  const fonts = loadPdfFonts();
  if (!fonts.regular) {
    // Fallback an toàn: PDF font cơ bản (bỏ dấu tiếng Việt) nếu thiếu font Unicode
    return buildPdfBytesFallback(units, scope, generatedAt);
  }
  const regular = fonts.regular;
  const bold = fonts.bold ?? fonts.regular;

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN_X = 56;
  const MARGIN_TOP = 64;
  const MARGIN_BOTTOM = 56;

  const lines: PdfLine[] = [
    { text: "BÁO CÁO SỐ LIỆU DASHBOARD KINH TẾ SỐ", sizePt: 16, bold: true },
    { text: generatedAt, sizePt: 10 },
  ];
  for (const unit of units) {
    lines.push({
      text: `${unit.isProvince ? "TỔNG HỢP CẤP TỈNH" : "ĐƠN VỊ"}: ${unit.name.toUpperCase()}`,
      sizePt: 13,
      bold: true,
      gapBeforePt: 18,
    });
    for (const section of buildSectionsForUnit(unit, scope)) {
      lines.push({ text: section.title, sizePt: 11, bold: true, gapBeforePt: 12 });
      const isFourCol = section.header.length === 4;
      for (const row of section.rows) {
        const text = isFourCol
          ? `  [${row.cells[0]}] ${row.cells[1]}: Tháng ${row.cells[2]} | Năm ${row.cells[3]}`
          : `  - ${row.cells[0]}: ${row.cells[1]}`;
        lines.push({ text, sizePt: 10, indentPt: 6 });
      }
    }
  }

  // Dựng nội dung các trang (hex-encoded Glyph IDs) + ghi nhận glyph sử dụng
  const contentStreams: string[] = [];
  const gidUsageReg = new Map<number, number>();
  const gidUsageBold = new Map<number, number>();
  let ops: string[] = [];
  let y = PAGE_H - MARGIN_TOP;

  for (const line of lines) {
    const size = line.sizePt ?? 10;
    const indent = line.indentPt ?? 0;
    const font = line.bold ? bold : regular;
    const usage = line.bold ? gidUsageBold : gidUsageReg;
    const maxWidth = Math.max(40, PAGE_W - MARGIN_X * 2 - indent);
    const pieces = wrapTextWithFont(line.text, font, size, maxWidth);
    pieces.forEach((piece, pi) => {
      const gap = pi === 0 ? line.gapBeforePt ?? 0 : 0;
      const lh = size * 1.5 + gap;
      if (y - lh < MARGIN_BOTTOM) {
        contentStreams.push(ops.join("\n"));
        ops = [];
        y = PAGE_H - MARGIN_TOP;
      }
      y -= lh;
      let hex = "";
      for (const ch of piece) {
        const cp = ch.codePointAt(0)!;
        const gid = font.cmap.get(cp) ?? 0;
        if (!usage.has(gid)) usage.set(gid, cp);
        hex += hex2(gid);
      }
      ops.push(`BT ${line.bold ? "/F2" : "/F1"} ${size} Tf ${MARGIN_X + indent} ${y.toFixed(1)} Td <${hex}> Tj ET`);
    });
  }
  contentStreams.push(ops.join("\n"));

  const pageCount = contentStreams.length;
  const base = 5 + pageCount * 2;
  const widths = (font: EmbeddedFont, usage: Map<number, number>): string =>
    [...usage.keys()]
      .sort((a, b) => a - b)
      .map((gid) => `${gid} [${font.widthOfGid(gid)}]`)
      .join(" ");

  type PdfObj = string | { head: string; bin: Uint8Array; tail: string };
  const objects: PdfObj[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = contentStreams.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`);
  objects.push(
    `<< /Type /Font /Subtype /Type0 /BaseFont /${regular.name} /Encoding /Identity-H /DescendantFonts [${base + 1} 0 R] /ToUnicode ${base + 3} 0 R >>`
  );
  objects.push(
    `<< /Type /Font /Subtype /Type0 /BaseFont /${bold.name} /Encoding /Identity-H /DescendantFonts [${base + 5} 0 R] /ToUnicode ${base + 7} 0 R >>`
  );
  contentStreams.forEach((stream, i) => {
    const pageNum = 5 + i * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNum + 1} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const descriptor = (font: EmbeddedFont, fontFileRef: number): string =>
    `<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 /FontBBox [${font.bbox.join(" ")}] ` +
    `/ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${Math.round(font.ascent * 0.7)} ` +
    `/StemV 80 /FontFile2 ${fontFileRef} 0 R >>`;
  const cidFont = (font: EmbeddedFont, descRef: number, w: string): string =>
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${font.name} ` +
    `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
    `/FontDescriptor ${descRef} 0 R /DW 500 /W [${w}] /CIDToGIDMap /Identity >>`;
  const fontFileObj = (font: EmbeddedFont): PdfObj => ({
    head: `<< /Length ${font.bytes.length} /Length1 ${font.bytes.length} >>\nstream\n`,
    bin: font.bytes,
    tail: "\nendstream",
  });
  const toUnicodeStr = (usage: Map<number, number>): string =>
    buildToUnicodeCMap([...usage.entries()].sort((a, b) => a[0] - b[0]));

  // Regular: base+0 descriptor, base+1 cidfont, base+2 fontfile, base+3 tounicode
  objects.push(descriptor(regular, base + 2));
  objects.push(cidFont(regular, base + 0, widths(regular, gidUsageReg)));
  objects.push(fontFileObj(regular));
  objects.push(toUnicodeStr(gidUsageReg));
  // Bold: base+4 descriptor, base+5 cidfont, base+6 fontfile, base+7 tounicode
  objects.push(descriptor(bold, base + 6));
  objects.push(cidFont(bold, base + 4, widths(bold, gidUsageBold)));
  objects.push(fontFileObj(bold));
  objects.push(toUnicodeStr(gidUsageBold));

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const pdfHeader = enc.encode("%PDF-1.4\n");
  parts.push(pdfHeader);
  let pos = pdfHeader.length;
  const offsets: number[] = [];
  objects.forEach((obj, idx) => {
    offsets.push(pos);
    const num = `${idx + 1} 0 obj\n`;
    const tail = "\nendobj\n";
    if (typeof obj === "string") {
      const body = enc.encode(num + obj + tail);
      parts.push(body);
      pos += body.length;
    } else {
      const h = enc.encode(num + obj.head);
      const t = enc.encode(obj.tail + tail);
      parts.push(h, obj.bin, t);
      pos += h.length + obj.bin.length + t.length;
    }
  });
  const xrefPos = pos;
  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  parts.push(enc.encode(xref));

  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let writePos = 0;
  for (const p of parts) {
    out.set(p, writePos);
    writePos += p.length;
  }
  return out;
}

/* ========================= 8. BỘ TẠO XLSX (LAYOUT CHUẨN) ========================= */

/** Tổng các chỉ tiêu "Trong năm" của một Nhóm (Nhóm B không cộng tỷ lệ % tăng trưởng). */
function tier2GroupSum(unit: UnitDataset, group: string): number {
  return unit.tier2
    .filter((r) => r.group === group && !(group === "B" && r.label.includes("Tăng trưởng")))
    .reduce((s, r) => s + r.year, 0);
}

/** Tổng giá trị Nhóm E (dữ liệu bóc tách động từ web nguồn). */
function tier2GroupSumE(unit: UnitDataset): number {
  return unit.eItems.reduce((s, e) => s + e.value, 0);
}

function buildXlsxBytes(units: UnitDataset[], scope: ExportScope): Uint8Array {
  const wb = XLSX.utils.book_new();
  const f1 = (key: string) => TIER1_FIELDS.find((x) => x.key === key)!;

  /* PHẦN 1 (TẦNG 1): Bảng tổng quan Doanh nghiệp - HKD - HTX - OCOP */
  if (scope !== "tier2") {
    const header = [
      "STT",
      "Tên Đơn vị",
      "Tổng SME",
      "SME CĐS",
      "Tổng HKD",
      "HKD CĐS",
      "Tổng HTX",
      "HTX CĐS",
      "OCOP 3 sao",
      "OCOP 4 sao",
      "OCOP 5 sao",
    ];
    const rows: (string | number)[][] = units.map((u, i) => [
      i + 1,
      u.name,
      tier1Value(u, f1("sme_total")),
      tier1Value(u, f1("sme_cds")),
      tier1Value(u, f1("hkd_total")),
      tier1Value(u, f1("hkd_cds")),
      tier1Value(u, f1("htx_total")),
      tier1Value(u, f1("htx_cds")),
      tier1Value(u, f1("ocop_3star")),
      tier1Value(u, f1("ocop_4star")),
      tier1Value(u, f1("ocop_5star")),
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws1["!cols"] = [
      { wch: 6 }, { wch: 32 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 },
      { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Tang 1");
  }

  /* PHẦN 2 (TẦNG 2): Bảng tiêu chí hệ sinh thái A - E */
  if (scope !== "tier1") {
    const header = [
      "STT",
      "Tên Đơn vị",
      "Nhóm A (Hạ tầng)",
      "Nhóm B (TMĐT)",
      "Nhóm C (Vận hành)",
      "Nhóm D (Thị trường)",
      "Nhóm E (Bóc tách)",
    ];
    const rows: (string | number)[][] = units.map((u, i) => [
      i + 1,
      u.name,
      tier2GroupSum(u, "A"),
      tier2GroupSum(u, "B"),
      tier2GroupSum(u, "C"),
      tier2GroupSum(u, "D"),
      tier2GroupSumE(u),
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws2["!cols"] = [{ wch: 6 }, { wch: 32 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 17 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Tang 2");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as unknown as Uint8Array;
}

/* ========================= 9. ROUTE HANDLER ========================= */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const dashboardId = String(body?.dashboardId ?? "").trim();
    // Phạm vi nội dung báo cáo đã bỏ khỏi giao diện → luôn là Tầng 1 (EXPORT_SCOPE).
    const format: ExportFormat = ALLOWED_FORMATS.includes(body?.format) ? body.format : "xlsx";

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu ID Dashboard" }, { status: 400 });
    }

    const dash = await fetchDashboardWithUnit(dashboardId);
    if (!dash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy Dashboard" }, { status: 404 });
    }

    const unit = dash.unit ?? null;
    const isProvince = unit?.type === "PROVINCE";

    // Tập dashboard thuộc phạm vi xuất:
    // - Cấp TỈNH: dashboard Tỉnh + TOÀN BỘ dashboard Xã/Phường trực thuộc.
    // - Cấp XÃ/PHƯỜNG: CHÍNH dashboard này — cô lập nghiêm ngặt, không truy vấn gì khác.
    const scopeDashboards: DashRowLike[] = [dash];
    if (isProvince && unit?.id) {
      scopeDashboards.push(...(await fetchCommuneDashboards(unit.id)));
    }

    const tier1Map = await fetchTier1Map(scopeDashboards.map((d) => d.id));
    const datasets = scopeDashboards.map((d, idx) =>
      buildUnitDataset(d, tier1Map.get(d.id) ?? {}, isProvince && idx === 0)
    );

    // Cấp TỈNH: nếu chỉ tiêu Tầng 1 của riêng Tỉnh chưa có bản ghi / bằng 0 thì
    // cộng dồn (SUM) từ danh sách Xã/Phường trực thuộc (dataset[1..n]).
    // Cấp XÃ/PHƯỜNG không đi qua nhánh này → giữ cô lập nghiêm ngặt.
    if (isProvince) {
      const [provinceDataset, ...communeDatasets] = datasets;
      if (provinceDataset) applyProvinceTier1Fallback(provinceDataset, communeDatasets);
    }

    const generatedAt = `Xuất lúc ${new Date().toLocaleString("vi-VN")}`;
    let bytes: Uint8Array;
    let mimeType: string;
    switch (format) {
      case "docx":
        bytes = buildDocxBytes(datasets, EXPORT_SCOPE, generatedAt);
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;
      case "pdf":
        bytes = buildPdfBytes(datasets, EXPORT_SCOPE, generatedAt);
        mimeType = "application/pdf";
        break;
      default:
        bytes = buildXlsxBytes(datasets, EXPORT_SCOPE);
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `bao-cao-${slugify(unit?.name || dash.title || "dashboard")}-${dateStr}.${format}`;

    return NextResponse.json({
      success: true,
      fileName,
      mimeType,
      fileBase64: Buffer.from(bytes).toString("base64"),
    });
  } catch (err) {
    console.error("Lỗi xuất báo cáo:", err);
    return NextResponse.json(
      { success: false, error: "Không thể tạo file báo cáo. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}

