import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { dashboardId } = await req.json();
    if (!dashboardId) {
      return NextResponse.json({ error: "Thiếu dashboardId" }, { status: 400 });
    }

    // 1. Lấy danh sách link đã cài đặt của Dashboard
    const { data: metricLinks, error: linkErr } = await supabase
      .from("metric_links")
      .select("metric_key, target_url")
      .eq("dashboard_id", dashboardId);

    if (linkErr || !metricLinks || metricLinks.length === 0) {
      return NextResponse.json({ message: "Không có link liên kết cần quét", updated: {} });
    }

    // 2. Lấy dữ liệu hiện tại của Dashboard
    const { data: dash } = await supabase
      .from("dashboards")
      .select("b3, b4, b5, b6, b7, b8, b9")
      .eq("id", dashboardId)
      .single();

    const scrapeResults: Record<string, number> = {};

    // 3. Quét đồng thời tất cả URL với cache no-store
    await Promise.allSettled(
      metricLinks.map(async (item) => {
        if (!item.target_url) return;
        try {
          const targetUrl = item.target_url.startsWith("http") ? item.target_url : `https://${item.target_url}`;
          const res = await fetch(targetUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
            },
            cache: "no-store",
          });

          if (!res.ok) return;
          const html = await res.text();

          // Quét class padding10 chudo chudam hoặc cụm "Tổng: [số]"
          let extractedNum: number | null = null;
          const exactPattern = /<div[^>]*class=["'][^"']*padding10\s+chudo\s+chudam[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
          const flexPattern = /<div[^>]*class=["'][^"']*(?=.*\bpadding10\b)(?=.*\bchudo\b)(?=.*\bchudam\b)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
          const tongPattern = /Tổng\s*:\s*(\d[\d.,]*)/i;

          let match = html.match(exactPattern) || html.match(flexPattern);
          if (match && match[1]) {
            const numMatch = match[1].replace(/<[^>]*>/g, "").match(/\d[\d.,]*/);
            if (numMatch) extractedNum = parseInt(numMatch[0].replace(/[.,]/g, ""), 10);
          } else {
            const tMatch = html.match(tongPattern);
            if (tMatch && tMatch[1]) extractedNum = parseInt(tMatch[1].replace(/[.,]/g, ""), 10);
          }

          if (extractedNum !== null) {
            scrapeResults[item.metric_key] = extractedNum;
          }
        } catch (err) {
          console.error(`Lỗi cào URL ${item.target_url}:`, err);
        }
      })
    );

    // 4. Phân loại và cập nhật vào B1 -> B9
    const updatedSections: Record<string, any> = {
      b3: { ...(dash?.b3 || {}) },
      b4: { ...(dash?.b4 || {}) },
      b5: { ...(dash?.b5 || {}) },
      b6: { ...(dash?.b6 || {}) },
      b7: { ...(dash?.b7 || {}) },
      b8: { ...(dash?.b8 || {}) },
      b9: { ...(dash?.b9 || {}) },
    };

    for (const [key, val] of Object.entries(scrapeResults)) {
      const prefix = key.split("_")[0];
      const field = key.replace(`${prefix}_`, "");

      // Cập nhật B1 / B2
      if (prefix === "b1" || prefix === "b2") {
        await fetch(`${req.nextUrl.origin}/api/v1/metrics/update-value`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dashboardId,
            section: prefix.toUpperCase(),
            field,
            fields: [field],
            value: val,
          }),
        }).catch(() => null);
      } else if (updatedSections[prefix]) {
        // Cập nhật B3 -> B9
        updatedSections[prefix][field] = val;
      }
    }

    // Ghi các khối B3 -> B9 vào bảng dashboards
    await supabase.from("dashboards").update(updatedSections).eq("id", dashboardId);

    return NextResponse.json({
      success: true,
      scrapedValues: scrapeResults,
      message: `Đã đồng bộ trực tiếp ${Object.keys(scrapeResults).length} chỉ tiêu`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}