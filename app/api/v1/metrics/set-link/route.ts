import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { dashboardId, metricKey, targetUrl } = body;

    if (!dashboardId || !metricKey) {
      return NextResponse.json(
        { error: 'Thiếu dashboardId hoặc metricKey' },
        { status: 400 }
      );
    }

    // Upsert (Cập nhật nếu đã có, Thêm mới nếu chưa)
    const { data, error } = await supabaseAdmin
      .from('metric_links')
      .upsert(
        {
          dashboard_id: dashboardId,
          metric_key: metricKey,
          target_url: targetUrl || '',
        },
        { onConflict: 'dashboard_id, metric_key' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Đã lưu liên kết thành công!',
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi lưu liên kết' },
      { status: 500 }
    );
  }
}