import { errorMessage } from "@/lib/server-utils";
import { readRevenueSource } from "@/lib/revenue-sync";
import {
  applyB3Revenue,
  buildB3MetadataMirror,
  normalizeB3,
  B3_FIELDS,
  type B3Field,
} from "@/lib/b3-revenue";
import {
  extractRevenueDataValue,
  fetchSourceHtml,
  normalizeSourceUrl,
} from "@/lib/revenue-scraper";

/**
 * ============================================================================
 * lib/b3-scraper.ts — SERVICE CÀO DOANH THU KHỐI B3 (dùng chung nhiều API)
 * ============================================================================
 *
 * Tách từ `app/api/v1/metrics/cron-b3/route.ts` để DRY: hai endpoint dùng
 * chung đúng MỘT logic cào + cộng dồn:
 *
 *   - `/api/v1/metrics/cron-b3`     : chạy NGẦM theo lịch (cron) hoặc nút
 *                                     "⚡ Cào ngay" ở Dashboard XÃ.
 *   - `/api/v1/metrics/sync-all-b3`: nút "🔄 Làm mới doanh thu" ở Dashboard TỈNH
 *                                     (Admin bấm tay, quét toàn tỉnh).
 *
 * LUỒNG XỬ LÝ chung cho mỗi target:
 *   Fetch web nguồn -> bóc thẻ `data-value`
 *     -> so sánh `metric_links.current_value`
 *     -> UPDATE current_value + `dashboards.b3` qua CỘNG DỒN LŨY KẾ (lib/b3-revenue)
 *     -> INSERT 1 dòng `kpi_revenue_history` (migration 0009).
 *
 * ⚠️ AN TOÀN:
 *   * SSRF: chỉ request đúng URL đã lưu trong DB (không nhận URL từ request).
 *   * Bỏ qua dashboard cấp PROVINCE (Tỉnh tự cộng dồn phía client).
 *   * Pool song song + hạn chót để không vượt giới hạn 60s của serverless.
 *   * Lỗi bảng lịch sử KHÔNG làm hỏng luồng cào (chỉ ghi vào `warnings`).
 * ============================================================================
 */

/** Bảng lịch sử ghi nhận doanh thu B3. */
export const HISTORY_TABLE = "kpi_revenue_history";

/** Cột cần đọc từ bảng `dashboards` cho luồng B3. */
export const DASHBOARD_SELECT =
  "id, unit_id, b3, metadata, settings, unit:administrative_units(type, code)";

const DEFAULT_CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 10_000;
/** Hạn chót an toàn để giữ dưới ngưỡng 60s của serverless. */
const DEADLINE_MS = 50_000;
const MAX_WARNINGS = 5;

/** Dòng nhẹ của `dashboards`. */
export interface DashboardLite {
  id: string;
  unit_id?: string | null;
  b3?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  unit?: { type?: string | null; code?: string | null } | null;
}

/** Dòng nhẹ của `metric_links`. */
export interface MetricLinkLite {
  dashboard_id: string;
  metric_key: string;
  target_url?: string | null;
  current_value?: unknown;
}

/** Một "Link cấu hình" cần cào cho khối B3. */
export interface B3Target {
  dashboardId: string;
  metricKey: string;
  field: B3Field;
  url: string;
  /** `metric_links.current_value` (fallback: giá trị hiện tại trong cột b3). */
  prevValue: number | null;
  /** Dòng metric_links đã tồn tại (nếu không, chỉ ghi `dashboards.b3`). */
  hasLinkRow: boolean;
}

export interface TargetResult {
  target: B3Target;
  status: "changed" | "unchanged" | "error";
  newValue: number | null;
  error?: string;
}

export interface ScanSummary {
  dashboards: number;
  scanned: number;
  changed: number;
  unchanged: number;
  errors: number;
  historySaved: number;
  skipped: number;
  warnings: string[];
  results: TargetResult[];
  durationMs: number;
}

function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Bóc tách `data-value` từ HTML nguồn.
 * Ưu tiên thẻ chuẩn `<p class="chuxanh tongtienthu" data-value>`,
 * fallback: mọi thẻ chứa `data-value="..."` (đọc tới khi ra số hợp lệ).
 */
