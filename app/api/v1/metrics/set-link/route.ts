import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const cleanUrl = (targetUrl || "").trim();

    // 1. Lưu hoặc Cập nhật vào bảng metric_links (đã bỏ updated_at)
    const { error: upsertError } = await supabase.from("metric_links").upsert(
      {
        dashboard_id: dashboardId,
        metric_key: metricKey,
        target_url: cleanUrl,
        metric_id: metricId || cleanUrl.split("/").filter(Boolean).pop() || "",
      },
      { onConflict: "dashboard_id,metric_key" }
    );

    if (upsertError) {
      throw upsertError;
    }

    // 2. Tự động bóc tách số liệu trực tiếp trên Server nếu có URL
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

    return NextResponse.json({
      success: true,
      message:
        scrapedValue !== null
          ? `Đã lưu link & cập nhật số liệu: ${scrapedValue}`
          : "Đã lưu link thành công",
      targetUrl: cleanUrl,
      value: scrapedValue,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi lưu liên kết chỉ số" },
      { status: 500 }
    );
  }
}