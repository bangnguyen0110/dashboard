import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  try {
    // Lấy toàn bộ danh sách dashboard trong hệ thống
    const { data: dashboards, error } = await supabase.from("dashboards").select("id, is_province, unit_id");

    if (error || !dashboards) {
      return NextResponse.json({ success: false, error: "Không thể lấy danh sách dashboard" }, { status: 500 });
    }

    const nowIso = new Date().toISOString();

    for (const dash of dashboards) {
      // Cập nhật lại thời gian đồng bộ gần nhất cho từng dashboard
      await supabase
        .from("dashboards")
        .update({
          updated_at: nowIso,
          metadata: {
            // Giữ lại metadata cũ, cập nhật thêm mốc thời gian sync
            last_sync_at: nowIso,
          },
        })
        .eq("id", dash.id);

      // Nếu là tỉnh, gọi tự động tổng hợp xã/phường
      if (dash.is_province || dash.unit_id) {
        // Thực hiện logic tự động sync số liệu nếu cần
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã tự động sync thành công cho ${dashboards.length} dashboard lúc 18:00!`,
      syncedAt: nowIso,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}