/**
 * ============================================================================
 * lib/b3-revenue.ts — LOGIC "CỘNG DỒN LŨY KẾ" CHO KHỐI B3 (DÒNG CHẢY DOANH THU)
 * ============================================================================
 *
 * BÀI TOÁN: web nguồn chỉ công bố MỘT con số — `total_scraped_value` (tổng
 * doanh thu tính đến hiện tại, được CỘNG TỔNG `data-value` từ TOÀN BỘ URL của
 * xã/phường). UI B3 hiển thị 5 thẻ: Ngày / Tuần / Tháng / Quý / Năm.
 *
 * THUẬT TOÁN TIME-BASED ACCUMULATION (bắt buộc — Yêu cầu 2):
 *   1. Đọc object b3 hiện tại từ DB: { daily, weekly, monthly, quarterly,
 *      yearly, last_updated, last_raw_value }.
 *   2. Lấy `now` theo múi giờ Việt Nam GMT+7 (dayjs + Asia/Ho_Chi_Minh).
 *   3. RESET CHU KỲ — chỉ reset ĐÚNG mốc đã sang kỳ mới, KHÔNG đụng các
 *      mốc còn lại:
 *        isSameDay == false    -> daily = 0
 *        isSameWeek == false   -> weekly = 0   (tuần ISO: T2 → CN)
 *        isSameMonth == false  -> monthly = 0
 *        isSameQuarter == false-> quarterly = 0
 *        isSameYear == false   -> yearly = 0
 *   4. DELTA: delta = total_scraped_value - last_raw_value.
 *      Nếu delta < 0 (web nguồn bị reset số) -> delta = total_scraped_value.
 *   5. CỘNG DỒN: daily += delta; weekly += delta; monthly += delta;
 *      quarterly += delta; yearly += delta.
 *   6. LƯU: last_updated = now (GMT+7), last_raw_value = total_scraped_value.
 *
 * Ví dụ: sang ngày mới chỉ có `daily` reset về 0, còn tuần/tháng/quý/năm vẫn
 * giữ số đã tích lũy và tiếp tục cộng delta mới vào.
 *
 * File này là hàm THUẦN (không I/O) nên dùng chung cho mọi API route.
 * ============================================================================
 */

import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

/** Múi giờ BẮT BUỘC cho toàn bộ logic reset chu kỳ: Việt Nam (GMT+7). */
export const B3_TIMEZONE = "Asia/Ho_Chi_Minh";

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
  /** ISO UTC của lần cập nhật gần nhất — mốc so sánh reset chu kỳ (theo GMT+7). */
  last_updated?: string;
  /** `total_scraped_value` của lần cào gần nhất — nền tảng tính delta. */
  last_raw_value?: number;
  /** (Legacy) khóa cũ của `last_updated`, vẫn đọc để không mất dữ liệu cũ. */
  last_updated_date?: string;
  /** Cho phép giữ nguyên các key khác nếu tương lai bổ sung. */
  [key: string]: unknown;
}

/** Kết quả áp dụng một lần cập nhật doanh thu. */
export interface B3ApplyResult {
  b3: B3State;
  /** Số phát sinh mới được cộng vào cả 5 mốc. */
  delta: number;
  /** true = dùng cơ chế cộng dồn (nguồn `total_scraped_value`); false = gán thẳng. */
  accumulated: boolean;
  /** Các mốc đã bị reset do sang kỳ mới. */
  reset: Partial<Record<B3Field, boolean>>;
}

export function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Doanh thu là VNĐ -> làm tròn số nguyên để tránh rác thập phân tích lũy kế. */
function roundMoney(value: number): number {
  return Math.round(value);
}

/** Chuẩn hoá một giá trị thời gian về dayjs theo múi giờ GMT+7 (Việt Nam). */
export function toVietnamTime(input?: Date | string | number | null): Dayjs {
  const source =
    input === undefined || input === null || input === "" ? new Date() : input;
  const parsed = dayjs(source as Date | string | number);
  // Giá trị hỏng -> dùng thời điểm hiện tại (an toàn, không lan lỗi ra ngoài).
  return (parsed.isValid() ? parsed : dayjs()).tz(B3_TIMEZONE);
}

/** Cùng TUẦN ISO 8601 (thứ 2 → Chủ nhật) — so sánh "cùng tuần trong năm". */
function isSameIsoWeek(a: Dayjs, b: Dayjs): boolean {
  return a.isoWeekYear() === b.isoWeekYear() && a.isoWeek() === b.isoWeek();
}

/**
 * Chuẩn hoá object b3 từ DB về đủ 5 mốc + `last_updated` + `last_raw_value`.
 *
 * Dữ liệu cũ (trước khi có thuật toán mới) chỉ có `last_updated_date` và không
 * có `last_raw_value` -> suy ra: mốc thời gian lấy từ `last_updated_date`,
 * raw value lấy từ `daily` (vì trước đây `daily` chính là giá trị đã cào).
 */
export function normalizeB3(raw: unknown): B3State {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const lastUpdatedRaw = src.last_updated ?? src.last_updated_date;
  const lastUpdated =
    lastUpdatedRaw === undefined || lastUpdatedRaw === null || lastUpdatedRaw === ""
      ? undefined
      : String(lastUpdatedRaw);

  const hasRaw =
    src.last_raw_value !== undefined && src.last_raw_value !== null && src.last_raw_value !== "";
  const lastRawValue = hasRaw ? toNum(src.last_raw_value) : lastUpdated ? toNum(src.daily) : 0;

  return {
    ...src,
    daily: toNum(src.daily),
    weekly: toNum(src.weekly),
    monthly: toNum(src.monthly),
    quarterly: toNum(src.quarterly),
    yearly: toNum(src.yearly),
    last_updated: lastUpdated,
    last_updated_date: lastUpdated,
    last_raw_value: lastRawValue,
  };
}

