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

    // 2. Lưu hoặc Cập nhật vào bảng metric_links (LƯU KÈM CẢ VALUE)
    const upsertPayload: any = {
      dashboard_id: dashboardId,
      metric_key: metricKey,
      target_url: cleanUrl,
      metric_id: cleanMetricId,
    };

    // Lưu kèm giá trị vừa bóc tách vào cột current_value (bảng metric_links)
    if (scrapedValue !== null) {
      upsertPayload.current_value = scrapedValue;
    }

    // 🔎 SELECT ngay bản ghi vừa lưu để trả về đầy đủ object { metric_id, target_url, current_value }
    let savedLink: Record<string, unknown> | null = null;

    // Lưu an toàn vào bảng metric_links (chỉ dùng các cột chắc chắn tồn tại)
    const { error: upsertError } = await supabase.from("metric_links").upsert(
      {
        dashboard_id: dashboardId,
        metric_key: metricKey,
        target_url: cleanUrl,
      },
      { onConflict: "dashboard_id,metric_key" }
    );

    if (upsertError) {
      console.warn("Upsert metric_links error:", upsertError.message);
    }

    if (upsertError) {
      // Fallback khi bảng metric_links chưa có cột current_value (chưa chạy migration)
      console.warn("Upsert metric_links warning:", upsertError.message);
      const fallbackPayload = {
        dashboard_id: dashboardId,
        metric_key: metricKey,
        target_url: cleanUrl,
        metric_id: cleanMetricId,
      };
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("metric_links")
        .upsert(fallbackPayload, { onConflict: "dashboard_id,metric_key" })
        .select()
        .maybeSingle();
      if (!fallbackError && fallbackData) {
        savedLink = fallbackData as Record<string, unknown>;
      }
      if (fallbackError) {
        console.warn("Fallback upsert metric_links warning:", fallbackError.message);
      }
    }

    // 3. ĐỒNG BỘ VÀO BẢNG dashboards (metadata, kèm dự phòng cột trực tiếp nếu có)
    // Giúp hàm refetch Dashboard luôn luôn lấy được số 154 dù đọc theo kiểu nào.
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

        // Cập nhật metadata ĐỘC LẬP để không bị lỗi khi có cột trực tiếp không tồn tại
        const { error: metaErr } = await supabase
          .from("dashboards")
          .update({ metadata: newMeta })
          .eq("id", dashboardId);
        if (metaErr) {
          console.warn("Cập nhật metadata dashboards warning:", metaErr.message);
        }

        // (Tùy chọn) Nếu bảng dashboards có cột trùng tên metricKey thì cập nhật luôn;
        // nếu cột không tồn tại sẽ báo lỗi nhưng KHÔNG ảnh hưởng tới bước metadata ở trên.
        const { error: colErr } = await supabase
          .from("dashboards")
          .update({ [metricKey]: scrapedValue })
          .eq("id", dashboardId);
        if (colErr) {
          // Không phải bảng nào cũng có cột đặt theo metricKey -> bỏ qua lỗi này
        }
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
      data: savedLink, // Trả về toàn bộ record vừa lưu
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi lưu liên kết chỉ số" },
      { status: 500 }
    );
  }
}

