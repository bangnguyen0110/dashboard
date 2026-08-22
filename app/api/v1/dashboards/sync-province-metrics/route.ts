import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const { communeDashboardId, provinceDashboardId } = await req.json();

    let targetProvinceId = provinceDashboardId;

    // Trường hợp gọi từ xã, tìm ra ID tỉnh cha trực thuộc
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

    // Nếu vẫn không tìm thấy targetProvinceId, thử quét xem đây có phải là dashboard cấp Tỉnh không
    if (!targetProvinceId && communeDashboardId) {
      targetProvinceId = communeDashboardId;
    }

    if (!targetProvinceId) {
      return NextResponse.json({ success: false, error: "Không xác định được Dashboard Tỉnh mục tiêu" }, { status: 400 });
    }

    // 1. Lấy thông tin đơn vị hành chính của Tỉnh
    const { data: provinceDash } = await supabase
      .from("dashboards")
      .select("unit_id")
      .eq("id", targetProvinceId)
      .single();

    if (!provinceDash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy thông tin Tỉnh trong cơ sở dữ liệu" }, { status: 404 });
    }

    const provinceUnitId = provinceDash.unit_id;

    // 2. Lấy toàn bộ danh sách các đơn vị hành chính con (xã/phường/huyện trực thuộc) có parent_id là tỉnh này
    const { data: childUnits } = await supabase
      .from("administrative_units")
      .select("id")
      .eq("parent_id", provinceUnitId);

    const childUnitIds = childUnits?.map((u) => u.id) ?? [];
    
    // Nếu tỉnh này không có đơn vị con theo parent_id, lấy toàn bộ dashboard xã có trong cùng hệ thống để phòng hờ dữ liệu test
    let targetCommuneDashIds: string[] = [];

    if (childUnitIds.length > 0) {
      const { data: matchedDashboards } = await supabase
        .from("dashboards")
        .select("id")
        .in("unit_id", childUnitIds);
      targetCommuneDashIds = matchedDashboards?.map((d) => d.id) ?? [];
    }

    // Nếu không tìm thấy qua quan hệ parent_id, lấy tất cả các dashboard khác dashboard tỉnh hiện tại
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

    // 3. Lấy dữ liệu B1 (kinh tế số) và B2 (OCOP) của tất cả các đơn vị xã/phường
    const [{ data: b1All }, { data: b2All }] = await Promise.all([
      supabase.from("kpi_business_units").select("*").in("dashboard_id", targetCommuneDashIds),
      supabase.from("kpi_products").select("*").in("dashboard_id", targetCommuneDashIds),
    ]);

    // 4. Thực hiện tính tổng (SUM) toàn bộ thông số
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

    // 5. Ghi đè hoặc tạo mới dữ liệu tổng hợp vào bảng KPI của Tỉnh
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

    if (provB1?.id) {
      await supabase.from("kpi_business_units").update(b1Payload).eq("id", provB1.id);
    } else {
      await supabase.from("kpi_business_units").insert([b1Payload]);
    }

    if (provB2?.id) {
      await supabase.from("kpi_products").update(b2Payload).eq("id", provB2.id);
    } else {
      await supabase.from("kpi_products").insert([b2Payload]);
    }

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ thành công dữ liệu từ ${targetCommuneDashIds.length} cơ sở lên Tỉnh!`,
      totals: { totalSme, totalHkd, totalHtx }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}