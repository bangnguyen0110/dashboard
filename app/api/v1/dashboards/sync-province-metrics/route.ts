import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

function getValidUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

// Hàm trích xuất số từ nội dung HTML/JSON
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
  } catch {}

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

// 🌟 Hàm cào dữ liệu mới từ web nguồn cho từng xã/phường
async function refreshSingleCommune(communeDashboardId: string) {
  try {
    const { data: links } = await supabase
      .from("metric_links")
      .select("metric_key, target_url")
      .eq("dashboard_id", communeDashboardId);

    if (!links || links.length === 0) return;

    const nowIso = new Date().toISOString();

    for (const item of links) {
      const finalUrl = getValidUrl(item.target_url);
      if (!finalUrl) continue;

      try {
        const response = await fetch(finalUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
          },
          cache: "no-store",
        });

        if (!response.ok) continue;

        const htmlContent = await response.text();
        const extractedValue = extractNumberFromContent(htmlContent);

        if (extractedValue !== null) {
          await supabase
            .from("metric_links")
            .update({ current_value: extractedValue, target_url: finalUrl })
            .eq("dashboard_id", communeDashboardId)
            .eq("metric_key", item.metric_key);

          const metricKey = item.metric_key;
          const prefix = metricKey.split("_")[0];

          if (prefix === "b1") {
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
              const updateObj: Record<string, any> = { dashboard_id: communeDashboardId, updated_at: nowIso };
              fields.forEach((f) => (updateObj[f] = extractedValue));
              await supabase.from("kpi_business_units").upsert(updateObj, { onConflict: "dashboard_id" });
            }
          } else if (prefix === "b2") {
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
                dashboard_id: communeDashboardId,
                [field]: extractedValue,
                updated_at: nowIso,
              }, { onConflict: "dashboard_id" });
            }
          }
        }
      } catch (err) {
        // Bỏ qua lỗi từng link lẻ
      }
    }
  } catch (err) {
    // Bỏ qua lỗi từng xã lẻ
  }
}

export async function POST(req: NextRequest) {
  try {
    const { communeDashboardId, provinceDashboardId } = await req.json();

    let targetProvinceId = provinceDashboardId;

    if (!targetProvinceId && communeDashboardId) {
      const { data: communeDash } = await supabase
        .from("dashboards")
        .select("unit_id, unit:administrative_units(parent_id)")
        .eq("id", communeDashboardId)
        .single();

      const parentUnitId = (communeDash?.unit as any)?.parent_id;
      if (parentUnitId) {
        const { data: provDash } = await supabase
          .from("dashboards")
          .select("id")
          .eq("unit_id", parentUnitId)
          .maybeSingle();
        if (provDash) targetProvinceId = provDash.id;
      }
    }

    if (!targetProvinceId && communeDashboardId) {
      targetProvinceId = communeDashboardId;
    }

    if (!targetProvinceId) {
      return NextResponse.json({ success: false, error: "Không xác định được Dashboard Tỉnh mục tiêu" }, { status: 400 });
    }

    const { data: provinceDash } = await supabase
      .from("dashboards")
      .select("unit_id, metadata")
      .eq("id", targetProvinceId)
      .single();

    if (!provinceDash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy thông tin Tỉnh trong cơ sở dữ liệu" }, { status: 404 });
    }

    const provinceUnitId = provinceDash.unit_id;

    const { data: childUnits } = await supabase
      .from("administrative_units")
      .select("id")
      .eq("parent_id", provinceUnitId);

    const childUnitIds = childUnits?.map((u) => u.id) ?? [];
    let targetCommuneDashIds: string[] = [];

    if (childUnitIds.length > 0) {
      const { data: matchedDashboards } = await supabase
        .from("dashboards")
        .select("id")
        .in("unit_id", childUnitIds);
      targetCommuneDashIds = matchedDashboards?.map((d) => d.id) ?? [];
    }

    if (targetCommuneDashIds.length === 0) {
      const { data: allDash } = await supabase
        .from("dashboards")
        .select("id")
        .neq("id", targetProvinceId);
      targetCommuneDashIds = allDash?.map((d) => d.id) ?? [];
    }

    if (targetCommuneDashIds.length === 0) {
      return NextResponse.json({ success: true, message: "Không tìm thấy dữ liệu xã/phường để tổng hợp." });
    }

    // 🌟 BƯỚC QUAN TRỌNG: Cào dữ liệu mới từ web nguồn cho toàn bộ các xã theo lô (10 xã/lần)
    const CHUNK_SIZE = 10;
    for (let i = 0; i < targetCommuneDashIds.length; i += CHUNK_SIZE) {
      const chunk = targetCommuneDashIds.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map((id) => refreshSingleCommune(id)));
    }

    // Sau khi đã cào mới xong, tiến hành lấy dữ liệu B1 & B2 mới nhất từ database xã
    const [{ data: b1All }, { data: b2All }] = await Promise.all([
      supabase.from("kpi_business_units").select("*").in("dashboard_id", targetCommuneDashIds),
      supabase.from("kpi_products").select("*").in("dashboard_id", targetCommuneDashIds),
    ]);

    let totalSme = 0, totalHkd = 0, totalHtx = 0;
    let totalSmeDx = 0, totalHkdDx = 0, totalHtxDx = 0;
    let ocop3 = 0, ocop4 = 0, ocop5 = 0, spThuong = 0, dichVu = 0;

    (b1All || []).forEach((row: any) => {
      totalSme += Number(row.sme_total || 0);
      totalHkd += Number(row.hkd_total || 0);
      totalHtx += Number(row.htx_total || 0);
      totalSmeDx += Number(row.sme_dx || row.sme_cds || 0);
      totalHkdDx += Number(row.hkd_dx || row.hkd_cds || 0);
      totalHtxDx += Number(row.htx_dx || row.htx_cds || 0);
    });

    (b2All || []).forEach((row: any) => {
      ocop3 += Number(row.ocop_3star || row.ocop_3 || 0);
      ocop4 += Number(row.ocop_4star || row.ocop_4 || 0);
      ocop5 += Number(row.ocop_5star || row.ocop_5 || 0);
      spThuong += Number(row.sp_thuong || 0);
      dichVu += Number(row.dich_vu || 0);
    });

    const nowIso = new Date().toISOString();

    const b1Payload = {
      dashboard_id: targetProvinceId,
      sme_total: totalSme,
      hkd_total: totalHkd,
      htx_total: totalHtx,
      sme_dx: totalSmeDx,
      hkd_dx: totalHkdDx,
      htx_dx: totalHtxDx,
      updated_at: nowIso,
    };

    const b2Payload = {
      dashboard_id: targetProvinceId,
      ocop_3star: ocop3,
      ocop_4star: ocop4,
      ocop_5star: ocop5,
      sp_thuong: spThuong,
      dich_vu: dichVu,
      updated_at: nowIso,
    };

    await Promise.all([
      supabase.from("kpi_business_units").upsert(b1Payload, { onConflict: "dashboard_id" }),
      supabase.from("kpi_products").upsert(b2Payload, { onConflict: "dashboard_id" }),
    ]);

    const meta = { ...(provinceDash.metadata || {}), last_sync_at: nowIso };
    await supabase
      .from("dashboards")
      .update({ updated_at: nowIso, metadata: meta })
      .eq("id", targetProvinceId);

    return NextResponse.json({
      success: true,
      message: `Đã cào mới và tổng hợp thành công số liệu từ ${targetCommuneDashIds.length} cơ sở lên Tỉnh!`,
      totals: { totalSme, totalHkd, totalHtx }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}