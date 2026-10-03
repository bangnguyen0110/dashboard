import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorMessage } from "@/lib/server-utils";
import { requireAdmin } from "@/lib/admin-session";
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
 * API: /api/v1/metrics/sync-all-b3  —  MASS SYNC DOANH THU (nút Tỉnh)
 * ============================================================================
 *
 * Nút "🔄 Làm mới doanh thu" trên Dashboard TỈNH (Admin bấm tay): quét lại toàn
 * bộ xã/phường thuộc Tỉnh, cào `data-value` từ web nguồn, áp dụng CỘNG DỒN
 * LŨY KẾ và ghi lịch sử — giống hệt luồng cron, chỉ khác là do USER trigger.
 *
 * DRY: toàn bộ logic cào + bóc tách + delta nằm trong service
 * `lib/b3-scraper.ts`, dùng chung với `/api/v1/metrics/cron-b3`.
 *
 * QUYỀN: bắt buộc phiên Admin hợp lệ (cookie httpOnly ký HMAC, xem
 * `lib/admin-session.ts`) + kiểm tra same-origin. Không nhận URL từ request
 * (chống SSRF) — chỉ cào URL đã lưu trong DB.
 *
 * Body (tuỳ chọn): { provinceUnitId } — giới hạn phạm vi 1 tỉnh. Bỏ trống = toàn bộ.
 * ============================================================================
 */

// Nhận `Request` (NextRequest là subtype) để khớp chữ ký với lib/admin-session.
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

export async function POST(req: NextRequest) {
  try {
    // 0) Chặn truy cập trái phép TRƯỚC khi đụng tới DB.
    const auth = await requireAdmin(isSameOrigin, req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const provinceUnitId = body.provinceUnitId
      ? String(body.provinceUnitId).trim()
      : "";

    const admin = getSupabaseAdmin();

    // 1) Lấy toàn bộ dashboard cấp XÃ/PHƯỜNG (service tự loại PROVINCE).
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

    // 2) Cào song song (pool + deadline) theo CØNG DỒN LŨY KẾ, rồi ghi lịch sử.
    const summary = await processDashboards(
      admin,
      (dashRows ?? []) as unknown as DashboardLite[],
      linksByDashboard,
      "manual", // Admin bấm tay -> ghi cả khi số chưa đổi (đồng bộ lịch sử)
      provinceUnitId || null
    );

    if (summary.scanned === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Không tìm thấy xã/phường nào đã thiết lập link cào doanh thu B3.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Đã đồng bộ doanh thu toàn tỉnh",
      trigger: "manual-province",
      ...summary,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: errorMessage(err, "Lỗi đồng bộ doanh thu toàn tỉnh") },
      { status: 500 }
    );
  }
}