/**
 * ===================== HÀM CỘNG DỒN CHÍNH (YÊU CẦU 2) =====================
 *
 * Áp dụng `total_scraped_value` MỚI (đã cộng tổng `data-value` từ toàn bộ URL
 * của xã/phường) vào object `b3` theo đúng 6 bước của thuật toán:
 *
 *   1. Đọc b3 hiện tại      -> normalizeB3 (daily/weekly/... + last_updated +
 *                               last_raw_value).
 *   2. `now` theo GMT+7      -> toVietnamTime (dayjs).
 *   3. Reset chu kỳ          -> chỉ reset mốc nào isSame* == false.
 *   4. delta                 -> total_scraped_value - last_raw_value
 *                               (delta < 0 -> delta = total_scraped_value).
 *   5. Cộng dồn              -> cả 5 thẻ += delta.
 *   6. Lưu                   -> last_updated = now, last_raw_value = total.
 *
 * @param currentB3          Object b3 hiện tại trong DB (JSONB).
 * @param totalScrapedValue  Tổng `data-value` vừa cào được (một biến duy nhất).
 * @param now                Thời điểm hiện tại (mặc định `new Date()`), sẽ được
 *                           quy về GMT+7 bên trong.
 */
export function accumulateB3ScrapedValue(
  currentB3: unknown,
  totalScrapedValue: unknown,
  now: Date = new Date()
): B3ApplyResult {
  // Bước 1: object B3 hiện tại từ DB.
  const base = normalizeB3(currentB3);
  const total = toNum(totalScrapedValue);

  // Bước 2: thời gian hiện tại theo múi giờ Việt Nam (GMT+7).
  const nowVn = toVietnamTime(now);
  const lastVn = base.last_updated ? toVietnamTime(base.last_updated) : null;

  const reset: Partial<Record<B3Field, boolean>> = {};
  const next: B3State = { ...base };

  // Bước 3: RESET CHU KỲ — mỗi mốc xét riêng, không đụng các mốc khác.
  // Chưa từng cập nhật (lastVn == null) -> coi như mọi mốc đều đã qua kỳ.
  const sameDay = lastVn !== null && nowVn.isSame(lastVn, "day");
  const sameWeek = lastVn !== null && isSameIsoWeek(nowVn, lastVn);
  const sameMonth = lastVn !== null && nowVn.isSame(lastVn, "month");
  const sameQuarter = lastVn !== null && nowVn.isSame(lastVn, "quarter");
  const sameYear = lastVn !== null && nowVn.isSame(lastVn, "year");

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

  // Bước 4: DELTA phát sinh (dựa trên last_raw_value, KHÔNG dựa trên daily).
  const lastRawValue = toNum(base.last_raw_value);
  let delta = total - lastRawValue;
  // Web nguồn reset số về 0 giữa chừng -> toàn bộ giá trị mới là phát sinh.
  if (delta < 0) delta = total;

  // Bước 5: CỘNG DỒN vào cả 5 thẻ (daily đã reset đúng kỳ ở Bước 3).
  next.daily = roundMoney(next.daily + delta);
  next.weekly = roundMoney(next.weekly + delta);
  next.monthly = roundMoney(next.monthly + delta);
  next.quarterly = roundMoney(next.quarterly + delta);
  next.yearly = roundMoney(next.yearly + delta);

  // Bước 6: Lưu mốc thời gian (GMT+7) + giá trị cào thô mới nhất.
  const isoNow = nowVn.toISOString();
  next.last_updated = isoNow;
  next.last_updated_date = isoNow; // mirror legacy để dữ liệu cũ/mới đồng nhất
  next.last_raw_value = total;

  return { b3: next, delta: roundMoney(delta), accumulated: true, reset };
}

/**
 * Áp dụng một số liệu doanh thu mới vào object `b3`.
 *
 * @param currentB3  Object b3 hiện tại trong DB (JSONB).
 * @param field      Mốc vừa cào/nhập. `daily` = nguồn chính (tổng đã cào).
 * @param newRevenue Giá trị mới. Với `daily` đây là `total_scraped_value`.
 * @param now        Mốc thời gian hiện tại (mặc định `new Date()`, quy GMT+7).
 *
 * --- Nhánh `daily` ---
 *   Chạy đúng thuật toán TIME-BASED ACCUMULATION ở trên
 *   (xem `accumulateB3ScrapedValue`).
 *
 * --- Các field khác (weekly/monthly/quarterly/yearly) ---
 *   Người nhập tay hoặc nguồn riêng cho đúng mốc đó: coi là giá trị TỔNG của
 *   kỳ nên GÁN THẲNG, không cộng dồn delta (tránh cộng đúp) và KHÔNG đụng
 *   `last_updated` / `last_raw_value` (không làm lệch cửa sổ reset của daily).
 */
export function applyB3Revenue(
  currentB3: unknown,
  field: B3Field,
  newRevenue: unknown,
  now: Date = new Date()
): B3ApplyResult {
  if (field === "daily") {
    return accumulateB3ScrapedValue(currentB3, newRevenue, now);
  }

  const base = normalizeB3(currentB3);
  const value = toNum(newRevenue);
  const next: B3State = { ...base };
  next[field] = value;
  return { b3: next, delta: 0, accumulated: false, reset: {} };
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

