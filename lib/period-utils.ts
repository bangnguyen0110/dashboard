/**
 * Tiện ích mốc thời gian (tháng / quý / năm) cho tính năng "Bộ lọc và so sánh thông tin".
 * Thuần frontend — KHÔNG đọc/ghi cơ sở dữ liệu, không phụ thuộc thư viện ngoài.
 */

export type PeriodKind = "month" | "quarter" | "year";

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const QUARTER_KEY_PATTERN = /^(\d{4})-Q([1-4])$/;
const YEAR_KEY_PATTERN = /^(\d{4})$/;

/** Kiểm tra khoá tháng đúng định dạng "YYYY-MM". */
export function isValidMonthKey(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

/** Chuyển Date / chuỗi ISO (VD: metadata.last_sync_at) thành khoá tháng "YYYY-MM". */
export function monthKeyOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

/** Khoá tháng của thời điểm hiện tại. */
export function currentMonthKey(): string {
  return monthKeyOf(new Date()) as string;
}

/** Cộng/trừ số tháng trên khoá "YYYY-MM" (delta âm để lùi kỳ). */
export function addMonths(monthKey: string, delta: number): string {
  if (!isValidMonthKey(monthKey)) return monthKey;
  const [yearStr, monthStr] = monthKey.split("-");
  const total = Number(yearStr) * 12 + (Number(monthStr) - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Nhãn tháng dạng "tháng 9/2026". */
export function monthLabel(monthKey: string): string {
  if (!isValidMonthKey(monthKey)) return monthKey;
  const [year, month] = monthKey.split("-");
  return `tháng ${Number(month)}/${year}`;
}

/** "2026-09" + quarter -> "2026-Q3"; + year -> "2026"; + month -> "2026-09". */
export function periodKeyOf(kind: PeriodKind, monthKey: string): string {
  if (!isValidMonthKey(monthKey)) return monthKey;
  const [year, month] = monthKey.split("-");
  if (kind === "year") return year;
  if (kind === "quarter") return `${year}-Q${Math.ceil(Number(month) / 3)}`;
  return monthKey;
}

/** Danh sách khoá tháng nằm trong một kỳ (quý: 3 tháng, năm: 12 tháng). */
export function periodMonths(kind: PeriodKind, periodKey: string): string[] {
  if (kind === "month") return isValidMonthKey(periodKey) ? [periodKey] : [];

  if (kind === "quarter") {
    const match = QUARTER_KEY_PATTERN.exec(periodKey);
    if (!match) return [];
    const year = Number(match[1]);
    const startMonth = (Number(match[2]) - 1) * 3 + 1;
    return [0, 1, 2].map(
      (offset) => `${year}-${String(startMonth + offset).padStart(2, "0")}`
    );
  }

  const match = YEAR_KEY_PATTERN.exec(periodKey);
  if (!match) return [];
  const year = Number(match[1]);
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

/** Nhãn kỳ dạng "Tháng 9/2026" | "Quý 3/2026" | "Năm 2026". */
export function periodLabel(kind: PeriodKind, periodKey: string): string {
  if (kind === "quarter") {
    const match = QUARTER_KEY_PATTERN.exec(periodKey);
    if (match) return `Quý ${Number(match[2])}/${match[1]}`;
    return periodKey;
  }
  if (kind === "year") {
    return YEAR_KEY_PATTERN.test(periodKey) ? `Năm ${periodKey}` : periodKey;
  }
  if (!isValidMonthKey(periodKey)) return periodKey;
  const [year, month] = periodKey.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

/** Nhãn kỳ suy ra từ một khoá tháng (dùng cho ô "Từ ngày / Tháng", "Đến ngày / Tháng"). */
export function periodLabelFromMonth(kind: PeriodKind, monthKey: string): string {
  if (!isValidMonthKey(monthKey)) return "—";
  return periodLabel(kind, periodKeyOf(kind, monthKey));
}

/**
 * Mốc mặc định khi mở bộ lọc: kỳ "Đến" = kỳ dữ liệu hiện tại,
 * kỳ "Từ" = kỳ liền trước cùng loại (tháng trước / quý trước / năm trước).
 */
export function defaultCompareMonths(
  kind: PeriodKind,
  baseMonthKey: string
): { from: string; to: string } {
  const to = isValidMonthKey(baseMonthKey) ? baseMonthKey : currentMonthKey();
  const step = kind === "year" ? 12 : kind === "quarter" ? 3 : 1;
  return { from: addMonths(to, -step), to };
}
