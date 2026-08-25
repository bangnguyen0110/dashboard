import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

function parseRobustNumber(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  const cleaned = str.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return 0;

  let normalized = cleaned;
  if (cleaned.includes(".") && cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = cleaned.replace(/\./g, "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = cleaned.replace(/,/g, "");
    } else {
      normalized = cleaned.replace(/,/g, ".");
    }
  }
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, customSyncUrl, resetIds } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    // 1. Lấy thông tin dashboard Tỉnh
    const { data: provinceDash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !provinceDash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard Tỉnh" }, { status: 404 });
    }

    // 2. Lấy toàn bộ danh sách xã/phường trực thuộc
    const { data: allDashboards, error: allErr } = await supabase
      .from("dashboards")
      .select("*");

    if (allErr || !allDashboards) {
      return NextResponse.json({ success: false, error: "Lỗi truy vấn cơ sở dữ liệu" }, { status: 500 });
    }

    let communeDashboards = allDashboards.filter(
      (d: any) => d.id !== dashboardId && !d.is_province
    );
    if (communeDashboards.length === 0) {
      communeDashboards = allDashboards.filter((d: any) => d.id !== dashboardId);
    }

    const communeIds = communeDashboards.map((c) => c.id);
    let communeB1Rows: any[] = [];
    if (communeIds.length > 0) {
      const { data: b1Data } = await supabase
        .from("kpi_business_units")
        .select("*")
        .in("dashboard_id", communeIds);
      communeB1Rows = b1Data || [];
    }

    // 3. Tính tổng sum chính xác từ xã/phường
    let sumSmeTotal = 0;
    let sumHkdTotal = 0;
    let sumHtxTotal = 0;
    let sumSmeDx = 0;
    let sumHkdDx = 0;
    let sumHtxDx = 0;
    const aggregatedLevel2: Record<string, number> = {};

    const b1ByCommune = new Map<string, any>();
    for (const row of communeB1Rows) {
      b1ByCommune.set(String(row.dashboard_id), row);
    }

    for (const commune of communeDashboards) {
      const b1Row = b1ByCommune.get(commune.id) || commune.kpi || commune.metadata?.kpi || {};
      
      sumSmeTotal += parseRobustNumber(b1Row.sme_total);
      sumHkdTotal += parseRobustNumber(b1Row.hkd_total);
      sumHtxTotal += parseRobustNumber(b1Row.htx_total);

      sumSmeDx += parseRobustNumber(b1Row.sme_dx ?? b1Row.sme_cds);
      sumHkdDx += parseRobustNumber(b1Row.hkd_dx ?? b1Row.hkd_cds);
      sumHtxDx += parseRobustNumber(b1Row.htx_dx ?? b1Row.htx_cds);
    }

    aggregatedLevel2["sme_total"] = sumSmeTotal;
    aggregatedLevel2["hkd_total"] = sumHkdTotal;
    aggregatedLevel2["htx_total"] = sumHtxTotal;
    aggregatedLevel2["sme_dx"] = sumSmeDx;
    aggregatedLevel2["hkd_dx"] = sumHkdDx;
    aggregatedLevel2["htx_dx"] = sumHtxDx;

    // 4. URL đồng bộ
    const baseDomain = provinceDash.base_domain || provinceDash.domain_link || "kienhaiangiang.vn";
    const autoDefaultUrl = `https://${baseDomain.replace(/^https?:\/\//, "")}/tong-hop-xa-phuong-${provinceDash.id}`;
    const finalSyncUrl = (customSyncUrl ?? autoDefaultUrl).trim();

    // 5. XÓA SẠCH HOÀN TOÀN BẢNG `metric_links` CỦA TỈNH
    await supabase
      .from("metric_links")
      .delete()
      .eq("dashboard_id", dashboardId);

    // 6. 🌟 XÓA SẠCH TOÀN BỘ CÁC BẢN GHI CŨ TRONG `kpi_business_units` CỦA TỈNH ĐỂ TRÁNH TRÙNG LẶP/LẤY NHẦM CŨ
    await supabase
      .from("kpi_business_units")
      .delete()
      .eq("dashboard_id", dashboardId);

    // Insert duy nhất bản ghi tổng mới chuẩn xác
    await supabase.from("kpi_business_units").insert({
      dashboard_id: dashboardId,
      sme_total: sumSmeTotal,
      hkd_total: sumHkdTotal,
      htx_total: sumHtxTotal,
      sme_dx: sumSmeDx,
      hkd_dx: sumHkdDx,
      htx_dx: sumHtxDx,
      sme_cds: sumSmeDx,
      hkd_cds: sumHkdDx,
      htx_cds: sumHtxDx,
    });

    // 7. LÀM SẠCH HOÀN TOÀN METADATA (Xóa sạch mọi rác ID và metrics cứng cũ gây đè dữ liệu)
    let updatedMetadata = {
      sync_communes_url: finalSyncUrl,
      level2: aggregatedLevel2,
    };

    await supabase
      .from("dashboards")
      .update({
        level2: aggregatedLevel2,
        metadata: updatedMetadata,
      })
      .eq("id", dashboardId);

    return NextResponse.json({
      success: true,
      message: `Đã dọn dẹp sạch sẽ dữ liệu cũ, tổng hợp và đồng bộ thành công số liệu tổng lên dashboard Tỉnh!`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}