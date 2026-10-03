import { NextRequest, NextResponse } from "next/server";
import { runRevenueScrape } from "@/lib/revenue-scraper";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * API: /api/v1/revenue/scrape
 * ----------------------------------------------------------------------------
 * Kích hoạt LUỒNG CÀO (PULL) doanh thu: đọc URL đã thiết lập → cào thẻ
 * `<p class="chuxanh tongtienthu" data-value>` → so sánh số cũ → nếu đổi thì
 * ghi số mới (trigger 0007 tự ghi lịch sử + cộng dồn tỉnh → Realtime phát đi).
 *
 *  GET  (cron/worker)  -> cào TẤT CẢ nguồn đang bật. Cần CRON_SECRET nếu đã set
 *                         (giống /api/v1/metrics/cron-sync).
 *  POST { maXa }       -> cào MỘT xã (dùng cho nút "Cào ngay" trên Dashboard).
 *                         Chấp nhận khi cùng origin (không lộ secret ra client).
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
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: sai CRON_SECRET" },
      { status: 403 }
    );
  }

  try {
    const summary = await runRevenueScrape();
    return NextResponse.json({ success: true, trigger: "cron", ...summary });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Lỗi cào dữ liệu" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req) && !isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: không có quyền kích hoạt cào dữ liệu" },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const maXa = body.maXa ? String(body.maXa).trim() : null;

    if (!maXa) {
      return NextResponse.json(
        { success: false, error: "Thiếu maXa để cào" },
        { status: 400 }
      );
    }

    const summary = await runRevenueScrape({ maXa });
    return NextResponse.json({ success: true, trigger: "manual", maXa, ...summary });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Lỗi cào dữ liệu" },
      { status: 500 }
    );
  }
}