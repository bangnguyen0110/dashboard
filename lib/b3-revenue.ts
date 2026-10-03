/**
 * ============================================================================
 * lib/b3-revenue.ts — LOGIC "CỘNG DỒN LŨY KẾ" CHO KHỐI B3 (DÒNG CHẢY DOANH THU)
 * ============================================================================
 *
 * BÀI TOÁN: web nguồn chỉ công bố MỘT con số — tổng doanh thu trong ngày tính
 * đến hiện tại (running total). Nhưng UI B3 hiển thị 5 thẻ:
 * Ngày / Tuần / Tháng / Quý / Năm. Nếu chỉ ghi `daily` thì 4 thẻ còn lại không
 * bao giờ có số -> phải tự động "rót" delta vào các mốc lớn hơn.
 *
 * NGUYÊN TẮC:
 *   1. `delta` = phần PHÁT SINH MỚI kể từ lần cào gần nhất, KHÔNG phải tổng.
 *      -> Cào lại nhiều lần trong cùng 1 ngày sẽ ra delta = 0, KHÔNG cộng đúp.
 *   2. Sang ngày/tuần/tháng/quý/năm mới -> reset đúng mốc đó về 0.
 *   3. Thứ tự BẮT BUỘC: tính delta từ `daily` CŨ -> reset mốc đã qua -> cộng delta.
 *
 * File này là hàm THUẦN (không I/O) nên dùng chung được cho mọi API route mà
 * không phụ thuộc thứ tự module.
 * ============================================================================
 */

/** 5 mốc doanh thu của khối B3. */
export const B3_FIELDS = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export type B3Field = (typeof B3_FIELDS)[number];

/** Cấu trúc object `b3` lưu trong JSONB của bảng `dashboards`. */
export interface B3State {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  yearly: number;
  /** ISO date/time của lần cập nhật doanh thu gần nhất (dùng để reset theo kỳ). */
  last_updated_date?: string;
  /** Cho phép giữ nguyên các key khác nếu tương lai bổ sung. */
  [key: string]: unknown;
}

/** Kết quả áp dụng một lần cập nhật doanh thu. */
export interface B3ApplyResult {
  b3: B3State;
  /** Số phát sinh mới được rót vào Tuần/Tháng/Quý/Năm. */
  delta: number;
  /** true = dùng cơ chế cộng dồn (nguồn `daily`); false = gán thẳng. */
  accumulated: boolean;
  /** Các mốc đã bị reset do sang kỳ mới. */
  reset: Partial<Record<B3Field, boolean>>;
}

const DAY_MS = 86_400_000;

export function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Doanh thu là VNĐ -> làm tròn số nguyên để tránh rác thập phân tích lũy kế. */
function roundMoney(value: number): number {
  return Math.round(value);
}

/** Tuần ISO 8601 (thứ 2 → Chủ nhật) — dùng để so sánh "cùng tuần trong năm". */
function isoWeekParts(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thứ tư là ngày 01/01/1970 -> đưa target về thứ tư của tuần đó.
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { year: target.getUTCFullYear(), week };
}

/** Nhận diện 5 "kỳ" của một mốc thời gian, dùng để so sánh reset. */
export interface RevenuePeriods {
  day: string;
  week: string;
  month: string;
  quarter: string;
  year: string;
}

export function computePeriods(date: Date): RevenuePeriods {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const iso = isoWeekParts(date);
  return {
    day: `${y}-${m + 1}-${d}`,
    // Khoá theo ISO year để tuần 1 của năm sau khác tuần 52 của năm trước.
    week: `${iso.year}-W${iso.week}`,
    month: `${y}-${m + 1}`,
    quarter: `${y}-Q${Math.floor(m / 3) + 1}`,
    year: `${y}`,
  };
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Chuẩn hoá object b3 từ DB về đủ 5 mốc + last_updated_date. */
export function normalizeB3(raw: unknown): B3State {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...src,
    daily: toNum(src.daily),
    weekly: toNum(src.weekly),
    monthly: toNum(src.monthly),
    quarterly: toNum(src.quarterly),
    yearly: toNum(src.yearly),
  };
}
/**
 * ============================ HÀM CỘNG DỒN CHÍNH ============================
 *
 * Áp dụng một số liệu doanh thu mới vào object `b3`.
 *
 * @param currentB3  Object b3 hiện tại trong DB (JSONB).
 * @param field       Mốc vừa cào được. `daily` = nguồn chính (tổng trong ngày).
 * @param newRevenue  Giá trị mới đọc từ web nguồn.
 * @param now         Mốc thời gian hiện tại (mặc định `new Date()`).
 *
 * --- Nhánh `daily` (cộng dồn lũy kế) ---
 *   delta = newRevenue - daily_cu   (nếu cùng ngày)
 *         = newRevenue              (nếu sang ngày mới, hoặc delta < 0 do
 *                                     web nguồn tự reset bộ đếm)
 *   Sau đó: reset mốc đã qua kỳ, đặt daily = newRevenue, cộng delta vào
 *   weekly / monthly / quarterly / yearly.
 *
 *   Kịch bản: cào lại 10 lần trong ngày mà newRevenue không đổi
 *   -> lần 1 delta = newRevenue, lần 2..10 delta = 0 -> KHÔNG cộng đúp.
 *
 * --- Các field khác (weekly/monthly/quarterly/yearly) ---
 *   Người nhập tay hoặc nguồn riêng cho đúng mốc đó: coi là giá trị TỔNG của
 *   kỳ nên GÁN THẲNG, không cộng dồn delta (tránh cộng đúp).
 */
