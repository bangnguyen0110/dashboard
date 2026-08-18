import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/server-utils';

/**
 * Xóa Dashboard Tỉnh kèm toàn bộ Dashboard Xã/Phường trực thuộc.
 *
 * Cấu trúc dữ liệu hiện tại dùng một bảng `dashboards` duy nhất, liên kết
 * Tỉnh - Xã qua bảng `administrative_units` (cột `parent_id`). Do đó handler
 * sẽ xóa theo chuỗi: Dashboard Tỉnh -> Dashboard của các Xã/Phường thuộc Tỉnh.
 *
 * Các bảng con (kpi_business_units, kpi_products, metric_links, sync_logs)
 * được dọn tự động nhờ ràng buộc ON DELETE CASCADE trong DB (xem migration
 * supabase/migrations).
 */
export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: 'Thiếu id Dashboard Tỉnh' }, { status: 400 });
    }

    // 1. Lấy Dashboard Tỉnh cần xóa
    const { data: provinceDash, error: provErr } = await supabaseAdmin
      .from('dashboards')
      .select('id, unit_id')
      .eq('id', id)
      .maybeSingle();

    if (provErr) throw provErr;
    if (!provinceDash) {
      return NextResponse.json({ error: 'Không tìm thấy Dashboard Tỉnh' }, { status: 404 });
    }

    // 2. Tìm tất cả đơn vị Xã/Phường thuộc Tỉnh (administrative_units.parent_id)
    const { data: communeUnits } = await supabaseAdmin
      .from('administrative_units')
      .select('id')
      .eq('parent_id', provinceDash.unit_id);

    const communeUnitIds = communeUnits?.map((unit) => unit.id) ?? [];

    // 3. Tìm các Dashboard Xã/Phường tương ứng
    let dashboardIds: string[] = [provinceDash.id];
    if (communeUnitIds.length > 0) {
      const { data: communeDashboards } = await supabaseAdmin
        .from('dashboards')
        .select('id')
        .in('unit_id', communeUnitIds);

      dashboardIds = [
        ...dashboardIds,
        ...(communeDashboards?.map((dash) => dash.id) ?? []),
      ];
    }

    // 4. Xóa tất cả trong một lần (bảng con tự dọn nhờ CASCADE)
    const { error: deleteErr } = await supabaseAdmin
      .from('dashboards')
      .delete()
      .in('id', dashboardIds);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({
      success: true,
      message: `Đã xóa Dashboard Tỉnh và ${dashboardIds.length - 1} Dashboard Xã/Phường trực thuộc`,
    });
    } catch (error: unknown) {
    console.error('Lỗi delete-province:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Lỗi xóa Dashboard Tỉnh') },
      { status: 500 }
    );
  }
}