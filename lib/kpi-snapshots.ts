/**
 * Kho "mốc số liệu" (snapshot) lưu trên trình duyệt, phục vụ tính năng
 * "Bộ lọc và so sánh thông tin" (đối chiếu kỳ hiện tại với kỳ trước).
 *
 * ⚠️ AN TOÀN HỆ THỐNG:
 * - Chỉ dùng `window.localStorage` của trình duyệt, TUYỆT ĐỐI KHÔNG ghi vào Supabase.
 * - Không phụ thuộc bất kỳ API backend nào => không thể gây hồi quy cho luồng cào/sync.
 * - Mọi thao tác đều được bọc try/catch (chế độ riêng tư, hết dung lượng… không làm vỡ UI).
 *
 * Cấu trúc lưu trữ:
 * {
 *   "province:<unitId>": { "2026-08": { period, capturedAt, values }, "2026-09": { … } },
 *   "unit:<unitId>"    : { … }
 * }
 */

import { isValidMonthKey } from "./period-utils";

/** Giá trị KPI đã chuẩn hoá về số, khoá là metric key của tính năng so sánh. */
export type KpiSnapshotValues = Record<string, number>;

export interface KpiSnapshotEntry {
  /** Khoá tháng ghi nhận "YYYY-MM". */
  period: string;
  /** Thời điểm ghi nhận (ISO). */
  capturedAt: string;
  values: KpiSnapshotValues;
}

/** scopeKey -> period -> entry */
export type KpiSnapshotStore = Record<string, Record<string, KpiSnapshotEntry>>;

export interface ResolvedKpiSnapshot {
  entry: KpiSnapshotEntry;
  /** Khoá tháng thực tế tìm được (có thể khác kỳ yêu cầu nếu phải lùi về mốc gần nhất). */
  matchedPeriod: string;
  /** true = tìm đúng trong kỳ yêu cầu; false = dùng mốc gần nhất trước kỳ yêu cầu. */
  exact: boolean;
}

export const KPI_SNAPSHOT_STORAGE_KEY = "dashboard:kpi-compare-snapshots:v1";

/** Số kỳ tối đa giữ lại cho mỗi phạm vi (tránh phình localStorage). */
const MAX_PERIODS_PER_SCOPE = 24;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSnapshotEntry(raw: unknown): raw is KpiSnapshotEntry {
  if (!raw || typeof raw !== "object") return false;
  const entry = raw as Partial<KpiSnapshotEntry>;
  if (typeof entry.period !== "string" || !isValidMonthKey(entry.period)) return false;
  if (typeof entry.capturedAt !== "string") return false;
  if (!entry.values || typeof entry.values !== "object") return false;
  return Object.values(entry.values as Record<string, unknown>).every(
    (value) => typeof value === "number"
  );
}

/** Đọc toàn bộ kho mốc; trả về {} nếu chưa có hoặc dữ liệu hỏng. */
export function readKpiSnapshotStore(): KpiSnapshotStore {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(KPI_SNAPSHOT_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const store: KpiSnapshotStore = {};
    for (const [scopeKey, scopeValue] of Object.entries(parsed as Record<string, unknown>)) {
      if (!scopeValue || typeof scopeValue !== "object") continue;
      const scope: Record<string, KpiSnapshotEntry> = {};
      for (const [period, entry] of Object.entries(scopeValue as Record<string, unknown>)) {
        if (isSnapshotEntry(entry)) scope[period] = entry;
      }
      if (Object.keys(scope).length > 0) store[scopeKey] = scope;
    }
    return store;
  } catch {
    return {};
  }
}

export function writeKpiSnapshotStore(store: KpiSnapshotStore): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(KPI_SNAPSHOT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* Bỏ qua: chế độ riêng tư / hết dung lượng */
  }
}

/**
 * Ghi (hoặc cập nhật) mốc số liệu của một phạm vi trong một tháng.
 * Cùng một tháng thì ghi đè bằng số liệu mới nhất — đây là trạng thái cuối của kỳ.
 */
export function saveKpiSnapshot(
  scopeKey: string,
  period: string,
  values: KpiSnapshotValues,
  capturedAt: string = new Date().toISOString()
): KpiSnapshotEntry | null {
  if (!scopeKey || !isValidMonthKey(period)) return null;

  const store = readKpiSnapshotStore();
  const scope = store[scopeKey] ?? {};
  const entry: KpiSnapshotEntry = { period, capturedAt, values: { ...values } };
  scope[period] = entry;

  const periods = Object.keys(scope).sort();
  if (periods.length > MAX_PERIODS_PER_SCOPE) {
    for (const stale of periods.slice(0, periods.length - MAX_PERIODS_PER_SCOPE)) {
      delete scope[stale];
    }
  }

  store[scopeKey] = scope;
  writeKpiSnapshotStore(store);
  return entry;
}

export function getKpiSnapshot(scopeKey: string, period: string): KpiSnapshotEntry | null {
  const store = readKpiSnapshotStore();
  return store[scopeKey]?.[period] ?? null;
}

/** Danh sách khoá tháng đã ghi nhận cho phạm vi (đã sắp xếp tăng dần). */
export function listKpiSnapshotPeriods(scopeKey: string): string[] {
  const store = readKpiSnapshotStore();
  return Object.keys(store[scopeKey] ?? {}).sort();
}

/** Xoá toàn bộ mốc đã lưu (dùng khi cần làm mới lịch sử đối chiếu). */
export function clearKpiSnapshotStore(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(KPI_SNAPSHOT_STORAGE_KEY);
  } catch {
    /* bỏ qua */
  }
}

/**
 * Tìm mốc số liệu cho một kỳ:
 * 1) Ưu tiên mốc mới nhất nằm TRONG kỳ yêu cầu (VD quý: tháng 9 trước tháng 7).
 * 2) Nếu kỳ yêu cầu chưa có mốc nào, lùi về mốc gần nhất TRƯỚC kỳ đó (exact = false).
 */
export function resolveKpiSnapshot(
  scopeKey: string,
  months: string[],
  beforeMonth?: string | null
): ResolvedKpiSnapshot | null {
  if (months.length === 0) return null;

  for (let index = months.length - 1; index >= 0; index -= 1) {
    const entry = getKpiSnapshot(scopeKey, months[index]);
    if (entry) return { entry, matchedPeriod: months[index], exact: true };
  }

  const boundary = beforeMonth ?? months[0];
  const earlier = listKpiSnapshotPeriods(scopeKey).filter((period) => period < boundary);
  if (earlier.length === 0) return null;

  const matchedPeriod = earlier[earlier.length - 1];
  const entry = getKpiSnapshot(scopeKey, matchedPeriod);
  return entry ? { entry, matchedPeriod, exact: false } : null;
}
