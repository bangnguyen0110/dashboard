import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

// 🌟 Hàm tự động đồng bộ cộng dồn lên Dashboard Tỉnh ngay sau khi xã thay đổi số liệu
async function syncProvinceDirectly() {
  try {
    const { data: provDash } = await supabase
      .from("dashboards")
      .select("id, unit_id")
      .or("is_province.eq.true,level.eq.province")
      .limit(1)
      .maybeSingle();

    if (!provDash) return;

    let communeDashboardIds: string[] = [];
    if (provDash.unit_id) {
      const { data: childUnits } = await supabase
        .from("administrative_units")
        .select("id")
        .eq("parent_id", provDash.unit_id);

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
        .neq("id", provDash.id);
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
      totalOcop3 += Number(row.ocop_3star || 0);
      totalOcop4 += Number(row.ocop_4star || 0);
      totalOcop5 += Number(row.ocop_5star || 0);
      totalSpThuong += Number(row.sp_thuong || 0);
      totalDichVu += Number(row.dich_vu || 0);
    });

    const nowIso = new Date().toISOString();

    const [{ data: provB1 }, { data: provB2 }] = await Promise.all([
      supabase.from("kpi_business_units").select("*").eq("dashboard_id", provDash.id).maybeSingle(),
      supabase.from("kpi_products").select("*").eq("dashboard_id", provDash.id).maybeSingle(),
    ]);

    const provinceB1Update = { dashboard_id: provDash.id, updated_at: nowIso, ...(provB1 || {}) };
    provinceB1Update.sme_total = totalSme;
    provinceB1Update.hkd_total = totalHkd;
    provinceB1Update.htx_total = totalHtx;
    provinceB1Update.sme_dx = totalSmeDx;
    provinceB1Update.hkd_dx = totalHkdDx;
    provinceB1Update.htx_dx = totalHtxDx;
    delete (provinceB1Update as any).created_at;

    const provinceB2Update = { dashboard_id: provDash.id, updated_at: nowIso, ...(provB2 || {}) };
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
  } catch (err) {}
}

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, section, field, fields, value } = await req.json();

    if (!dashboardId || !field) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId hoặc field" }, { status: 400 });
    }

    const numValue = Number(value) || 0;
    const sec = (section || "").toUpperCase();

    // TẦNG 2, 3, 4, 5
    if (
      sec === "L2" || sec === "L3" || sec === "L4" || sec === "L5" ||
      sec === "LEVEL2" || sec === "LEVEL3" || sec === "LEVEL4" || sec === "LEVEL5"
    ) {
      const col = sec.includes("2")
        ? "level2"
        : sec.includes("3")
        ? "level3"
        : sec.includes("4")
        ? "level4"
        : "level5";

      const prefix = sec.includes("2")
        ? "l2_"
        : sec.includes("3")
        ? "l3_"
        : sec.includes("4")
        ? "l4_"
        : "l5_";

      const { data: dash } = await supabase.from("dashboards").select(`${col}, metadata`).eq("id", dashboardId).single();
      const currentData = (dash as any)?.[col] || (dash as any)?.metadata?.[col] || {};

      currentData[field] = numValue;
      currentData[`${prefix}${field}`] = numValue;

      const { error: updateColErr } = await supabase
        .from("dashboards")
        .update({ [col]: currentData })
        .eq("id", dashboardId);

      if (updateColErr) {
        const meta = (dash as any)?.metadata || {};
        meta[col] = currentData;
        await supabase.from("dashboards").update({ metadata: meta }).eq("id", dashboardId);
      }

      await syncProvinceDirectly();
      return NextResponse.json({ success: true, value: numValue });
    }

    // KHỐI B3 -> B9
    if (["B3", "B4", "B5", "B6", "B7", "B8", "B9"].includes(sec)) {
      const col = sec.toLowerCase();
      const { data: dash } = await supabase.from("dashboards").select(col).eq("id", dashboardId).single();
      const currentData = (dash as any)?.[col] || {};
      currentData[field] = numValue;

      const { error } = await supabase.from("dashboards").update({ [col]: currentData }).eq("id", dashboardId);
      if (error) throw error;

      await syncProvinceDirectly();
      return NextResponse.json({ success: true, value: numValue });
    }

    // KHỐI B1 (Sử dụng UPSERT thay vì UPDATE để tránh lỗi thiếu bản ghi)
    if (sec === "B1") {
      const updateFields = fields && fields.length > 0 ? fields : [field];
      const updateObj: Record<string, any> = { dashboard_id: dashboardId };
      updateFields.forEach((f: string) => (updateObj[f] = numValue));

      const { error } = await supabase
        .from("kpi_business_units")
        .upsert(updateObj, { onConflict: "dashboard_id" });
      
      if (error) throw error;

      await syncProvinceDirectly();
      return NextResponse.json({ success: true, value: numValue });
    }

    // KHỐI B2 (Sử dụng UPSERT thay vì UPDATE)
    if (sec === "B2") {
      const updateObj = { dashboard_id: dashboardId, [field]: numValue };
      const { error } = await supabase
        .from("kpi_products")
        .upsert(updateObj, { onConflict: "dashboard_id" });
      
      if (error) throw error;

      await syncProvinceDirectly();
      return NextResponse.json({ success: true, value: numValue });
    }

    await syncProvinceDirectly();
    return NextResponse.json({ success: true, value: numValue });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Lỗi cập nhật số liệu" }, { status: 500 });
  }
}