export function applyB3Revenue(
  currentB3: unknown,
  field: B3Field,
  newRevenue: unknown,
  now: Date = new Date()
): B3ApplyResult {
  const base = normalizeB3(currentB3);
  const value = toNum(newRevenue);
  const nowPeriods = computePeriods(now);
  const lastDate = parseDate(base.last_updated_date);
  const lastPeriods = lastDate ? computePeriods(lastDate) : null;

  const reset: Partial<Record<B3Field, boolean>> = {};
  // Chưa từng cập nhật -> coi như lần đầu: reset toàn bộ cho sạch.
  const fresh = !lastPeriods;

  const next: B3State = { ...base };

  if (field === "daily") {
    const sameDay = !fresh && lastPeriods!.day === nowPeriods.day;
    const sameWeek = !fresh && lastPeriods!.week === nowPeriods.week;
    const sameMonth = !fresh && lastPeriods!.month === nowPeriods.month;
    const sameQuarter = !fresh && lastPeriods!.quarter === nowPeriods.quarter;
    const sameYear = !fresh && lastPeriods!.year === nowPeriods.year;

    // 1) Tính delta TRƯỚC khi reset (đọc `daily` cũ).
    const oldDaily = base.daily;
    let delta = sameDay ? value - oldDaily : value;
    // Web nguồn tự reset bộ đếm trong ngày -> toàn bộ giá trị mới là phát sinh.
    if (delta < 0) delta = value;

    // 2) Reset các mốc đã sang kỳ mới.
    if (!sameDay) {
      next.daily = 0;
      reset.daily = true;
    }
    if (!sameWeek) {
      next.weekly = 0;
      reset.weekly = true;
    }
    if (!sameMonth) {
      next.monthly = 0;
      reset.monthly = true;
    }
    if (!sameQuarter) {
      next.quarterly = 0;
      reset.quarterly = true;
    }
    if (!sameYear) {
      next.yearly = 0;
      reset.yearly = true;
    }

    // 3) Ghi giá trị ngày + rót delta vào các mốc lớn hơn.
    next.daily = value;
    next.weekly = roundMoney(next.weekly + delta);
    next.monthly = roundMoney(next.monthly + delta);
    next.quarterly = roundMoney(next.quarterly + delta);
    next.yearly = roundMoney(next.yearly + delta);
    next.last_updated_date = now.toISOString();

    return { b3: next, delta: roundMoney(delta), accumulated: true, reset };
  }

  // Field khác: gán thẳng giá trị tổng của kỳ (không cộng dồn delta).
  next[field] = value;
  if (fresh) next.last_updated_date = now.toISOString();
  return { b3: next, delta: 0, accumulated: false, reset };
}

/**
 * Đồng bộ NGƯỜI DÙNG vào `metadata` cho cả 5 mốc.
 *
 * BẮT BUỘC: `dashboard-detail.tsx` chạy `applyMetricValueToRow()` để ghi đè `b3`
 * bằng giá trị lấy từ `metadata` (điều kiện `parsed > 0`). Nếu chỉ ghi cột `b3`
 * mà `metadata` còn giá trị cũ, UI vẫn hiển thị số cũ -> sai.
 */
export function buildB3MetadataMirror(
  currentMetadata: unknown,
  b3: B3State
): Record<string, unknown> {
  const meta = (
    currentMetadata && typeof currentMetadata === "object"
      ? { ...(currentMetadata as Record<string, unknown>) }
      : {}
  ) as Record<string, unknown>;

  const metrics =
    meta.metrics && typeof meta.metrics === "object"
      ? { ...(meta.metrics as Record<string, unknown>) }
      : {};

  for (const f of B3_FIELDS) {
    const metricKey = `b3_${f}`;
    meta[metricKey] = b3[f];
    metrics[metricKey] = b3[f];
  }
  meta.metrics = metrics;
  return meta;
}