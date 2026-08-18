import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/server-utils';
import { recalculateProvinceMetrics } from '@/lib/province-sync';

/**
 * Sau khi lưu/cập nhật thông số cho một Dashboard, nếu Dashboard đó thuộc
 * Xã/Phường thì tự động cộng dồn số liệu của toàn tỉnh lên Dashboard Tỉnh.
 */
async function syncCommuneToProvince(dashboardId: string): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: dash } = await supabaseAdmin
      .from('dashboards')
      .select('unit:administrative_units(type, parent_id)')
      .eq('id', dashboardId)
      .maybeSingle();

    const unit = dash?.unit as
      | { type?: string; parent_id?: string | null }
      | undefined;

    if (unit?.type !== 'COMMUNE' || !unit.parent_id) return;
    await recalculateProvinceMetrics(unit.parent_id);
  } catch {
    // Không làm hỏng thao tác lưu gốc nếu việc đồng bộ tỉnh gặp lỗi.
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { dashboardId, section, field, fields, value } = body;

    // Danh sách cột cần ghi. LƯU Ý: chỉ ghi các cột đã xác minh tồn tại trong DB
    // (kpi_business_units: sme_total, sme_dx, sme_cds...; kpi_products: ocop_3star...).
    // KHÔNG dùng biến thể camelCase (smeDx, smeTotal...) vì không có cột đó.
    const affectedFields =
      Array.isArray(fields) && fields.length > 0
        ? fields.filter(Boolean)
        : field
          ? [field]
          : [];

    if (!dashboardId || !section || affectedFields.length === 0) {
      return NextResponse.json(
        { error: 'Thiếu dữ liệu đầu vào (dashboardId, section, field)' },
        { status: 400 }
      );
    }

    const numericValue = Number(value) || 0;
    const tableName = section === 'B1' ? 'kpi_business_units' : 'kpi_products';
    const updatePayload = Object.fromEntries(
      affectedFields.map((f: string) => [f, numericValue])
    );

    // Kiểm tra xem đã có bản ghi KPI nào cho Dashboard này chưa
    const { data: existing } = await supabaseAdmin
      .from(tableName)
      .select('id')
      .eq('dashboard_id', dashboardId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Cập nhật số liệu vào bản ghi hiện có
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .update({
          ...updatePayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error("Supabase Error:", error);
        throw error;
      }
      // Đồng bộ tự động số liệu Xã/Phường lên Dashboard Tỉnh
      await syncCommuneToProvince(dashboardId);
      return NextResponse.json({ success: true, message: 'Cập nhật số liệu thành công!', data });
    } else {
      // Thêm bản ghi KPI mới nếu chưa có
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .insert({
          dashboard_id: dashboardId,
          ...updatePayload,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase Error:", error);
        throw error;
      }
      // Đồng bộ tự động số liệu Xã/Phường lên Dashboard Tỉnh
      await syncCommuneToProvince(dashboardId);
      return NextResponse.json({ success: true, message: 'Khởi tạo số liệu thành công!', data });
    }
    } catch (error: unknown) {
    console.error('Lỗi update-value:', error);
    // Đính kèm thông điệp gốc từ Supabase/Postgres để client dễ debug
    const rawMessage =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : null;
    return NextResponse.json(
      { error: rawMessage || errorMessage(error, 'Lỗi cập nhật số liệu') },
      { status: 500 }
    );
  }
}