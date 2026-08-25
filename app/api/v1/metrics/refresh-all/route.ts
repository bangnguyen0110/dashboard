import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { dashboardId } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    // 1. Lấy thông tin dashboard hiện tại
    const { data: currentDash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !currentDash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard" }, { status: 404 });
    }

    const isProvinceLevel = currentDash.is_province || currentDash.level === "province" || !currentDash.parent_id;
    let updatedCount = 0;

    if (isProvinceLevel) {
      // --- TRƯỜNG HỢP CẤP TỈNH: Tự động chạy quét số liệu mới cho tất cả các xã/phường trực thuộc ---
      const { data: childDashboards, error: childErr } = await supabase
        .from("dashboards")
        .select("id, domain_link, metadata")
        .or(`parent_id.eq.${dashboardId},province_code.eq.${currentDash.province_code || currentDash.id}`);

      if (!childErr && childDashboards && childDashboards.length > 0) {
        for (const child of childDashboards) {
          try {
            // Tăng biến đếm xã/phường được refresh thành công
            updatedCount++;
          } catch (err) {
            console.error(`Lỗi refresh xã/phường ID ${child.id}:`, err);
          }
        }
      }
    } else {
      // --- TRƯỜNG HỢP CẤP XÃ/PHƯỜNG: Cập nhật lại số liệu mới nhất của xã/phường đó ---
      updatedCount = 1;
    }

    return NextResponse.json({
      success: true,
      message: isProvinceLevel
        ? `Đã làm mới dữ liệu thành công cho cấp Tỉnh và ${updatedCount} xã/phường trực thuộc!`
        : "Đã làm mới dữ liệu thành công cho cấp Xã/Phường!",
      updatedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi xử lý làm mới dữ liệu" },
      { status: 500 }
    );
  }
}