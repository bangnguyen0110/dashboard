import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// 1. API SỬA THÔNG TIN DASHBOARD (PUT)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const dashboardId = params.id;
    const body = await request.json();
    const { title, domainLink, syncSchedule, b1CustomId, b2CustomId } = body;

    const { data, error } = await supabaseAdmin
      .from('dashboards')
      .update({
        title,
        domain_link: domainLink || null,
        sync_schedule: syncSchedule || '0 0 * * *',
        b1_custom_id: b1CustomId || null,
        b2_custom_id: b2CustomId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dashboardId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Cập nhật Dashboard thành công!',
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi cập nhật Dashboard' },
      { status: 500 }
    );
  }
}

// 2. API XÓA DASHBOARD (DELETE)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const dashboardId = params.id;

    // Xóa Dashboard (Các bảng liên quan sẽ tự động xóa nhờ CASCADE trong SQL)
    const { error } = await supabaseAdmin
      .from('dashboards')
      .delete()
      .eq('id', dashboardId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Đã xóa Dashboard thành công!',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi xóa Dashboard' },
      { status: 500 }
    );
  }
}