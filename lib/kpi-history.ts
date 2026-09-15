/**
 * KHO LỊCH SỬ KPI (`kpi_history`) — phần DÙNG CHUNG (client + server), thuần tuý.
 *
 * Tách riêng khỏi `kpi_business_units` / `kpi_products` (bảng "trạng thái hiện tại")
 * để không phải sửa cấu trúc/khóa chính của các bảng KPI hiện có.
 *
 * Ghi chú an toàn:
 * - File này KHÔNG import supabase, không ghi dữ liệu ⇒ có thể dùng ở client.
 * - Phần GHI lịch sử nằm ở `lib/kpi-history-server.ts` (service role, chạy độc lập).
 */

export const KPI_HISTORY_TABLE = "kpi_history";
export const KPI_HISTORY_EVENTS_TABLE = "kpi_history_events";

/** Các cột số liệu của kho lịch sử (giữ đúng tên cột bảng KPI hiện tại). */
export const KPI_HISTORY_VALUE_FIELDS = [
  "sme_total",
  "hkd_total",
  "htx_total",
  "sme_cds",
  "hkd_cds",
  "htx_cds",
  "sme_dx",
  "hkd_dx",
  "htx_dx",
  "ocop_3star",
  "ocop_4star",
  "ocop_5star",
  "sp_thuong",
  "normal_product",
  "dich_vu",
  "services_count",
] as const;

export const KPI_HISTORY_SELECT = [
  "id",
  "dashboard_id",
  "period_month",
  "period_quarter",
  "period_year",
  "source",
  "captured_at",
  "first_captured_at",
  "capture_count",
  ...KPI_HISTORY_VALUE_FIELDS,
].join(",");

export type KpiHistoryValueField = (typeof KPI_HISTORY_VALUE_FIELDS)[number];

/** Một dòng của bảng `kpi_history`. */
export interface KpiHistoryRow {
  dashboard_id: string;
  period_month: string;
  period_quarter?: string | null;
  period_year?: string | null;
  source?: string | null;
  captured_at?: string | null;
  [field: string]: unknown;
}

export interface KpiHistoryPeriodParts {
  month: string;
  quarter: string;
  year: string;
}

function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** "2026-09" -> { month, quarter, year } (null nếu sai định dạng). */
export function periodPartsOf(monthKey: string): KpiHistoryPeriodParts | null {
  if (typeof monthKey !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return null;
  const [year, month] = monthKey.split("-");
  return {
    month: monthKey,
    quarter: `${year}-Q${Math.ceil(Number(month) / 3)}`,
    year,
  };
}

/** Suy ra khoá tháng "YYYY-MM" từ chuỗi thời gian (ISO) / Date. */
export function monthKeyFromTimestamp(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  const match = /^(\d{4})-(\d{2})/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}` : null;
}

/**
 * Nhận biết lỗi "bảng kpi_history chưa tồn tại" (chưa chạy migration 0006).
 * Khi đó tính năng Bộ lọc tự động lùi về mốc lưu trên trình duyệt,
 * KHÔNG báo lỗi cho người dùng.
 */
export function isMissingKpiHistoryError(error: unknown): boolean {
  if (!error) return false;
  const raw =
    typeof error === "string"
      ? error
      : `${(error as { message?: unknown }).message ?? ""} ${
          (error as { code?: unknown }).code ?? ""
        } ${(error as { details?: unknown }).details ?? ""}`;

  const text = raw.toLowerCase();
  return (
    text.includes("kpi_history") &&
    (text.includes("does not exist") ||
      text.includes("could not find the table") ||
      text.includes("schema cache") ||
      text.includes("42p01") ||
      text.includes("pgrst205"))
  );
}
/** Chuẩn hoá một dòng lịch sử về đủ 16 cột số (thiếu -> 0). */
export function historyRowRawValues(row: KpiHistoryRow): Record<string, number> {
  const values: Record<string, number> = {};
  for (const field of KPI_HISTORY_VALUE_FIELDS) {
    values[field] = toNumber(row[field]) ?? 0;
  }
  return values;
}

/** Giá trị lớn nhất trong nhóm cột trùng nghĩa (cds/dx, sp_thuong/normal_product…). */
function maxOf(values: Record<string, number>, fields: string[]): number {
  return fields.reduce((best, field) => Math.max(best, values[field] ?? 0), 0);
}

/**
 * Quy đổi 16 cột thô của kho lịch sử sang bộ chỉ số dùng cho tính năng so sánh
 * (khớp đúng cách đọc dữ liệu "kỳ hiện tại" từ bảng KPI).
 */
export function historyRowToValues(row: KpiHistoryRow): Record<string, number> {
  const raw = historyRowRawValues(row);
  const ocop3 = raw.ocop_3star;
  const ocop4 = raw.ocop_4star;
  const ocop5 = raw.ocop_5star;
  return {
    sme_total: raw.sme_total,
    hkd_total: raw.hkd_total,
    htx_total: raw.htx_total,
    sme_cds: maxOf(raw, ["sme_cds", "sme_dx"]),
    hkd_cds: maxOf(raw, ["hkd_cds", "hkd_dx"]),
    htx_cds: maxOf(raw, ["htx_cds", "htx_dx"]),
    ocop_3star: ocop3,
    ocop_4star: ocop4,
    ocop_5star: ocop5,
    ocop_total: ocop3 + ocop4 + ocop5,
    sp_thuong: maxOf(raw, ["sp_thuong", "normal_product"]),
    dich_vu: maxOf(raw, ["dich_vu", "services_count"]),
  };
}

/** Cộng dồn nhiều dòng lịch sử (VD: toàn tỉnh = tổng các xã/phường). */
export function sumHistoryValues(rows: KpiHistoryRow[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const row of rows) {
    const values = historyRowToValues(row);
    for (const [key, value] of Object.entries(values)) {
      total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

/** Các dòng lịch sử thuộc một kỳ tháng. */
export function historyRowsForMonth(rows: KpiHistoryRow[], month: string): KpiHistoryRow[] {
  return rows.filter((row) => row.period_month === month);
}

/**
 * Chọn kỳ tháng có dữ liệu lịch sử MỚI NHẤT trong một khoảng kỳ
 * (chế độ quý/năm: lấy tháng gần nhất đã có mốc trong quý/năm đó).
 */
export function pickHistoryMonth(rows: KpiHistoryRow[], months: string[]): string | null {
  for (let index = months.length - 1; index >= 0; index -= 1) {
    if (historyRowsForMonth(rows, months[index]).length > 0) return months[index];
  }
  return null;
}

/**
 * Giá trị lịch sử của một phạm vi tại một kỳ:
 * ưu tiên dòng của chính Dashboard Tỉnh (số liệu đã tổng hợp), nếu chưa có thì
 * cộng dồn các dashboard xã/phường trong phạm vi (giống cách đọc "kỳ hiện tại").
 */
export function scopeHistoryValues(
  rows: KpiHistoryRow[],
  month: string,
  options: { preferDashboardId?: string | null; scopeDashboardIds?: string[] } = {}
): Record<string, number> | null {
  const monthRows = historyRowsForMonth(rows, month);
  if (monthRows.length === 0) return null;

  const preferred = options.preferDashboardId
    ? monthRows.find((row) => row.dashboard_id === options.preferDashboardId)
    : undefined;
  if (preferred) return historyRowToValues(preferred);

  const scopeIds = options.scopeDashboardIds;
  const scoped =
    scopeIds && scopeIds.length > 0
      ? monthRows.filter((row) => scopeIds.includes(row.dashboard_id))
      : monthRows;

  return scoped.length > 0 ? sumHistoryValues(scoped) : null;
}