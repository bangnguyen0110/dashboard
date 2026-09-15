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
    const { dashboardId, customSyncUrl } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    // 1. Lấy thông tin dashboard Tỉnh kèm theo đơn vị hành chính
    const { data: provinceDash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !provinceDash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard Tỉnh" }, { status: 404 });
    }

    const provinceUnitId = provinceDash.unit_id;
    let communeDashboardIds: string[] = [];

    // 2. Lấy chính xác các xã/phường trực thuộc dựa trên quan hệ parent_id của administrative_units
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

    // Fallback dự phòng nếu chưa liên kết chuẩn unit_id
    if (communeDashboardIds.length === 0) {
      const { data: fallbackDash } = await supabase
        .from("dashboards")
        .select("id")
        .neq("id", dashboardId)
        .or("level.eq.commune,level.eq.xa");
      communeDashboardIds = fallbackDash?.map((d) => d.id) ?? [];
    }

    if (communeDashboardIds.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy xã/phường trực thuộc nào để tổng hợp!" }, { status: 400 });
    }

    // 3. Lấy đồng thời dữ liệu B1 và B2 của các xã/phường trực thuộc
    const [{ data: communeB1Rows }, { data: communeB2Rows }] = await Promise.all([
      supabase.from("kpi_business_units").select("*").in("dashboard_id", communeDashboardIds),
      supabase.from("kpi_products").select("*").in("dashboard_id", communeDashboardIds),
    ]);

    const b1ByCommune = new Map<string, any>();
    for (const row of (communeB1Rows || [])) {
      b1ByCommune.set(String(row.dashboard_id), row);
    }

    const b2ByCommune = new Map<string, any>();
    for (const row of (communeB2Rows || [])) {
      b2ByCommune.set(String(row.dashboard_id), row);
    }

    // 4. Tính tổng chính xác
    let sumSmeTotal = 0, sumHkdTotal = 0, sumHtxTotal = 0;
    let sumSmeDx = 0, sumHkdDx = 0, sumHtxDx = 0;
    let sumOcop3 = 0, sumOcop4 = 0, sumOcop5 = 0, sumSpThuong = 0, sumDichVu = 0;
    const aggregatedLevel2: Record<string, number> = {};

    for (const communeId of communeDashboardIds) {
      const b1Row = b1ByCommune.get(communeId) || {};
      sumSmeTotal += parseRobustNumber(b1Row.sme_total);
      sumHkdTotal += parseRobustNumber(b1Row.hkd_total);
      sumHtxTotal += parseRobustNumber(b1Row.htx_total);
      sumSmeDx += parseRobustNumber(b1Row.sme_dx ?? b1Row.sme_cds);
      sumHkdDx += parseRobustNumber(b1Row.hkd_dx ?? b1Row.hkd_cds);
      sumHtxDx += parseRobustNumber(b1Row.htx_dx ?? b1Row.htx_cds);

      const b2Row = b2ByCommune.get(communeId) || {};
      sumOcop3 += parseRobustNumber(b2Row.ocop_3star);
      sumOcop4 += parseRobustNumber(b2Row.ocop_4star);
      sumOcop5 += parseRobustNumber(b2Row.ocop_5star);
      sumSpThuong += parseRobustNumber(b2Row.sp_thuong);
      sumDichVu += parseRobustNumber(b2Row.dich_vu);
    }

    aggregatedLevel2["sme_total"] = sumSmeTotal;
    aggregatedLevel2["hkd_total"] = sumHkdTotal;
    aggregatedLevel2["htx_total"] = sumHtxTotal;
    aggregatedLevel2["sme_dx"] = sumSmeDx;
    aggregatedLevel2["hkd_dx"] = sumHkdDx;
    aggregatedLevel2["htx_dx"] = sumHtxDx;
    aggregatedLevel2["ocop_3star"] = sumOcop3;
    aggregatedLevel2["ocop_4star"] = sumOcop4;
    aggregatedLevel2["ocop_5star"] = sumOcop5;

    const nowIso = new Date().toISOString();

    // 5. Cập nhật an toàn bằng UPSERT thay vì DELETE để bảo toàn cấu trúc dữ liệu
    await Promise.all([
      supabase.from("kpi_business_units").upsert({
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
        updated_at: nowIso,
      }, { onConflict: "dashboard_id" }),

      supabase.from("kpi_products").upsert({
        dashboard_id: dashboardId,
        ocop_3star: sumOcop3,
        ocop_4star: sumOcop4,
        ocop_5star: sumOcop5,
        sp_thuong: sumSpThuong,
        dich_vu: sumDichVu,
        updated_at: nowIso,
      }, { onConflict: "dashboard_id" }),
    ]);

    const baseDomain = provinceDash.base_domain || provinceDash.domain_link || "kienhaiangiang.vn";
    const autoDefaultUrl = `https://${baseDomain.replace(/^https?:\/\//, "")}/tong-hop-xa-phuong-${provinceDash.id}`;
    const finalSyncUrl = (customSyncUrl ?? autoDefaultUrl).trim();

    const updatedMetadata = {
      ...(provinceDash.metadata || {}),
      sync_communes_url: finalSyncUrl,
      level2: aggregatedLevel2,
      last_sync_at: nowIso,
    };

    await supabase
      .from("dashboards")
      .update({
        level2: aggregatedLevel2,
        metadata: updatedMetadata,
        updated_at: nowIso,
      })
      .eq("id", dashboardId);

    const successMessage = 
      `✅ Đã tổng hợp thành công từ ${communeDashboardIds.length} xã/phường!\n` +
      `• Tổng SME: ${sumSmeTotal} (CĐS: ${sumSmeDx})\n` +
      `• Tổng Hộ KD: ${sumHkdTotal} (CĐS: ${sumHkdDx})\n` +
      `• Tổng HTX: ${sumHtxTotal} (CĐS: ${sumHtxDx})\n` +
      `• OCOP (3★: ${sumOcop3} | 4★: ${sumOcop4} | 5★: ${sumOcop5})`;

    return NextResponse.json({
      success: true,
      message: successMessage,
      updatedCount: communeDashboardIds.length,
    });
  } catch (error: any) {
    console.error("Lỗi sync-from-communes:", error);
    return NextResponse.json({ success: false, error: error.message || "Lỗi tổng hợp số liệu từ xã phường" }, { status: 500 });
  }
}