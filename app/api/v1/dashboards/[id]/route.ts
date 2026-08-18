import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DashboardMetadata, DashboardSettings } from '@/lib/types';
import { errorMessage } from '@/lib/server-utils';

// 1. API SỬA THÔNG TIN DASHBOARD (PUT)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json();

    const {
      title,
      domainLink,
      syncSchedule,
      b1CustomId,
      b2CustomId,
      metadata,
      settings,
    }: {
      title?: string;
      domainLink?: string | null;
      syncSchedule?: string;
      b1CustomId?: string | null;
      b2CustomId?: string | null;
      metadata?: DashboardMetadata;
      settings?: DashboardSettings;
    } = body;

    // Gộp metadata mới vào metadata hiện có để tránh ghi đè mất dữ liệu
    const { data: existing } = await supabaseAdmin
      .from('dashboards')
      .select('metadata, settings')
      .eq('id', id)
      .maybeSingle();

    const nextMetadata = {
      ...((existing?.metadata as DashboardMetadata | null) ?? {}),
      ...(metadata ?? {}),
    };
    const nextSettings = {
      ...((existing?.settings as DashboardSettings | null) ?? {}),
      ...(settings ?? {}),
    };

    const { data, error } = await supabaseAdmin
      .from('dashboards')
      .update({
        ...(title !== undefined ? { title } : {}),
        ...(domainLink !== undefined ? { domain_link: domainLink || null } : {}),
        ...(syncSchedule !== undefined ? { sync_schedule: syncSchedule || '0 0 * * *' } : {}),
        ...(b1CustomId !== undefined ? { b1_custom_id: b1CustomId || null } : {}),
        ...(b2CustomId !== undefined ? { b2_custom_id: b2CustomId || null } : {}),
        ...(metadata !== undefined ? { metadata: nextMetadata } : {}),
        ...(settings !== undefined ? { settings: nextSettings } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Cập nhật Dashboard thành công!',
      data,
    });
    } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error, 'Lỗi cập nhật Dashboard') },
      { status: 500 }
    );
  }
}

// 2. API XÓA DASHBOARD (DELETE)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { id } = await params;

    // Xóa Dashboard (Các bảng liên quan sẽ tự động xóa nhờ CASCADE trong SQL)
    const { error } = await supabaseAdmin
      .from('dashboards')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Đã xóa Dashboard thành công!',
    });
    } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error, 'Lỗi xóa Dashboard') },
      { status: 500 }
    );
  }
}