import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidUrl } from "@/lib/url-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, metricKey, targetUrl, metricId } = await req.json();

    if (!dashboardId || !metricKey) {
      return NextResponse.json(
        { success: false, error: "Thiếu dashboardId hoặc metricKey" },
        { status: 400 }
      );
    }

    // 🔒 Chuẩn hóa URL: luôn có tiền tố http(s)://
    const cleanUrl = getValidUrl(targetUrl) ?? (targetUrl || "").trim();
    const cleanMetricId = metricId || cleanUrl.split("/").filter(Boolean).pop() || "";

    // 1. Tự động bóc tách số liệu trực tiếp trên Server trước
    let scrapedValue: number | null = null;
    if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      try {
        const scrapeResponse = await fetch(`${req.nextUrl.origin}/api/scrape-metric`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: cleanUrl,
            targetUrl: cleanUrl,
            metricKey,
            dashboardId,
          }),
        });

        const scrapeResult = await scrapeResponse.json();
        if (scrapeResult.success && typeof scrapeResult.value === "number") {
          scrapedValue = scrapeResult.value;
        }
      } catch (err) {
        console.warn("Không thể cào số liệu tức thì:", err);
      }
    }

    // 2. Gom chung payload lưu trữ đầy đủ các cột (có current_value và metric_id)
    const upsertPayload: any = {
      dashboard_id: dashboardId,
      metric_key: metricKey,
      target_url: cleanUrl,
      metric_id: cleanMetricId,
    };

    if (scrapedValue !== null) {
      upsertPayload.current_value = scrapedValue;
    }

    let savedLink: Record<string, unknown> | null = null;

    // Thực hiện upsert an toàn một lần duy nhất vào bảng metric_links kèm theo .select()
    const { data: upsertData, error: upsertError } = await supabase
      .from("metric_links")
      .upsert(upsertPayload, { onConflict: "dashboard_id,metric_key" })
      .select()
      .maybeSingle();

    if (upsertError) {
      console.warn("Upsert metric_links error:", upsertError.message);
    } else if (upsertData) {
      savedLink = upsertData as Record<string, unknown>;
    }

    // 3. ĐỒNG BỘ VÀO BẢNG dashboards (metadata) để đảm bảo hiển thị đúng số liệu
    if (scrapedValue !== null) {
      try {
        const { data: currentDash } = await supabase
          .from("dashboards")
          .select("metadata")
          .eq("id", dashboardId)
          .single();

        const currentMeta = (currentDash?.metadata as Record<string, any>) || {};
        const newMeta: Record<string, any> = {
          ...currentMeta,
          [metricKey]: scrapedValue,
          metrics: {
            ...(currentMeta.metrics || {}),
            [metricKey]: scrapedValue,
          },
          level2_metrics: {
            ...(currentMeta.level2_metrics || {}),
            [metricKey]: scrapedValue,
          },
          last_synced_at: new Date().toISOString(),
        };

        await supabase
          .from("dashboards")
          .update({ metadata: newMeta })
          .eq("id", dashboardId);

        // Đồng thời cập nhật cột trực tiếp nếu bảng dashboards có hỗ trợ
        await supabase
          .from("dashboards")
          .update({ [metricKey]: scrapedValue })
          .eq("id", dashboardId);
      } catch (dbErr) {
        console.warn("Cập nhật metadata dashboards warning:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message:
        scrapedValue !== null
          ? `Đã lưu link & cập nhật số liệu: ${scrapedValue}`
          : "Đã lưu link thành công",
      targetUrl: cleanUrl,
      value: scrapedValue,
      metricId: cleanMetricId,
      data: savedLink,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi lưu liên kết chỉ số" },
      { status: 500 }
    );
  }
}