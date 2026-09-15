import { getSupabaseAdmin } from "@/lib/supabase";
import {
  KPI_HISTORY_EVENTS_TABLE,
  KPI_HISTORY_SELECT,
  KPI_HISTORY_TABLE,
  KPI_HISTORY_VALUE_FIELDS,
  historyRowRawValues,
  isMissingKpiHistoryError,
  monthKeyFromTimestamp,
  periodPartsOf,
  type KpiHistoryPeriodParts,
  type KpiHistoryRow,
} from "./kpi-history";

/**
 * TIẾN TRÌNH CHỐT MỐC LỊCH SỬ KPI  (Historical Snapshot job).
 *
 * ⚠️ NGUYÊN TẮC AN TOÀN:
 * - HOÀN TOÀN ĐỘC LẬP với luồng cào web (`refresh-all`, `cron-sync`, `sync-*`) và
 *   với luồng tổng hợp dữ liệu chính. File này chỉ ĐỌC các bảng KPI hiện có để
 *   CẤT vào bảng riêng `kpi_history` — không UPDATE/không ALTER bảng KPI.
 * - Hàm không bao giờ throw: mọi lỗi được nuốt và trả về trong `message`, do đó
 *   không thể làm hỏng luồng nghiệp vụ hay gây lỗi 500 ở nơi gọi.
 * - Có thể gọi từ: API độc lập, cron riêng, hoặc nút "Chốt mốc" trong Bộ lọc.
 */

/** Kích thước lô khi đọc/ghi để không làm nặng database. */
const READ_CHUNK = 200;
const WRITE_CHUNK = 100;

type JsonRecord = Record<string, unknown>;

export interface KpiHistorySnapshotOptions {
  /** Danh sách dashboard có thể cần chốt mốc. */
  dashboardIds?: string[];
  /** Chốt mốc theo đơn vị hành chính (dashboard có unit_id tương ứng). */
  unitIds?: string[];
  /** Chốt mốc cho TẤT CẢ dashboard (mặc định khi không truyền gì). */
  all?: boolean;
  /** Ép kỳ "YYYY-MM" (bỏ qua suy luận từ metadata). */
  period?: string;
  /** Nhãn nguồn gọi (audit): cron-18h30, api, bo-loc-tu-dong… */
  source?: string;
  /** Giới hạn số dashboard xử lý trong 1 lượt (mặc định 500). */
  limit?: number;
  /** Ghi thêm log sự kiện khi số liệu thay đổi (mặc định bật). */
  writeEvents?: boolean;
}

export interface KpiHistorySnapshotResult {
  ok: boolean;
  message: string;
  /** Bảng kpi_history chưa được tạo (chưa chạy migration 0006). */
  missingTable: boolean;
  processedDashboards: number;
  inserted: number;
  updated: number;
  unchanged: number;
  events: number;
  periods: Record<string, number>;
}

