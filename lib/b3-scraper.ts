import { errorMessage } from "@/lib/server-utils";
import { readRevenueSourceUrls } from "@/lib/revenue-sync";
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
 *   1. Dựng target từ MẢNG URL nguồn của xã (`settings.revenue.b3_urls` +
 *      `url_nguon` legacy + `metric_links.target_url`).
 *   2. `Promise.all` qua TOÀN BỘ URL -> bóc `data-value` từng trang
 *      -> CỘNG TỔNG thành một biến `total_scraped_value` duy nhất.
 *   3. So sánh với `metric_links.current_value` / `b3.last_raw_value`.
 *   4. UPDATE `dashboards.b3` theo thuật toán TIME-BASED ACCUMULATION
 *      (reset đúng kỳ theo GMT+7 + delta + cộng dồn — lib/b3-revenue).
 *   5. INSERT 1 dòng `kpi_revenue_history` (migration 0009).
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
  /** URL chính (dùng cho log / thông báo lỗi). */
  url: string;
  /**
   * TOÀN BỘ URL nguồn của xã/phường — API cào sẽ `Promise.all` qua mảng này,
   * bóc `data-value` từng trang rồi CỘNG TỔNG thành `total_scraped_value`.
   */
  urls: string[];
  /** `metric_links.current_value` (fallback: giá trị hiện tại trong cột b3). */
  prevValue: number | null;
  /** Dòng metric_links đã tồn tại (nếu không, chỉ ghi `dashboards.b3`). */
  hasLinkRow: boolean;
}