export function extractDataValue(html: string): number | null {
  if (!html) return null;
  const specific = extractRevenueDataValue(html);
  if (specific !== null) return specific;

  const re = /data-value\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const parsed = toNumOrNull(m[1] ?? m[2] ?? m[3] ?? "");
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Dựng danh sách target cào cho MỘT dashboard từ:
 *  1. `metric_links` có metric_key dạng b3_daily … b3_yearly + target_url;
 *  2. Fallback: `settings.revenue.url_nguon` (modal "Thiết lập doanh thu")
 *     dùng cho thẻ b3_daily khi thẻ này CHƯA có link riêng.
 */
export function buildTargets(dash: DashboardLite, links: MetricLinkLite[]): B3Target[] {
  const targets: B3Target[] = [];
  const currentB3 = dash.b3 ?? {};
  const seenFields = new Set<B3Field>();

  for (const link of links) {
    const key = String(link.metric_key ?? "");
    if (!key.startsWith("b3_")) continue;
    const field = key.slice(3) as B3Field;
    if (!B3_FIELDS.includes(field)) continue;

    const url = normalizeSourceUrl(link.target_url ?? "");
    if (!url) continue;

    targets.push({
      dashboardId: dash.id,
      metricKey: key,
      field,
      url,
      prevValue: toNumOrNull(link.current_value) ?? toNumOrNull(currentB3[field]),
      hasLinkRow: true,
    });
    seenFields.add(field);
  }

  // URL nguồn chung (Thiết lập doanh thu) -> thẻ "Doanh thu trong ngày"
  // nếu thẻ daily CHƯA có link riêng.
  const urlNguon = normalizeSourceUrl(readRevenueSource(dash).url_nguon ?? "");
  if (urlNguon && !seenFields.has("daily")) {
    const dailyRow = links.find((l) => String(l.metric_key ?? "") === "b3_daily");
    targets.push({
      dashboardId: dash.id,
      metricKey: "b3_daily",
      field: "daily",
      url: urlNguon,
      prevValue: toNumOrNull(dailyRow?.current_value) ?? toNumOrNull(currentB3.daily),
      hasLinkRow: Boolean(dailyRow),
    });
  }

  return targets;
}

/** Cào 1 target: fetch -> bóc data-value -> so sánh với giá trị cũ. */
async function scrapeTarget(target: B3Target): Promise<TargetResult> {
  try {
    const html = await fetchSourceHtml(target.url, FETCH_TIMEOUT_MS);
    const value = extractDataValue(html);
    if (value === null) {
      return {
        target,
        status: "error",
        newValue: null,
        error: `Không tìm thấy data-value tại ${target.url}`,
      };
    }
    if (target.prevValue !== null && value === target.prevValue) {
      return { target, status: "unchanged", newValue: value };
    }
    return { target, status: "changed", newValue: value };
  } catch (err) {
    return {
      target,
      status: "error",
      newValue: null,
      error: errorMessage(err, `Lỗi cào ${target.url}`),
    };
  }
}

/** Pool song song có giới hạn + hạn chót (bounded work cho serverless 60s). */
async function runPool<T>(
  items: T[],
  concurrency: number,
  deadlineAt: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const size = Math.max(1, Math.min(concurrency, items.length));

  const run = async (): Promise<void> => {
    while (cursor < items.length) {
      if (Date.now() > deadlineAt) return;
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: size }, () => run()));
}

/**
 * Ghi kết quả vào DB cho một dashboard:
 *  - mode "cron" : CHỈ ghi khi có giá trị THAY ĐỔI.
 *  - mode "manual": ghi khi cào thành công (>= 1 số đọc được) — kể cả khi
 *                   giá trị chưa đổi (nút do Admin bấm tay).
 *  - UPDATE metric_links.current_value (nếu dòng link đã tồn tại).
 *  - UPDATE dashboards.b3 qua CỘNG DỒN LŨY KẾ + mirror metadata đủ 5 mốc
 *    (bắt buộc, vì dashboard-detail ghi đè b3 bằng metadata).
 *  - INSERT kpi_revenue_history (lỗi bảng history KHÔNG làm hỏng luồng cào).
 */
