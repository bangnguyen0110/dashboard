import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// 🌟 HÀM GIẢI QUYẾT VÀ GHÉP NỐI URL THÔNG MINH (HỖ TRỢ CẢ ID VÀ ĐƯỜNG DẪN NGẮN)
async function getResolvedUrl(communeDashboardId: string, rawUrl: string): Promise<string | null> {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const { data: dash } = await supabase
    .from("dashboards")
    .select("base_domain, domain_link, metadata, unit_id, unit:administrative_units(*)")
    .eq("id", communeDashboardId)
    .maybeSingle();

  let base = (
    dash?.base_domain ||
    dash?.metadata?.base_domain ||
    dash?.domain_link ||
    ""
  ).trim().replace(/\/+$/, "");

  const unitObj = Array.isArray((dash as any)?.unit) ? (dash as any).unit[0] : (dash as any)?.unit;

  if (!base && unitObj?.parent_id) {
    const { data: parentDash } = await supabase
      .from("dashboards")
      .select("base_domain, domain_link, metadata")
      .eq("unit_id", unitObj.parent_id)
      .maybeSingle();

    base = (
      parentDash?.base_domain ||
      parentDash?.metadata?.base_domain ||
      parentDash?.domain_link ||
      ""
    ).trim().replace(/\/+$/, "");
  }

  if (base) {
    if (!base.startsWith("http://") && !base.startsWith("https://")) {
      base = `https://${base}`;
    }
    return `${base}/${trimmed.replace(/^\/+/, "")}`;
  }

  return `https://${trimmed}`;
}

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
    /(?:Tổng|Số lượng|Hiện có|Đã có|SME|HKD|HTX)\s*[:\-]?\s*([\d.,]+)/i,
  ];

  for (const regex of regexPatterns) {
    const match = content.match(regex);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/,/g, "").replace(/\.(?=\d{3})/g, "");
      const val = parseFloat(cleanNum);
      if (!isNaN(val)) return val;
    }
  }

  return null;
}

// 🌟 Hàm cốt lõi tính tổng các xã và cập nhật lên Tỉnh
async function aggregateAndSyncToProvince(provinceDashboardId: string, provinceUnitId: string) {
  let communeDashboardIds: string[] = [];

  if (provinceUnitId) {
    const { data: childUnits } = await supabase
      .from("administrative_units")
      .select("id")
      .eq("parent_id", provinceUnitId);

    const unitIds = childUnits?.map((u) => u.id) ?? [];
    if (unitIds.length > 0) {
      const { data: cDashboards } = await supabase
        .from("dashboards")
        .select("id")
        .in("unit_id", unitIds);
      communeDashboardIds = cDashboards?.map((d) => d.id) ?? [];
    }
  }

  if (communeDashboardIds.length === 0) {
    const { data: fallbackDash } = await supabase
      .from("dashboards")
      .select("id")
      .neq("id", provinceDashboardId);
    communeDashboardIds = fallbackDash?.map((d) => d.id) ?? [];
  }

  if (communeDashboardIds.length === 0) return;

  const [{ data: b1Rows }, { data: b2Rows }] = await Promise.all([
    supabase.from("kpi_business_units").select("*").in("dashboard_id", communeDashboardIds),
    supabase.from("kpi_products").select("*").in("dashboard_id", communeDashboardIds),
  ]);

  let totalSme = 0, totalHkd = 0, totalHtx = 0;
  let totalSmeDx = 0, totalHkdDx = 0, totalHtxDx = 0;
  let totalOcop3 = 0, totalOcop4 = 0, totalOcop5 = 0;
  let totalSpThuong = 0, totalDichVu = 0;

  (b1Rows ?? []).forEach((row: any) => {
    totalSme += Number(row.sme_total || 0);
    totalHkd += Number(row.hkd_total || 0);
    totalHtx += Number(row.htx_total || 0);
    totalSmeDx += Number(row.sme_dx || row.sme_cds || 0);
    totalHkdDx += Number(row.hkd_dx || row.hkd_cds || 0);
    totalHtxDx += Number(row.htx_dx || row.htx_cds || 0);
  });

  (b2Rows ?? []).forEach((row: any) => {
    totalOcop3 += Number(row.ocop_3star || row.ocop_3 || 0);
    totalOcop4 += Number(row.ocop_4star || row.ocop_4 || 0);
    totalOcop5 += Number(row.ocop_5star || row.ocop_5 || 0);
    totalSpThuong += Number(row.sp_thuong || 0);
    totalDichVu += Number(row.dich_vu || 0);
  });

  const nowIso = new Date().toISOString();

  const [{ data: provB1 }, { data: provB2 }] = await Promise.all([
    supabase.from("kpi_business_units").select("*").eq("dashboard_id", provinceDashboardId).maybeSingle(),
    supabase.from("kpi_products").select("*").eq("dashboard_id", provinceDashboardId).maybeSingle(),
  ]);

  const provinceB1Update = { dashboard_id: provinceDashboardId, updated_at: nowIso, ...(provB1 || {}) };
  provinceB1Update.sme_total = totalSme;
  provinceB1Update.hkd_total = totalHkd;
  provinceB1Update.htx_total = totalHtx;
  provinceB1Update.sme_dx = totalSmeDx;
  provinceB1Update.hkd_dx = totalHkdDx;
  provinceB1Update.htx_dx = totalHtxDx;
  delete (provinceB1Update as any).created_at;

  const provinceB2Update = { dashboard_id: provinceDashboardId, updated_at: nowIso, ...(provB2 || {}) };
  provinceB2Update.ocop_3star = totalOcop3;
  provinceB2Update.ocop_4star = totalOcop4;
  provinceB2Update.ocop_5star = totalOcop5;
  provinceB2Update.sp_thuong = totalSpThuong;
  provinceB2Update.dich_vu = totalDichVu;
  delete (provinceB2Update as any).created_at;

  await Promise.all([
    supabase.from("kpi_business_units").upsert(provinceB1Update, { onConflict: "dashboard_id" }),
    supabase.from("kpi_products").upsert(provinceB2Update, { onConflict: "dashboard_id" }),
  ]);
}

