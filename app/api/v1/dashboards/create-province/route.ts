import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { provinceId, provinceName, domainLink, syncSchedule } = body;

    // 1. Kiểm tra thông tin Tỉnh
    let targetProvinceId = provinceId;
    let targetProvinceName = provinceName;

    if (!targetProvinceId && !targetProvinceName) {
      return NextResponse.json({ error: 'Vui lòng chọn hoặc nhập tên Tỉnh' }, { status: 400 });
    }

    // Nếu người dùng chọn Tỉnh từ danh sách có sẵn
    if (targetProvinceId) {
      const { data: existingUnit } = await supabaseAdmin
        .from('administrative_units')
        .select('*')
        .eq('id', targetProvinceId)
        .single();

      if (existingUnit) {
        targetProvinceName = existingUnit.name;
      }
    } else {
      // Nếu nhập Tỉnh mới, tạo bản ghi trong administrative_units
      const provinceCode = `PROVINCE_${Date.now()}`;
      const { data: newUnit, error: newUnitErr } = await supabaseAdmin
        .from('administrative_units')
        .insert({
          code: provinceCode,
          name: targetProvinceName,
          type: 'PROVINCE',
        })
        .select()
        .single();

      if (newUnitErr) throw newUnitErr;
      targetProvinceId = newUnit.id;
    }

    // 2. Tạo Dashboard Tỉnh
    const { data: provinceDashboard, error: dashErr } = await supabaseAdmin
      .from('dashboards')
      .insert({
        unit_id: targetProvinceId,
        title: `DASHBOARD KINH TẾ SỐ ${targetProvinceName.toUpperCase()}`,
        domain_link: domainLink || null,
        sync_schedule: syncSchedule || '0 0 * * *',
      })
      .select()
      .single();

    if (dashErr) throw dashErr;

    // 3. TỰ ĐỘNG TRUY VẤN TẤT CẢ XÃ/PHƯỜNG THỰC TẾ THUỘC TỈNH NÀY TRONG CSDL
    const { data: childCommunes } = await supabaseAdmin
      .from('administrative_units')
      .select('*')
      .eq('parent_id', targetProvinceId);

    // 4. Sinh Dashboard tự động cho tất cả các Xã/Phường sau sáp nhập
    if (childCommunes && childCommunes.length > 0) {
      const communeDashboards = childCommunes.map((commune) => ({
        unit_id: commune.id,
        title: `DASHBOARD KINH TẾ SỐ ${commune.name.toUpperCase()}`,
        sync_schedule: syncSchedule || '0 0 * * *',
      }));

      await supabaseAdmin.from('dashboards').insert(communeDashboards);
    }

    return NextResponse.json({
      success: true,
      message: `Đã tạo thành công Dashboard Tỉnh và ${childCommunes?.length || 0} Dashboard Xã/Phường trực thuộc`,
      data: provinceDashboard,
    });
  } catch (error: any) {
    console.error('Lỗi create-province:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý hệ thống' }, { status: 500 });
  }
}