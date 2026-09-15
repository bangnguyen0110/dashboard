import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  KPI_HISTORY_TABLE,
  isMissingKpiHistoryError,
} from "@/lib/kpi-history";
import {
  runKpiHistorySnapshot,
  type KpiHistorySnapshotOptions,
} from "@/lib/kpi-history-server";

/**
 * API ĐỘC LẬP chốt mốc lịch sử KPI (Historical Snapshot).
 *
 * ⚠️ AN TOÀN HỆ THỐNG:
 * - Route này KHÔNG thuộc luồng cào web (refresh-all / cron-sync / sync-*) và
 *   KHÔNG sửa chúng. Chạy độc lập, có thể gọi bằng cron riêng (Vercel Cron) hoặc
 *   gọi thủ công sau khi đồng bộ.
 * - Chỉ ĐỌC các bảng KPI hiện có và GHI vào bảng riêng `kpi_history`
 *   (migration 0006) — không ALTER, không đụng khóa chính bảng nào.
 * - Bảo mật giống `cron-sync`: nếu đặt CRON_SECRET thì phải gửi header
 *   `x-cron-secret` khớp (Vercel Cron được thông qua qua header `x-vercel-cron`).
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || process.env.CRON_JOB_SECRET || "";

function authorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return (req.headers.get("x-cron-secret") || "") === CRON_SECRET;
}

function parseOptions(raw: unknown): KpiHistorySnapshotOptions {
  if (!raw || typeof raw !== "object") return { all: true, source: "api" };
  const body = raw as Record<string, unknown>;
  const options: KpiHistorySnapshotOptions = { source: "api" };
  if (Array.isArray(body.dashboardIds)) {
    options.dashboardIds = body.dashboardIds.filter((id): id is string => typeof id === "string");
  }
  if (Array.isArray(body.unitIds)) {
    options.unitIds = body.unitIds.filter((id): id is string => typeof id === "string");
  }
  if (typeof body.period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.period)) {
    options.period = body.period;
  }
  if (typeof body.source === "string" && body.source.trim()) options.source = body.source.trim();
  if (typeof body.limit === "number" && Number.isFinite(body.limit)) options.limit = body.limit;
  if (body.writeEvents === false) options.writeEvents = false;
  if (
    !options.dashboardIds?.length &&
    !options.unitIds?.length &&
    body.all !== false
  ) {
    options.all = true;
  }
  return options;
}

/** Chạy chốt mốc (POST thủ công hoặc script ngoài). */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: "Forbidden: sai CRON_SECRET" }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const result = await runKpiHistorySnapshot(parseOptions(body));
  return NextResponse.json(
    { success: result.ok, ...result },
    { status: result.missingTable ? 503 : 200 }
  );
}

/**
 * GET: mặc định CHẠY chốt mốc (dành cho Vercel Cron — nền tảng chỉ gửi GET).
 * Dùng `?mode=status` để chỉ xem thống kê kho lịch sử (không ghi gì).
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: "Forbidden: sai CRON_SECRET" }, { status: 403 });
  }

  const mode = new URL(req.url).searchParams.get("mode");

  if (mode === "status") {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from(KPI_HISTORY_TABLE)
        .select("period_month, captured_at")
        .order("period_month", { ascending: false })
        .limit(5000);
      if (error) {
        const missingTable = isMissingKpiHistoryError(error);
        return NextResponse.json(
          {
            success: false,
            missingTable,
            error: missingTable
              ? "Bảng kpi_history chưa tồn tại — hãy chạy migration 0006_kpi_history.sql."
              : error.message,
          },
          { status: missingTable ? 503 : 500 }
        );
      }
      const rows = (data ?? []) as Array<{ period_month: string; captured_at: string | null }>;
      const periods = new Map<string, { count: number; lastCapturedAt: string | null }>();
      for (const row of rows) {
        const entry = periods.get(row.period_month) ?? { count: 0, lastCapturedAt: null };
        entry.count += 1;
        if (!entry.lastCapturedAt || (row.captured_at ?? "") > entry.lastCapturedAt) {
          entry.lastCapturedAt = row.captured_at;
        }
        periods.set(row.period_month, entry);
      }
      return NextResponse.json({
        success: true,
        missingTable: false,
        totalRows: rows.length,
        periods: Array.from(periods.entries()).map(([period, value]) => ({
          period,
          count: value.count,
          lastCapturedAt: value.lastCapturedAt,
        })),
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  }

  const result = await runKpiHistorySnapshot({ all: true, source: "cron" });
  return NextResponse.json(
    { success: result.ok, ...result },
    { status: result.missingTable ? 503 : 200 }
  );
}