export interface TargetResult {
  target: B3Target;
  status: "changed" | "unchanged" | "error";
  /** `total_scraped_value` — tổng `data-value` từ mọi URL của target. */
  newValue: number | null;
  error?: string;
  /** Một số URL lỗi nhưng vẫn tổng hợp được URL thành công (không chặn luồng). */
  warnings?: string[];
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

/** Gộp + chuẩn hoá danh sách URL (thêm scheme, bỏ trùng, bỏ rỗng). */
function mergeUrls(
  ...groups: (ReadonlyArray<string | null | undefined> | null | undefined)[]
): string[] {
  const out: string[] = [];
  for (const group of groups) {
    for (const raw of group ?? []) {
      const url = normalizeSourceUrl(raw);
      if (url && !out.includes(url)) out.push(url);
    }
  }
  return out;
}

/**
 * Dựng danh sách target cào cho MỘT dashboard từ:
 *  1. `metric_links` có metric_key dạng b3_daily … b3_yearly + target_url;
 *     riêng thẻ `b3_daily` được GỘP thêm toàn bộ `settings.revenue.b3_urls`
 *     (mảng URL nguồn của xã) — cào song song rồi CỘNG TỔNG thành
 *     `total_scraped_value` (Yêu cầu 1).
 *  2. Fallback: mảng `settings.revenue.b3_urls` (modal "Thiết lập doanh thu",
 *     kèm `url_nguon` cũ) dùng cho thẻ b3_daily khi thẻ này CHƯA có link riêng.
 */
export function buildTargets(dash: DashboardLite, links: MetricLinkLite[]): B3Target[] {
  const targets: B3Target[] = [];
  const currentB3 = dash.b3 ?? {};
  const seenFields = new Set<B3Field>();

  // Toàn bộ URL nguồn của xã/phường (mảng cấu hình + URL legacy).
  const communeUrls = mergeUrls(readRevenueSourceUrls(dash));

  for (const link of links) {
    const key = String(link.metric_key ?? "");
    if (!key.startsWith("b3_")) continue;
    const field = key.slice(3) as B3Field;
    if (!B3_FIELDS.includes(field)) continue;

    const linkUrl = normalizeSourceUrl(link.target_url ?? "");
    // Thẻ daily: cào TOÀN BỘ URL của xã + URL riêng của link (nếu có) -> cộng tổng.
    const urls =
      field === "daily" ? mergeUrls(communeUrls, linkUrl ? [linkUrl] : []) : mergeUrls([linkUrl]);
    if (urls.length === 0) continue;

    // So sánh "đổi/không đổi" theo giá trị TRẦM đã cào (raw), không phải daily.
    const prevValue =
      field === "daily"
        ? toNumOrNull(currentB3.last_raw_value) ??
          toNumOrNull(link.current_value) ??
          toNumOrNull(currentB3[field])
        : toNumOrNull(link.current_value) ?? toNumOrNull(currentB3[field]);

    targets.push({
      dashboardId: dash.id,
      metricKey: key,
      field,
      url: urls[0],
      urls,
      prevValue,
      hasLinkRow: true,
    });
    seenFields.add(field);
  }

  // Mảng URL nguồn chung (Thiết lập doanh thu) -> thẻ "Doanh thu trong ngày"
  // nếu thẻ daily CHƯA có link riêng.
  if (communeUrls.length > 0 && !seenFields.has("daily")) {
    const dailyRow = links.find((l) => String(l.metric_key ?? "") === "b3_daily");
    targets.push({
      dashboardId: dash.id,
      metricKey: "b3_daily",
      field: "daily",
      url: communeUrls[0],
      urls: communeUrls,
      prevValue:
        toNumOrNull(currentB3.last_raw_value) ??
        toNumOrNull(dailyRow?.current_value) ??
        toNumOrNull(currentB3.daily),
      hasLinkRow: Boolean(dailyRow),
    });
  }

  return targets;
}

/**
 * Cào 1 target: `Promise.all` qua TOÀN BỘ `target.urls` -> bóc `data-value`
 * từng trang -> CỘNG TỔNG thành một biến `total_scraped_value` duy nhất.
 *
 * - Mọi URL đều lỗi -> status "error".
 * - Chỉ một số URL lỗi -> vẫn cộng tổng các URL thành công, lỗi lẻ được ghi
 *   vào `warnings` để hiện ở summary (không chặn luồng).
 */
export async function scrapeTarget(target: B3Target): Promise<TargetResult> {
  const urls = target.urls.length > 0 ? target.urls : target.url ? [target.url] : [];
  if (urls.length === 0) {
    return {
      target,
      status: "error",
      newValue: null,
      error: "Chưa cấu hình URL nguồn để cào",
    };
  }

  const settled = await Promise.all(
    urls.map(async (url) => {
      try {
        const html = await fetchSourceHtml(url, FETCH_TIMEOUT_MS);
        const value = extractDataValue(html);
        if (value === null) {
          return { url, value: null as number | null, error: `Không tìm thấy data-value tại ${url}` };
        }
        return { url, value, error: null as string | null };
      } catch (err) {
        return { url, value: null as number | null, error: errorMessage(err, `Lỗi cào ${url}`) };
      }
    })
  );

  const ok = settled.filter((r): r is { url: string; value: number; error: null } => r.value !== null);
  const failures = settled
    .filter((r): r is { url: string; value: null; error: string } => r.error !== null)
    .map((r) => r.error);

  if (ok.length === 0) {
    return {
      target,
      status: "error",
      newValue: null,
      error: failures.join("; ") || `Không đọc được data-value từ ${urls.length} URL`,
    };
  }

  // ===== total_scraped_value: CỘNG TỔNG `data-value` từ TẤT CẢ các trang =====
  const totalScrapedValue = ok.reduce((sum, r) => sum + r.value, 0);

  const result: TargetResult = {
    target,
    status:
      target.prevValue !== null && totalScrapedValue === target.prevValue ? "unchanged" : "changed",
    newValue: totalScrapedValue,
  };
  if (failures.length > 0) result.warnings = failures;
  return result;
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

  // ===== YÊU CẦU 2 — BƯỚC 1: FETCH OBJECT B3 HIỆN TẠI TỪ DB =====
  // Không dùng snapshot đọc lúc bắt đầu vòng quét: nếu có luồng khác vừa ghi
  // (push realtime / nhập tay) thì vẫn lấy bản MỚI NHẤT để cộng dồn.
  let freshB3: unknown = dash.b3;
  let freshMetadata: unknown = dash.metadata;
  try {
    const { data: freshRow } = await admin
      .from("dashboards")
      .select("b3, metadata")
      .eq("id", dash.id)
      .maybeSingle();
    if (freshRow) {
      const row = freshRow as { b3?: unknown; metadata?: unknown };
      if (row.b3 !== undefined && row.b3 !== null) freshB3 = row.b3;
      if (row.metadata !== undefined && row.metadata !== null) freshMetadata = row.metadata;
    }
  } catch (err) {
    if (warnings.length < MAX_WARNINGS) warnings.push(`dashboards.b3 (đọc lại): ${errorMessage(err)}`);
  }

  // ===== YÊU CẦU 2 — BƯỚC 2..5: RESET CHU KỲ + DELTA + CỘNG DỒN LŨY KẾ =====
  // `now` dùng chung cho cả lượt cào; applyB3Revenue tự quy về GMT+7 (dayjs).
  const now = new Date();
  let accumulatedB3 = normalizeB3(freshB3);

  // Cron: chỉ cộng khi giá trị THAY ĐỔI. Manual ("Cào ngay"/"Làm mới"): cộng
  // mọi kết quả đọc được — delta = 0 nếu chưa đổi, nhưng vẫn cập nhật
  // `last_updated` / reset đúng kỳ khi vừa sang ngày/tuần/tháng mới.
  const resultsToApply = mode === "manual" ? okResults : changedResults;
  for (const r of resultsToApply) {
    if (r.newValue === null) continue;
    const applied = applyB3Revenue(accumulatedB3, r.target.field, r.newValue, now);
    accumulatedB3 = applied.b3;
  }
  const appliedAnyChange = resultsToApply.some((r) => r.newValue !== null);

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

  // 2) Ghi cột JSONB `dashboards.b3` (kèm last_updated + last_raw_value) +
  //    mirror metadata cho CẢ 5 mốc.
  if (appliedAnyChange) {
    const meta = buildB3MetadataMirror(freshMetadata, accumulatedB3);

    const { error: upErr } = await admin
      .from("dashboards")
      .update({ b3: accumulatedB3, metadata: meta, updated_at: now.toISOString() })
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
      scraped_at: now.toISOString(),
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
    // Một số URL lỗi nhưng vẫn cộng tổng được URL thành công -> cảnh báo lẻ.
    for (const w of r.warnings ?? []) {
      if (warnings.length < MAX_WARNINGS) warnings.push(w);
    }
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