async function persistDashboard(
  admin: ReturnType<typeof import("@/lib/supabase").getSupabaseAdmin>,
  dash: DashboardLite,
  results: TargetResult[],
  mode: "cron" | "manual",
  warnings: string[]
): Promise<{ changed: number; historySaved: boolean }> {
  const changedResults = results.filter((r) => r.status === "changed");
  const okResults = results.filter((r) => r.status !== "error");

  const shouldWrite = mode === "manual" ? okResults.length > 0 : changedResults.length > 0;
  if (!shouldWrite) return { changed: 0, historySaved: false };

  // ===== KHỐI B3: CỘNG DỒN LŨY KẾ (thay vì ghi đè từng field) =====
  // `daily` sẽ tự reset theo kỳ và rót delta sang weekly/monthly/quarterly/yearly.
  let accumulatedB3 = normalizeB3(dash.b3);
  let appliedAnyChange = false;

  for (const r of changedResults) {
    if (r.newValue === null) continue;
    const applied = applyB3Revenue(accumulatedB3, r.target.field, r.newValue);
    accumulatedB3 = applied.b3;
    appliedAnyChange = true;
  }

  // 1) Cập nhật current_value trên các dòng metric_links đã thay đổi.
  for (const r of changedResults) {
    if (r.newValue === null || !r.target.hasLinkRow) continue;
    const { error } = await admin
      .from("metric_links")
      .update({ current_value: r.newValue })
      .eq("dashboard_id", r.target.dashboardId)
      .eq("metric_key", r.target.metricKey);
    if (error && warnings.length < MAX_WARNINGS) {
      warnings.push(`metric_links[${r.target.metricKey}]: ${error.message}`);
    }
  }

  // 2) Ghi cột JSONB `dashboards.b3` + mirror metadata cho CẢ 5 mốc.
  if (appliedAnyChange) {
    const meta = buildB3MetadataMirror(dash.metadata, accumulatedB3);

    const { error: upErr } = await admin
      .from("dashboards")
      .update({ b3: accumulatedB3, metadata: meta, updated_at: new Date().toISOString() })
      .eq("id", dash.id);

    if (upErr) {
      if (warnings.length < MAX_WARNINGS) warnings.push(`dashboards.b3: ${upErr.message}`);
      return { changed: 0, historySaved: false };
    }
  }

  // 3) INSERT 1 dòng lịch sử — BẮT BUỘC khi "Cào ngay"/"Làm mới" thành công
  //    hoặc cron thấy đổi. Ghi SAU khi cộng dồn để biểu đồ khớp 5 thẻ UI.
  let historySaved = false;
  try {
    const { error: histErr } = await admin.from(HISTORY_TABLE).insert({
      dashboard_id: dash.id,
      daily: toNum(accumulatedB3.daily),
      weekly: toNum(accumulatedB3.weekly),
      monthly: toNum(accumulatedB3.monthly),
      quarterly: toNum(accumulatedB3.quarterly),
      yearly: toNum(accumulatedB3.yearly),
      scraped_at: new Date().toISOString(),
    });
    if (histErr) {
      if (warnings.length < MAX_WARNINGS) {
        warnings.push(
          `${HISTORY_TABLE}: ${histErr.message} (kiểm tra đã chạy migration 0009 chưa)`
        );
      }
    } else {
      historySaved = true;
    }
  } catch (err) {
    if (warnings.length < MAX_WARNINGS) {
      warnings.push(
        `${HISTORY_TABLE}: ${errorMessage(err)} (kiểm tra đã chạy migration 0009 chưa)`
      );
    }
  }

  return { changed: changedResults.length, historySaved };
}

/**
 * Đọc toàn bộ metric_links b3_* một lần, group theo dashboard_id.
 * Trả về Map rỗng nếu lỗi (không làm sập endpoint).
 */
