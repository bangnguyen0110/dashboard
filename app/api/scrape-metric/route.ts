import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

function extractNumberFromContent(content: string): number | null {
  try {
    const parsedJson = JSON.parse(content);
    if (typeof parsedJson === "number") return parsedJson;
    if (typeof parsedJson === "object" && parsedJson !== null) {
      const candidates = ["value", "total", "count", "quantity", "so_luong", "tong", "data", "result"];
      for (const k of candidates) {
        if (typeof parsedJson[k] === "number") return parsedJson[k];
        if (typeof parsedJson[k] === "string" && !isNaN(Number(parsedJson[k]))) {
          return Number(parsedJson[k]);
        }
      }
      if (Array.isArray(parsedJson.data)) return parsedJson.data.length;
      if (Array.isArray(parsedJson)) return parsedJson.length;
    }
  } catch {
    // Không phải JSON, xử lý HTML
  }

  const regexPatterns = [
    /<(?:span|div|b|strong|p|h\d)[^>]*class="[^"]*(?:count|total|stat|number|value|qty|badge|highlight)[^"]*"[^>]*>\s*([\d.,]+)\s*<\//i,
    /<(?:span|div|b|strong|p|h\d)[^>]*id="[^"]*(?:count|total|stat|number|value|qty)[^"]*"[^>]*>\s*([\d.,]+)\s*<\//i,
    /<meta\s+property="[^"]*(?:count|total|value)[^"]*"\s+content="([\d.,]+)"/i,
    /(?:Tổng|Số lượng|Hiện có|Đã có)\s*:\s*([\d.,]+)/i,
  ];

  for (const regex of regexPatterns) {
    const match = content.match(regex);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/,/g, "").replace(/\.(?=\d{3})/g, "");
      const val = parseFloat(cleanNum);
      if (!isNaN(val)) return val;
    }
  }

  const strippedText = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const fallbackMatch = strippedText.match(/(\b\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\b|\b\d+\b)/);
  if (fallbackMatch && fallbackMatch[1]) {
    const cleanNum = fallbackMatch[1].replace(/,/g, "").replace(/\.(?=\d{3})/g, "");
    const val = parseFloat(cleanNum);
    if (!isNaN(val)) return val;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url, targetUrl, metricKey, dashboardId } = await req.json();
    const finalUrl = (targetUrl || url || "").trim();

    if (!finalUrl) {
      return NextResponse.json({ success: false, error: "URL không hợp lệ" }, { status: 400 });
    }

    const response = await fetch(finalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[SCRAPE ERROR] Không thể kết nối URL: ${finalUrl} (Status: ${response.status})`);
      return NextResponse.json(
        { success: false, error: `Không thể kết nối đến URL (${response.status})` },
        { status: 502 }
      );
    }

    const htmlContent = await response.text();
    const extractedValue = extractNumberFromContent(htmlContent);

    console.log(`\n--- [SCRAPE LOG] ---`);
    console.log(`🔗 URL: ${finalUrl}`);
    console.log(`🔑 MetricKey: ${metricKey} | DashboardId: ${dashboardId}`);
    console.log(`📊 Giá trị bóc tách được:`, extractedValue);
    console.log(`--------------------\n`);

    if (extractedValue === null) {
      return NextResponse.json({
        success: false,
        error: "Không bóc tách được số liệu từ trang đích",
        extractedValue: null,
      });
    }

    // GHI HOẶC CẬP NHẬT VÀO DATABASE BẰNG UPSERT
    if (dashboardId && metricKey) {
      const prefix = metricKey.split("_")[0];
      const nowIso = new Date().toISOString();

      // TẦNG 2, 3, 4, 5
      if (prefix === "l2" || prefix === "l3" || prefix === "l4" || prefix === "l5") {
        const col =
          prefix === "l2" ? "level2" : prefix === "l3" ? "level3" : prefix === "l4" ? "level4" : "level5";
        const shortField = metricKey.replace(`${prefix}_`, "");

        const { data: dash } = await supabase
          .from("dashboards")
          .select(`${col}, metadata`)
          .eq("id", dashboardId)
          .single();

        const currentData = (dash as any)?.[col] || (dash as any)?.metadata?.[col] || {};
        currentData[metricKey] = extractedValue;
        currentData[shortField] = extractedValue;

        const { error: updateColErr } = await supabase
          .from("dashboards")
          .update({ [col]: currentData })
          .eq("id", dashboardId);

        if (updateColErr) {
          const meta = (dash as any)?.metadata || {};
          meta[col] = currentData;
          await supabase.from("dashboards").update({ metadata: meta }).eq("id", dashboardId);
        }
      }
      // KHỐI B3 -> B9
      else if (["b3", "b4", "b5", "b6", "b7", "b8", "b9"].includes(prefix)) {
        const fieldName = metricKey.replace(`${prefix}_`, "");
        const { data: dash } = await supabase.from("dashboards").select(prefix).eq("id", dashboardId).single();
        const currentData = (dash as any)?.[prefix] || {};
        currentData[fieldName] = extractedValue;

        await supabase.from("dashboards").update({ [prefix]: currentData }).eq("id", dashboardId);
      }
      // KHỐI B1 (Sử dụng upsert để đảm bảo tạo mới nếu chưa có dòng dữ liệu)
      else if (prefix === "b1") {
        const b1FieldMap: Record<string, string[]> = {
          b1_sme_total: ["sme_total"],
          b1_hkd_total: ["hkd_total"],
          b1_htx_total: ["htx_total"],
          b1_sme_dx: ["sme_dx", "sme_cds"],
          b1_hkd_dx: ["hkd_dx", "hkd_cds"],
          b1_htx_dx: ["htx_dx", "htx_cds"],
        };
        const fields = b1FieldMap[metricKey] || [];
        if (fields.length > 0) {
          const updateObj: Record<string, any> = { dashboard_id: dashboardId, updated_at: nowIso };
          fields.forEach((f) => (updateObj[f] = extractedValue));
          
          await supabase.from("kpi_business_units").upsert(updateObj, { onConflict: "dashboard_id" });
        }
      }
      // KHỐI B2 (Sử dụng upsert)
      else if (prefix === "b2") {
        const b2FieldMap: Record<string, string> = {
          b2_ocop_3: "ocop_3star",
          b2_ocop_4: "ocop_4star",
          b2_ocop_5: "ocop_5star",
          b2_sp_thuong: "sp_thuong",
          b2_dich_vu: "dich_vu",
        };
        const field = b2FieldMap[metricKey];
        if (field) {
          await supabase.from("kpi_products").upsert({
            dashboard_id: dashboardId,
            [field]: extractedValue,
            updated_at: nowIso,
          }, { onConflict: "dashboard_id" });
        }
      }
    }

    return NextResponse.json({
      success: true,
      value: extractedValue,
      url: finalUrl,
    });
  } catch (error: any) {
    console.error(`[SCRAPE CRITICAL ERROR]:`, error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi xử lý bóc tách số liệu" },
      { status: 500 }
    );
  }
}