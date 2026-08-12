import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * CORS headers cho phép website khác gửi request lên endpoint này.
 * Access-Control-Allow-Headers: * -> cho phép cả header X-API-KEY (preflight).
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

type SyncRow = Record<string, unknown>;

interface SyncPayload {
  /** Array bản ghi cho bảng kpi_business_units (hỗ trợ cả camelCase) */
  business_units?: SyncRow[];
  businessUnits?: SyncRow[];
  /** Array bản ghi cho bảng kpi_products */
  products?: SyncRow[];
}

function withCors(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

/** Ghi trace log vào bảng sync_logs (không làm hỏng luồng chính nếu lỗi) */
async function logSync(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dashboardId: string,
  status: "success" | "error",
  message: string,
  payload: unknown,
) {
  try {
    await supabase.from("sync_logs").insert({
      dashboard_id: dashboardId,
      status,
      message,
      payload: payload ?? null,
    });
  } catch {
    // Bỏ qua lỗi ghi log
  }
}

/** Trả lời CORS preflight trước khi trình duyệt gửi POST thật */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Đọc và kiểm tra X-API-KEY
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return withCors({ success: false, error: "Missing X-API-KEY header" }, 401);
    }

    const supabase = getSupabaseAdmin();

    const { data: dashboard, error: lookupError } = await supabase
      .from("dashboards")
      .select("id")
      .eq("api_key", apiKey)
      .maybeSingle();

    if (lookupError) {
      return withCors(
        { success: false, error: "Failed to validate API key" },
        500,
      );
    }

    if (!dashboard) {
      return withCors({ success: false, error: "Invalid API key" }, 401);
    }

    // 2. Đọc payload JSON từ body
    let payload: SyncPayload;
    try {
      payload = (await request.json()) as SyncPayload;
    } catch {
      await logSync(supabase, dashboard.id, "error", "Invalid JSON body", null);
      return withCors({ success: false, error: "Invalid JSON body" }, 400);
    }

    const businessUnits = payload.business_units ?? payload.businessUnits ?? [];
    const products = payload.products ?? [];

    if (businessUnits.length === 0 && products.length === 0) {
      await logSync(
        supabase,
        dashboard.id,
        "error",
        "Payload contains no business_units / products",
        payload,
      );
      return withCors(
        {
          success: false,
          error:
            "Payload must include non-empty business_units and/or products arrays",
        },
        400,
      );
    }

    // 3. Insert dữ liệu KPI
    let businessUnitCount = 0;
    let productCount = 0;

    if (businessUnits.length > 0) {
      const { data, error } = await supabase
        .from("kpi_business_units")
        .insert(
          businessUnits.map((row) => ({ ...row, dashboard_id: dashboard.id })),
        )
        .select();

      if (error) {
        await logSync(supabase, dashboard.id, "error", error.message, payload);
        return withCors(
          {
            success: false,
            error: "Failed to insert kpi_business_units",
            details: error.message,
          },
          500,
        );
      }
      businessUnitCount = data?.length ?? 0;
    }

    if (products.length > 0) {
      const { data, error } = await supabase
        .from("kpi_products")
        .insert(
          products.map((row) => ({ ...row, dashboard_id: dashboard.id })),
        )
        .select();

      if (error) {
        await logSync(supabase, dashboard.id, "error", error.message, payload);
        return withCors(
          {
            success: false,
            error: "Failed to insert kpi_products",
            details: error.message,
          },
          500,
        );
      }
      productCount = data?.length ?? 0;
    }

    // 4. Ghi trace log thành công
    await logSync(
      supabase,
      dashboard.id,
      "success",
      `Imported ${businessUnitCount} business unit(s) and ${productCount} product(s)`,
      payload,
    );

    return withCors(
      {
        success: true,
        message: "Data synced successfully",
        business_units_synced: businessUnitCount,
        products_synced: productCount,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withCors(
      { success: false, error: "Unexpected server error", details: message },
      500,
    );
  }
}