export async function loadLinksByDashboard(
  admin: ReturnType<typeof import("@/lib/supabase").getSupabaseAdmin>
): Promise<Map<string, MetricLinkLite[]>> {
  const { data, error } = await admin
    .from("metric_links")
    .select("dashboard_id, metric_key, target_url, current_value")
    .like("metric_key", "b3_%");

  const map = new Map<string, MetricLinkLite[]>();
  if (error || !data) return map;
  for (const row of data as MetricLinkLite[]) {
    const key = String(row.metric_key ?? "");
    if (!key.startsWith("b3_") || !B3_FIELDS.includes(key.slice(3) as B3Field)) continue;
    const arr = map.get(row.dashboard_id) ?? [];
    arr.push(row);
    map.set(row.dashboard_id, arr);
  }
  return map;
}

/**
 * Hàm chính dùng chung: cào toàn bộ target rồi ghi theo từng dashboard.
 *
 * @param scopeProvinceUnitId Chỉ quét các xã thuộc Tỉnh này (dùng cho nút
 *        "Làm mới doanh thu" ở Dashboard TỈNH). Bỏ trống = quét toàn bộ.
 */
export async function processDashboards(
  admin: ReturnType<typeof import("@/lib/supabase").getSupabaseAdmin>,
  dashboards: DashboardLite[],
  linksByDashboard: Map<string, MetricLinkLite[]>,
  mode: "cron" | "manual",
  scopeProvinceUnitId?: string | null
): Promise<ScanSummary> {
  const startedAt = Date.now();
  const deadlineAt = startedAt + DEADLINE_MS;
  const warnings: string[] = [];

  // 1) Dựng danh sách target (bỏ qua PROVINCE — Tỉnh cộng dồn phía client).
  const dashById = new Map<string, DashboardLite>();
  const targets: B3Target[] = [];

  // Nếu có phạm vi Tỉnh -> lấy danh sách unit con (chỉ lần đầu).
  let childUnitIds: string[] | null = null;
  if (scopeProvinceUnitId) {
    const { data: children } = await admin
      .from("administrative_units")
      .select("id")
      .eq("parent_id", scopeProvinceUnitId);
    childUnitIds = (children ?? []).map((u: { id: string }) => u.id);
    if (childUnitIds.length === 0) childUnitIds = ["__none__"];
  }

  for (const dash of dashboards) {
    if (dash.unit?.type === "PROVINCE") continue;
    if (childUnitIds && (!dash.unit_id || !childUnitIds.includes(dash.unit_id))) continue;
    const dashTargets = buildTargets(dash, linksByDashboard.get(dash.id) ?? []);
    if (dashTargets.length === 0) continue;
    dashById.set(dash.id, dash);
    targets.push(...dashTargets);
  }

  // 2) Cào song song (bounded).
  const results: (TargetResult | undefined)[] = new Array<TargetResult | undefined>(
    targets.length
  );
  await runPool(targets, DEFAULT_CONCURRENCY, deadlineAt, async (target, index) => {
    results[index] = await scrapeTarget(target);
  });

  const skipped = results.filter((r) => r === undefined).length;
  const settled = results.filter((r): r is TargetResult => r !== undefined);

  let changed = 0;
  let unchanged = 0;
  let errors = 0;
  for (const r of settled) {
    if (r.status === "changed") changed += 1;
    else if (r.status === "unchanged") unchanged += 1;
    else errors += 1;
  }

  // 3) Gom kết quả theo dashboard để ghi DB.
  const byDash = new Map<string, TargetResult[]>();
  for (const r of settled) {
    const arr = byDash.get(r.target.dashboardId) ?? [];
    arr.push(r);
    byDash.set(r.target.dashboardId, arr);
  }

  let historySaved = 0;
  for (const [dashId, dashResults] of byDash) {
    const dash = dashById.get(dashId);
    if (!dash) continue;
    const persisted = await persistDashboard(admin, dash, dashResults, mode, warnings);
    if (persisted.historySaved) historySaved += 1;
  }

  return {
    dashboards: dashById.size,
    scanned: settled.length,
    changed,
    unchanged,
    errors,
    historySaved,
    skipped,
    warnings,
    results: settled.slice(0, 100),
    durationMs: Date.now() - startedAt,
  };
}