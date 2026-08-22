import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidUrl } from "@/lib/url-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { dashboardId } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    // Lấy toàn bộ link chỉ số đã lưu của dashboard
    const { data: links, error } = await supabase
      .from("metric_links")
      .select("metric_key, target_url")
      .eq("dashboard_id", dashboardId);

    if (error || !links || links.length === 0) {
      return NextResponse.json({ success: true, message: "Chưa có liên kết chỉ số nào để đồng bộ", updatedCount: 0 });
    }

    let successCount = 0;

    // Quét song song tất cả các link
    await Promise.all(
      links.map(async (item) => {
        // 🔒 Chuẩn hóa URL: luôn có http(s):// (dữ liệu cũ có thể thiếu tiền tố)
        const targetUrl = getValidUrl(item.target_url);
        if (targetUrl) {
          try {
            const res = await fetch(`${req.nextUrl.origin}/api/scrape-metric`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: targetUrl,
                targetUrl,
                metricKey: item.metric_key,
                dashboardId,
              }),
            });
            const data = await res.json();
            if (data.success) {
              successCount++;
              // Đồng bộ kèm giá trị vào metric_links để lần refetch sau lấy được số liệu
              if (typeof data.value === "number") {
                await supabase
                  .from("metric_links")
                  .update({ current_value: data.value, target_url: targetUrl })
                  .eq("dashboard_id", dashboardId)
                  .eq("metric_key", item.metric_key);
              }
            }
          } catch (e) {
            console.error(`Lỗi quét link ${item.metric_key}:`, e);
          }
        }
      })
    );

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ thành công ${successCount}/${links.length} chỉ số từ website!`,
      updatedCount: successCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi đồng bộ dữ liệu trực tiếp" },
      { status: 500 }
    );
  }
}