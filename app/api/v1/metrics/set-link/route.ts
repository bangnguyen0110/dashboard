import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dashboardId, metricKey, targetUrl, metricId } = body;

    if (!dashboardId || !metricKey) {
      return NextResponse.json(
        { error: "Thiếu dashboardId hoặc metricKey" },
        { status: 400 }
      );
    }

    // Upsert vào bảng metric_links (dựa trên dashboard_id và metric_key)
    const { data, error } = await supabase
      .from("metric_links")
      .upsert(
        {
          dashboard_id: dashboardId,
          metric_key: metricKey,
          target_url: targetUrl || "",
          metric_id: metricId || "",
        },
        { onConflict: "dashboard_id,metric_key" }
      )
      .select()
      .single();

    if (error) {
      console.error("❌ Lỗi Supabase tại set-link:", error);
      return NextResponse.json(
        { error: error.message || "Không thể lưu vào bảng metric_links" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("❌ Lỗi API set-link:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi xử lý yêu cầu phía máy chủ" },
      { status: 500 }
    );
  }
}