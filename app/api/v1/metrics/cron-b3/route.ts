import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorMessage } from "@/lib/server-utils";
import { readRevenueSource } from "@/lib/revenue-sync";
import { runRevenueScrape } from "@/lib/revenue-scraper";
import {
  DASHBOARD_SELECT,
  loadLinksByDashboard,
  processDashboards,
  type DashboardLite,
} from "@/lib/b3-scraper";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * API: /api/v1/metrics/cron-b3  —  LUỒNG CÀO (PULL) DOANH THU KHỐI B3
 * ----------------------------------------------------------------------------
 * * Toàn bộ logic cào + bóc `data-value` + CỘNG DỒN LŨY KẾ + ghi lịch sử
 *   nằm trong service dùng chung `lib/b3-scraper.ts`, dùng chung với
 *   `/api/v1/metrics/sync-all-b3` (nút "Làm mới doanh thu" ở Dashboard Tỉnh).
 *
 *  GET  (cron/worker)  -> quét TOÀN BỘ link cấu hình của các XÃ/PHƯỜNG
 *                         (metric_links b3_* + settings.revenue.url_nguon).
 *                         Cần CRON_SECRET nếu đã set (x-cron-secret /
 *                         x-vercel-cron, giống cron-sync).
 *  POST { dashboardId } -> nút "⚡ Cào ngay" trên Dashboard Xã: cào 1 dashboard,
 *                         cập nhật tức thì cột `dashboards.b3` + best-effort
 *                         đồng bộ strip realtime (runRevenueScrape).
 * ============================================================================
 */

const CRON_SECRET = process.env.CRON_SECRET || process.env.CRON_JOB_SECRET || "";

/** Uỷ quyền kiểu cron: secret rỗng, header Vercel Cron, hoặc x-cron-secret đúng. */
function isCronAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return (req.headers.get("x-cron-secret") || "") === CRON_SECRET;
}

/** Chống kích hoạt chéo site cho nút bấm trên Dashboard (không cần lộ secret). */
function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** GET — cron tự động: quét TOÀN BỘ link cấu hình của các xã/phường. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: sai CRON_SECRET" },
      { status: 403 }
    );
  }

  try {
    const admin = getSupabaseAdmin();

    const [{ data: dashRows, error: dashErr }, linksByDashboard] = await Promise.all([
      admin.from("dashboards").select(DASHBOARD_SELECT),
      loadLinksByDashboard(admin),
    ]);

    if (dashErr) {
      return NextResponse.json(
        { success: false, error: `Không đọc được dashboards: ${dashErr.message}` },
        { status: 500 }
      );
    }

    const dashboards = (dashRows ?? []) as unknown as DashboardLite[];
    const summary = await processDashboards(admin, dashboards, linksByDashboard, "cron");

    return NextResponse.json({ success: true, trigger: "cron", ...summary });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: errorMessage(err, "Lỗi quét dữ liệu B3") },
      { status: 500 }
    );
  }
}

/** POST — nút "⚡ Cào ngay": cào 1 dashboard (chấp nhận request cùng origin). */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req) && !isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: không có quyền kích hoạt cào dữ liệu" },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const dashboardId = body.dashboardId ? String(body.dashboardId).trim() : "";
    if (!dashboardId) {
      return NextResponse.json(
        { success: false, error: "Thiếu dashboardId để cào" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: dash, error: dashErr } = await admin
      .from("dashboards")
      .select(DASHBOARD_SELECT)
      .eq("id", dashboardId)
      .maybeSingle();

    if (dashErr || !dash) {
      return NextResponse.json(
        { success: false, error: dashErr?.message || "Không tìm thấy dashboard" },
        { status: 404 }
      );
    }

    const dashRow = dash as unknown as DashboardLite;
    if (dashRow.unit?.type === "PROVINCE") {
      return NextResponse.json(
        {
          success: false,
          error: "Dashboard Tỉnh được cộng dồn tự động từ xã/phường — không cào trực tiếp.",
        },
        { status: 400 }
      );
    }

    const linksByDashboard = await loadLinksByDashboard(admin);
    const summary = await processDashboards(admin, [dashRow], linksByDashboard, "manual");

    // Best-effort: giữ luồng strip realtime cũ (doanh_thu_xa -> Realtime B3) chạy
    // song song khi Admin bấm "Cào ngay" (giống endpoint /api/v1/revenue/scrape).
    let strip: { scanned: number; changed: number; unchanged: number; errors: number } | null =
      null;
    try {
      const revenue = readRevenueSource(dashRow);
      const maXa = revenue.ma_xa || dashRow.unit?.code || dashRow.unit_id || "";
      if (maXa) {
        const r = await runRevenueScrape({ maXa });
        strip = {
          scanned: r.scanned,
          changed: r.changed,
          unchanged: r.unchanged,
          errors: r.errors,
        };
      }
    } catch {
      strip = null; // Không chặn luồng cào chính.
    }

    return NextResponse.json({
      success: true,
      trigger: "manual",
      dashboardId,
      ...summary,
      strip,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: errorMessage(err, "Lỗi cào dữ liệu B3") },
      { status: 500 }
    );
  }
}
