import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  REVENUE_SOURCE_TABLE,
  SYNC_REVENUE_FUNCTION,
  type RevenueSourceSettings,
} from "@/lib/revenue-sync";

export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * API: /api/v1/revenue/source
 * ----------------------------------------------------------------------------
 * Quản lý CẤU HÌNH NGUỒN + SECRET TOKEN cho luồng "push doanh thu".
 *
 *  POST  { dashboardId, maXa, maTinh?, urlNguon? }
 *        -> sinh Secret Token (hoặc tái dùng), upsert bảng `nguon_dong_bo`,
 *           lưu cấu hình vào `dashboards.settings.revenue`,
 *           trả về { token, endpoint } để dán vào mã nhúng.
 *
 *  GET   ?dashboardId=...&reveal=1
 *        -> đọc lại cấu hình (token chỉ trả khi reveal=1 để hạn chế lộ).
 *
 * Dùng SERVICE ROLE (getSupabaseAdmin) nên ghi được vào bảng cấu hình token
 * (bảng này RLS chặn anon — xem migration 0007).
 * ============================================================================
 */

/** Sinh Secret Token 64 ký tự hex (32 byte ngẫu nhiên, CSPRNG). */
function generateSecretToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function endpointUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  return `${base}/functions/v1/${SYNC_REVENUE_FUNCTION}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const dashboardId = String(body.dashboardId ?? "").trim();
    const maXa = String(body.maXa ?? "").trim();
    const maTinh = body.maTinh ? String(body.maTinh).trim() : null;
    const urlNguon = body.urlNguon ? String(body.urlNguon).trim() : null;

    if (!dashboardId) {
      return NextResponse.json(
        { success: false, error: "Thiếu dashboardId" },
        { status: 400 }
      );
    }
    if (!maXa) {
      return NextResponse.json(
        { success: false, error: "Thiếu Mã Xã/Phường (maXa)" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1) Tái dùng token cũ nếu đã có (tránh phải nhúng lại vào website nguồn)
    const { data: existing } = await supabase
      .from(REVENUE_SOURCE_TABLE)
      .select("secret_token")
      .eq("ma_xa", maXa)
      .maybeSingle();

    const token =
      (existing?.secret_token as string | undefined) || generateSecretToken();

    // 2) Upsert cấu hình nguồn + token
    const { error: upsertError } = await supabase
      .from(REVENUE_SOURCE_TABLE)
      .upsert(
        {
          ma_xa: maXa,
          ma_tinh: maTinh,
          url_nguon: urlNguon,
          secret_token: token,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ma_xa" }
      );

    if (upsertError) {
      return NextResponse.json(
        { success: false, error: `Lỗi lưu nguồn đồng bộ: ${upsertError.message}` },
        { status: 500 }
      );
    }

    // 3) Lưu cấu hình vào dashboards.settings (merge, KHÔNG đè key khác)
    const { data: dash } = await supabase
      .from("dashboards")
      .select("settings")
      .eq("id", dashboardId)
      .maybeSingle();

    const currentSettings = (dash?.settings ?? {}) as Record<string, unknown>;
    const revenueSettings: RevenueSourceSettings = {
      ma_xa: maXa,
      ma_tinh: maTinh ?? undefined,
      url_nguon: urlNguon ?? undefined,
      token_hint: token.slice(-4),
      updated_at: new Date().toISOString(),
    };

    const { error: settingsError } = await supabase
      .from("dashboards")
      .update({ settings: { ...currentSettings, revenue: revenueSettings } })
      .eq("id", dashboardId);

    if (settingsError) {
      return NextResponse.json(
        { success: false, error: `Lỗi lưu cấu hình dashboard: ${settingsError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      maXa,
      maTinh,
      urlNguon,
      token,
      token_hint: token.slice(-4),
      endpoint: endpointUrl(),
      script_url: "/doanh-thu-sync.js",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi xử lý cấu hình doanh thu",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dashboardId = (searchParams.get("dashboardId") ?? "").trim();
    const reveal = searchParams.get("reveal") === "1";

    if (!dashboardId) {
      return NextResponse.json(
        { success: false, error: "Thiếu dashboardId" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: dash } = await supabase
      .from("dashboards")
      .select("settings")
      .eq("id", dashboardId)
      .maybeSingle();

    const settings = (dash?.settings ?? {}) as Record<string, unknown>;
    const revenue = (settings.revenue ?? {}) as RevenueSourceSettings;

    let token: string | null = null;
    if (reveal && revenue.ma_xa) {
      const { data: nguon } = await supabase
        .from(REVENUE_SOURCE_TABLE)
        .select("secret_token, active")
        .eq("ma_xa", revenue.ma_xa)
        .maybeSingle();
      token = (nguon?.secret_token as string | undefined) ?? null;
    }

    return NextResponse.json({
      success: true,
      revenue,
      endpoint: endpointUrl(),
      script_url: "/doanh-thu-sync.js",
      token,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi đọc cấu hình doanh thu",
      },
      { status: 500 }
    );
  }
}