// 🌟 Hàm tìm trực tiếp Dashboard Tỉnh và kích hoạt đồng bộ (bỏ qua phụ thuộc parent_id phức tạp)
async function syncProvinceDirectly() {
  const { data: provDash } = await supabase
    .from("dashboards")
    .select("id, unit_id")
    .or("is_province.eq.true,level.eq.province")
    .limit(1)
    .maybeSingle();

  if (provDash) {
    await aggregateAndSyncToProvince(provDash.id, provDash.unit_id);
  }
}

// Hàm cào dữ liệu cho một xã/phường cụ thể
async function scrapeAndSaveForCommune(communeDashboardId: string) {
  try {
    const { data: links } = await supabase
      .from("metric_links")
      .select("metric_key, target_url, current_value")
      .eq("dashboard_id", communeDashboardId);

    const nowIso = new Date().toISOString();

    const [{ data: existingB1 }, { data: existingB2 }] = await Promise.all([
      supabase.from("kpi_business_units").select("*").eq("dashboard_id", communeDashboardId).maybeSingle(),
      supabase.from("kpi_products").select("*").eq("dashboard_id", communeDashboardId).maybeSingle(),
    ]);

    const b1Updates: Record<string, any> = { dashboard_id: communeDashboardId, updated_at: nowIso, ...(existingB1 || {}) };
    const b2Updates: Record<string, any> = { dashboard_id: communeDashboardId, updated_at: nowIso, ...(existingB2 || {}) };

    if (links && links.length > 0) {
      for (const item of links) {
        const finalUrl = await getResolvedUrl(communeDashboardId, item.target_url);
        if (!finalUrl) continue;

        try {
          const response = await fetch(finalUrl, {
            signal: AbortSignal.timeout(4000),
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
            const metricKey = item.metric_key;
            const prefix = metricKey.split("_")[0];

            if (prefix === "b1") {
              const fieldName = metricKey.replace("b1_", "");
              const oldValue = Number(b1Updates[fieldName] || 0);
              if (oldValue > 10 && (extractedValue === 0 || extractedValue === 1)) {
                // Bỏ qua giá trị thấp bất thường
              } else {
                b1Updates[fieldName] = extractedValue;
                await supabase
                  .from("metric_links")
                  .update({ current_value: extractedValue, target_url: finalUrl })
                  .eq("dashboard_id", communeDashboardId)
                  .eq("metric_key", item.metric_key);
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
                b2Updates[field] = extractedValue;
                await supabase
                  .from("metric_links")
                  .update({ current_value: extractedValue, target_url: finalUrl })
                  .eq("dashboard_id", communeDashboardId)
                  .eq("metric_key", item.metric_key);
              }
            }
          }
        } catch (err) {}
      }
    }

    delete (b1Updates as any).created_at;
    delete (b2Updates as any).created_at;

    await Promise.all([
      supabase.from("kpi_business_units").upsert(b1Updates, { onConflict: "dashboard_id" }),
      supabase.from("kpi_products").upsert(b2Updates, { onConflict: "dashboard_id" }),
    ]);
  } catch (err) {}
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dashboardId = body.dashboardId;

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    const { data: dash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !dash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard" }, { status: 404 });
    }

    const isProvinceLevel =
      dash.is_province ||
      dash.level === "province" ||
      dash.unit?.type === "PROVINCE" ||
      (!dash.parent_id && dash.level !== "commune" && dash.level !== "district");

    const nowIso = new Date().toISOString();

    // 🌟 NẾU LÀ CẤP XÃ/PHƯỜNG: CÀO MỚI TẠI XÃ ĐÓ, SAU ĐÓ TỰ ĐỘNG ĐỒNG BỘ THẲNG LÊN TỈNH
    if (!isProvinceLevel) {
      await scrapeAndSaveForCommune(dashboardId);
      await syncProvinceDirectly(); // Gọi trực tiếp đồng bộ lên Tỉnh an toàn tuyệt đối
      
      const meta = { ...(dash.metadata || {}), last_sync_at: nowIso };
      await supabase
        .from("dashboards")
        .update({ metadata: meta, updated_at: nowIso })
        .eq("id", dashboardId);

      return NextResponse.json({
        success: true,
        message: "Đã cào mới số liệu xã và tự động cập nhật lên Dashboard Tỉnh!",
        syncedAt: nowIso,
      });
    }

    // 🌟 NẾU LÀ CẤP TỈNH: CÀO TOÀN BỘ XÃ RỒI TỔNG HỢP
    const provinceUnitId = dash.unit_id;
    let communeDashboardIds: string[] = [];

    if (provinceUnitId) {
      const { data: childUnits } = await supabase
        .from("administrative_units")
        .select("id")
        .eq("parent_id", provinceUnitId);

      const unitIds = childUnits?.map((u) => u.id) ?? [];
      if (unitIds.length > 0) {
        const { data: cDashboards } = await supabase
          .from("dashboards")
          .select("id")
          .in("unit_id", unitIds);
        communeDashboardIds = cDashboards?.map((d) => d.id) ?? [];
      }
    }

    if (communeDashboardIds.length === 0) {
      const { data: fallbackDash } = await supabase
        .from("dashboards")
        .select("id")
        .or(`parent_id.eq.${dashboardId},province_code.eq.${dash.province_code || dashboardId}`);
      communeDashboardIds = fallbackDash?.map((d) => d.id) ?? [];
    }

    if (communeDashboardIds.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy xã/phường trực thuộc!" }, { status: 400 });
    }

    const CHUNK_SIZE = 10;
    for (let i = 0; i < communeDashboardIds.length; i += CHUNK_SIZE) {
      const chunk = communeDashboardIds.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map((communeId) => scrapeAndSaveForCommune(communeId)));
    }

    await aggregateAndSyncToProvince(dashboardId, provinceUnitId);

    const meta = { ...(dash.metadata || {}), last_sync_at: nowIso };
    await supabase
      .from("dashboards")
      .update({ metadata: meta, updated_at: nowIso })
      .eq("id", dashboardId);

    return NextResponse.json({
      success: true,
      message: `Đã cào mới và đồng bộ thành công toàn bộ xã phường lên Tỉnh!`,
      syncedAt: nowIso,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}