function emptyResult(partial: Partial<KpiHistorySnapshotResult> = {}): KpiHistorySnapshotResult {
  return {
    ok: false,
    message: "",
    missingTable: false,
    processedDashboards: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    events: 0,
    periods: {},
    ...partial,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toNum(raw: unknown): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Lấy 16 cột số liệu thô của một dashboard từ bản ghi B1/B2 hiện có. */
function buildRawValues(b1: JsonRecord | undefined, b2: JsonRecord | undefined) {
  const values: Record<string, number> = {};
  for (const field of KPI_HISTORY_VALUE_FIELDS) {
    values[field] = 0;
  }
  const copy = (row: JsonRecord | undefined) => {
    if (!row) return;
    for (const field of KPI_HISTORY_VALUE_FIELDS) {
      if (row[field] !== undefined && row[field] !== null) values[field] = toNum(row[field]);
    }
  };
  copy(b1);
  copy(b2);
  return values;
}

/** So sánh 16 cột số liệu giữa 2 bộ giá trị (để biết số liệu có thay đổi). */
function valuesChanged(a: Record<string, number>, b: Record<string, number>): boolean {
  return KPI_HISTORY_VALUE_FIELDS.some((field) => (a[field] ?? 0) !== (b[field] ?? 0));
}
/**
 * Chạy 1 lượt CHỐT MỐC lịch sử cho toàn bộ (hoặc một nhóm) dashboard.
 *
 * Luồng: ĐỌC kpi_business_units / kpi_products + metadata của dashboard
 *        → suy ra kỳ "YYYY-MM" → UPSERT vào `kpi_history`
 *          (mỗi dashboard chỉ 1 dòng cho mỗi tháng = trạng thái cuối cùng của kỳ),
 *        → ghi thêm 1 dòng log vào `kpi_history_events` khi số liệu THAY ĐỔI.
 *
 * Bảo đảm: không bao giờ throw; không ghi gì vào bảng KPI hiện có;
 * không ALTER/không đổi cấu trúc bất kỳ bảng nào.
 */
export async function runKpiHistorySnapshot(
  options: KpiHistorySnapshotOptions
): Promise<KpiHistorySnapshotResult> {
  const result = emptyResult();
  const source = (options.source ?? "snapshot").slice(0, 60);
  const writeEvents = options.writeEvents !== false;

  try {
    const admin = getSupabaseAdmin();

    /* ---------- 1. Xác định danh sách dashboard cần chốt mốc ---------- */
    const limit = Math.max(1, Math.min(options.limit ?? 500, 1000));
    const nothingSelected =
      !options.all &&
      (!options.dashboardIds || options.dashboardIds.length === 0) &&
      (!options.unitIds || options.unitIds.length === 0);

    if (nothingSelected) {
      result.ok = true;
      result.message = "Không có phạm vi nào được yêu cầu (truyền all=true hoặc dashboardIds/unitIds).";
      return result;
    }

    let dashQuery = admin
      .from("dashboards")
      .select("id, unit_id, metadata, updated_at")
      .limit(limit);
    if (options.dashboardIds && options.dashboardIds.length > 0) {
      dashQuery = dashQuery.in("id", options.dashboardIds);
    } else if (options.unitIds && options.unitIds.length > 0) {
      dashQuery = dashQuery.in("unit_id", options.unitIds);
    }

    const { data: dashRows, error: dashError } = await dashQuery;
    if (dashError) {
      result.message = `Không đọc được danh sách dashboard: ${dashError.message}`;
      return result;
    }

    const dashboards = (dashRows ?? []) as Array<{
      id: string;
      unit_id: string | null;
      metadata: JsonRecord | null;
      updated_at: string | null;
    }>;
    if (dashboards.length === 0) {
      result.ok = true;
      result.message = "Không có dashboard nào cần chốt mốc.";
      return result;
    }

    /* ---------- 2. Suy ra kỳ "YYYY-MM" của từng dashboard ---------- */
    const periodOf = new Map<string, string>();
    const periodSet = new Set<string>();
    for (const dash of dashboards) {
      const meta = (dash.metadata ?? {}) as JsonRecord;
      const resolved =
        monthKeyFromTimestamp(meta.last_sync_at) ??
        monthKeyFromTimestamp(meta.last_synced_at) ??
        monthKeyFromTimestamp(dash.updated_at);
      const monthKey = options.period ?? resolved ?? monthKeyFromTimestamp(new Date());
      if (!monthKey || !periodPartsOf(monthKey)) continue;
      periodOf.set(dash.id, monthKey);
      periodSet.add(monthKey);
      result.periods[monthKey] = (result.periods[monthKey] ?? 0) + 1;
    }
    result.processedDashboards = periodOf.size;

    if (periodSet.size === 0) {
      result.message = "Không suy ra được kỳ nào (thiếu metadata & updated_at).";
      return result;
    }
    /* ---------- 3. Đọc số liệu B1/B2 hiện có (chỉ đọc) ---------- */
    const dashIds = dashboards.map((dash) => dash.id);
    const b1ByDash = new Map<string, JsonRecord>();
    const b2ByDash = new Map<string, JsonRecord>();

    for (const chunk of chunkArray(dashIds, READ_CHUNK)) {
      const [b1Res, b2Res] = await Promise.all([
        admin.from("kpi_business_units").select("*").in("dashboard_id", chunk),
        admin.from("kpi_products").select("*").in("dashboard_id", chunk),
      ]);
      if (b1Res.error || b2Res.error) {
        result.message = `Không đọc được dữ liệu KPI hiện tại: ${
          b1Res.error?.message ?? b2Res.error?.message ?? ""
        }`;
        return result;
      }
      for (const row of (b1Res.data ?? []) as JsonRecord[]) {
        b1ByDash.set(String(row.dashboard_id), row);
      }
      for (const row of (b2Res.data ?? []) as JsonRecord[]) {
        b2ByDash.set(String(row.dashboard_id), row);
      }
    }

    /* ---------- 4. Chuẩn bị mốc cần ghi ---------- */
    interface PreparedSnapshot {
      dashboardId: string;
      monthKey: string;
      parts: KpiHistoryPeriodParts;
      values: Record<string, number>;
    }
    const prepared: PreparedSnapshot[] = [];
    for (const dash of dashboards) {
      const monthKey = periodOf.get(dash.id);
      if (!monthKey) continue;
      const parts = periodPartsOf(monthKey);
      if (!parts) continue;
      prepared.push({
        dashboardId: dash.id,
        monthKey,
        parts,
        values: buildRawValues(b1ByDash.get(dash.id), b2ByDash.get(dash.id)),
      });
    }

    /* ---------- 5. Đọc mốc đã có trong kho lịch sử ---------- */
    const existingByKey = new Map<string, KpiHistoryRow>();
    for (const chunk of chunkArray(dashIds, READ_CHUNK)) {
      const { data: historyRows, error: historyError } = await admin
        .from(KPI_HISTORY_TABLE)
        .select(KPI_HISTORY_SELECT)
        .in("dashboard_id", chunk)
        .in("period_month", Array.from(periodSet));
      if (historyError) {
        if (isMissingKpiHistoryError(historyError)) {
          result.missingTable = true;
          result.message =
            "Bảng kpi_history chưa tồn tại — hãy chạy migration supabase/migrations/0006_kpi_history.sql trước.";
          return result;
        }
        result.message = `Không đọc được kho lịch sử: ${historyError.message}`;
        return result;
      }
      for (const row of (historyRows ?? []) as unknown as KpiHistoryRow[]) {
        existingByKey.set(`${row.dashboard_id}|${row.period_month}`, row);
      }
    }

    /* ---------- 6. Ghi mới / cập nhật mốc ---------- */
    const nowIso = new Date().toISOString();
    const inserts: JsonRecord[] = [];
    const updates: Array<{ dashboardId: string; monthKey: string; values: Record<string, number> }> = [];
    const events: JsonRecord[] = [];

    for (const snapshot of prepared) {
      const key = `${snapshot.dashboardId}|${snapshot.monthKey}`;
      const existing = existingByKey.get(key);

      if (!existing) {
        inserts.push({
          dashboard_id: snapshot.dashboardId,
          period_month: snapshot.monthKey,
          period_quarter: snapshot.parts.quarter,
          period_year: snapshot.parts.year,
          source,
          captured_at: nowIso,
          first_captured_at: nowIso,
          capture_count: 1,
          ...snapshot.values,
        });
        result.inserted += 1;
        if (writeEvents) {
          events.push(buildEvent(snapshot, null, snapshot.values, source, nowIso));
        }
        continue;
      }

      const previous = historyRowRawValues(existing);
      if (!valuesChanged(previous, snapshot.values)) {
        result.unchanged += 1;
        continue;
      }

      updates.push({
        dashboardId: snapshot.dashboardId,
        monthKey: snapshot.monthKey,
        values: snapshot.values,
      });
      result.updated += 1;
      if (writeEvents) {
        events.push(buildEvent(snapshot, previous, snapshot.values, source, nowIso));
      }
    }

    /* Ghi INSERT theo lô nhỏ */
    for (const chunk of chunkArray(inserts, WRITE_CHUNK)) {
      const { error: insertError } = await admin.from(KPI_HISTORY_TABLE).insert(chunk);
      if (insertError) {
        result.message = `Một phần mốc chưa ghi được (insert): ${insertError.message}`;
        break;
      }
    }

    /* Ghi UPDATE theo lô nhỏ — giữ nguyên first_captured_at, tăng capture_count */
    for (const chunk of chunkArray(updates, WRITE_CHUNK)) {
      const responses = await Promise.all(
        chunk.map((item) => {
          const existingRow = existingByKey.get(`${item.dashboardId}|${item.monthKey}`);
          return admin
            .from(KPI_HISTORY_TABLE)
            .update({
              ...item.values,
              source,
              captured_at: nowIso,
              capture_count: (Number(existingRow?.capture_count) || 0) + 1,
            })
            .eq("dashboard_id", item.dashboardId)
            .eq("period_month", item.monthKey);
        })
      );
      const updateError = responses.find((res) => res.error)?.error;
      if (updateError) {
        result.message = `Một phần mốc chưa ghi được (update): ${updateError.message}`;
        break;
      }
    }

    /* ---------- 7. Ghi log sự kiện (append-only) ---------- */
    for (const chunk of chunkArray(events, WRITE_CHUNK)) {
      const { error: eventError } = await admin.from(KPI_HISTORY_EVENTS_TABLE).insert(chunk);
      if (eventError) {
        // Log sự kiện chỉ mang tính audit — lỗi ở đây không coi là thất bại tổng thể.
        result.message = result.message || `Log sự kiện chưa ghi đủ: ${eventError.message}`;
        break;
      }
      result.events += chunk.length;
    }

    result.ok = !result.message || result.inserted + result.updated > 0 || result.unchanged > 0;
    result.message =
      result.message ||
      `Chốt mốc xong: ${result.inserted} mốc mới, ${result.updated} cập nhật, ${result.unchanged} không đổi.`;
    return result;
  } catch (error) {
    // Không bao giờ throw — tiến trình độc lập không được làm hỏng nơi gọi.
    result.message = `Chốt mốc lịch sử gặp lỗi (đã bỏ qua): ${
      error instanceof Error ? error.message : String(error)
    }`;
    return result;
  }
}

/** Dựng 1 dòng log sự kiện (append-only) cho kho kpi_history_events. */
function buildEvent(
  snapshot: {
    dashboardId: string;
    monthKey: string;
    parts: KpiHistoryPeriodParts;
    values: Record<string, number>;
  },
  previous: Record<string, number> | null,
  next: Record<string, number>,
  source: string,
  atIso: string
): JsonRecord {
  const changed = previous
    ? KPI_HISTORY_VALUE_FIELDS.filter((field) => (previous[field] ?? 0) !== (next[field] ?? 0))
    : KPI_HISTORY_VALUE_FIELDS.filter((field) => (next[field] ?? 0) !== 0);
  return {
    dashboard_id: snapshot.dashboardId,
    period_month: snapshot.monthKey,
    period_quarter: snapshot.parts.quarter,
    period_year: snapshot.parts.year,
    source,
    captured_at: atIso,
    payload: {
      kind: previous ? "changed" : "created",
      changed_fields: changed,
      previous: previous
        ? Object.fromEntries(changed.map((field) => [field, previous[field] ?? 0]))
        : null,
      next: Object.fromEntries(changed.map((field) => [field, next[field] ?? 0])),
    },
  };
}