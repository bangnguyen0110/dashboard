import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Lấy danh sách tất cả các Tỉnh đã có trong CSDL
    const { data: provinces, error: provErr } = await supabaseAdmin
      .from('administrative_units')
      .select('id, name, code')
      .eq('type', 'PROVINCE');

    if (provErr || !provinces) {
      return NextResponse.json({ error: 'Không lấy được danh sách Tỉnh từ DB' }, { status: 500 });
    }

    // 2. Tải CSDL Đơn vị Hành chính mở Việt Nam (Bao gồm Tỉnh -> Huyện -> Xã)
    const response = await fetch('https://provinces.open-api.vn/api/?depth=3');
    const officialData = await response.json();

    let totalCommunesInserted = 0;

    // 3. Duyệt qua từng Tỉnh trong CSDL của bạn để ghép nối Xã/Phường
    for (const provDB of provinces) {
      // Tìm Tỉnh tương ứng trong API mở
      const matchedProvinceAPI = officialData.find((p: any) =>
        p.name.toLowerCase().includes(provDB.name.replace(/(Tỉnh|Thành phố)\s+/gi, '').trim().toLowerCase())
      );

      if (matchedProvinceAPI && matchedProvinceAPI.districts) {
        const communesToInsert: any[] = [];

        // Duyệt qua các Huyện/Quận/Thị xã -> Lấy danh sách Xã/Phường/Thị trấn
        for (const district of matchedProvinceAPI.districts) {
          if (district.wards) {
            for (const ward of district.wards) {
              // Phân loại: Nếu là Đặc khu hoặc Xã/Phường
              const isSpecialZone = ward.name.toLowerCase().includes('đặc khu');
              
              communesToInsert.push({
                code: `COMM_${ward.code}`,
                name: ward.name,
                type: isSpecialZone ? 'SPECIAL_ZONE' : 'COMMUNE',
                parent_id: provDB.id, // Gán ID Tỉnh làm cha
              });
            }
          }
        }

        // Insert hàng loạt Xã/Phường của Tỉnh này vào Supabase
        if (communesToInsert.length > 0) {
          const { error: insertErr } = await supabaseAdmin
            .from('administrative_units')
            .upsert(communesToInsert, { onConflict: 'code' });

          if (!insertErr) {
            totalCommunesInserted += communesToInsert.length;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã nạp thành công ${totalCommunesInserted} Xã/Phường/Đặc khu vào Supabase!`,
    });
  } catch (error: any) {
    console.error('Lỗi seed-communes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}