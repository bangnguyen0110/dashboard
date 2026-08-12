import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { dashboardId, section, field, value } = body;

    if (!dashboardId || !section || !field) {
      return NextResponse.json(
        { error: 'Thiếu dữ liệu đầu vào (dashboardId, section, field)' },
        { status: 400 }
      );
    }

    const numericValue = Number(value) || 0;
    const tableName = section === 'B1' ? 'kpi_business_units' : 'kpi_products';

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
          [field]: numericValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Cập nhật số liệu thành công!', data });
    } else {
      // Thêm bản ghi KPI mới nếu chưa có
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .insert({
          dashboard_id: dashboardId,
          [field]: numericValue,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Khởi tạo số liệu thành công!', data });
    }
  } catch (error: any) {
    console.error('Lỗi update-value:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi cập nhật số liệu' },
      { status: 500 }
    );
  }
}