import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const { provinceDashboardId, communeDashboardId } = await req.json();
    
    let targetProvinceId = provinceDashboardId;

    // Nếu gọi từ dashboard xã, tự động tìm ra ID dashboard của Tỉnh cấp trên
    if (!targetProvinceId && communeDashboardId) {
      const { data: communeDash } = await supabase
        .from("dashboards")
        .select("unit:administrative_units(parent_id)")
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

    if (!targetProvinceId) {
      return NextResponse.json({ success: false, error: "Không tìm thấy Dashboard Cấp Tỉnh tương ứng" }, { status: 400 });
    }

    // 1. Lấy thông tin đơn vị hành chính của Tỉnh
    const { data: provinceDash } = await supabase
      .from("dashboards")
      .select("unit_id")
      .eq("id", targetProvinceId)
      .single();

    if (!provinceDash) return NextResponse.json({ success: false, error: "Không tìm thấy tỉnh" }, { status: 404 });

    // 2. Lấy tất cả các xã trực thuộc tỉnh
    const { data: childUnits } = await supabase
      .from("administrative_units")
      .select("id")
      .eq("parent_id", provinceDash.unit_id);

    const communeUnitIds = childUnits?.map((u) => u.id) ?? [];
    if (communeUnitIds.length === 0) return NextResponse.json({ success: true });

    const { data: communeDashboards } = await supabase
      .from("dashboards")
      .select("id")
      .in("unit_id", communeUnitIds);

    const communeDashIds = communeDashboards?.map((d) => d.id) ?? [];
    if (communeDashIds.length === 0) return NextResponse.json({ success: true });

    // 3. Lấy dữ liệu B1 & B2 của tất cả các xã và tính tổng
    const [{ data: b1Communes }, { data: b2Communes }] = await Promise.all([
      supabase.from("kpi_business_units").select("*").in("dashboard_id", communeDashIds),
      supabase.from("kpi_products").select("*").in("dashboard_id", communeDashIds),
    ]);

    let totalSme = 0, totalHkd = 0, totalHtx = 0;
    let totalSmeDx = 0, totalHkdDx = 0, totalHtxDx = 0;
    let ocop3 = 0, ocop4 = 0, ocop5 = 0, spThuong = 0, dichVu = 0;

    (b1Communes || []).forEach((row: any) => {
      totalSme += Number(row.sme_total || 0);
      totalHkd += Number(row.hkd_total || 0);
      totalHtx += Number(row.htx_total || 0);
      totalSmeDx += Number(row.sme_dx || row.sme_cds || 0);
      totalHkdDx += Number(row.hkd_dx || row.hkd_cds || 0);
      totalHtxDx += Number(row.htx_dx || row.htx_cds || 0);
    });

    (b2Communes || []).forEach((row: any) => {
      ocop3 += Number(row.ocop_3star || 0);
      ocop4 += Number(row.ocop_4star || 0);
      ocop5 += Number(row.ocop_5star || 0);
      spThuong += Number(row.sp_thuong || 0);
      dichVu += Number(row.dich_vu || 0);
    });

    // 4. Cập nhật dữ liệu tổng hợp vào bảng KPI của Tỉnh
    const [{ data: provB1 }, { data: provB2 }] = await Promise.all([
      supabase.from("kpi_business_units").select("id").eq("dashboard_id", targetProvinceId).maybeSingle(),
      supabase.from("kpi_products").select("id").eq("dashboard_id", targetProvinceId).maybeSingle(),
    ]);

    const b1Payload = {
      dashboard_id: targetProvinceId,
      sme_total: totalSme,
      hkd_total: totalHkd,
      htx_total: totalHtx,
      sme_dx: totalSmeDx,
      hkd_dx: totalHkdDx,
      htx_dx: totalHtxDx,
    };

    const b2Payload = {
      dashboard_id: targetProvinceId,
      ocop_3star: ocop3,
      ocop_4star: ocop4,
      ocop_5star: ocop5,
      sp_thuong: spThuong,
      dich_vu: dichVu,
    };

    if (provB1?.id) await supabase.from("kpi_business_units").update(b1Payload).eq("id", provB1.id);
    else await supabase.from("kpi_business_units").insert([b1Payload]);

    if (provB2?.id) await supabase.from("kpi_products").update(b2Payload).eq("id", provB2.id);
    else await supabase.from("kpi_products").insert([b2Payload]);

    return NextResponse.json({ success: true, message: "Đã tự động đồng bộ số liệu lên Tỉnh thành công!" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}