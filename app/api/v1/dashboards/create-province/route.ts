import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/** Bóc tách thông điệp lỗi thực tế từ Supabase (error.message) để dễ kiểm tra. */
function supabaseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.details === 'string' && e.details) return e.details;
    if (typeof e.hint === 'string' && e.hint) return e.hint;
    if (typeof e.code === 'string' && e.code) return `Lỗi mã ${e.code}`;
  }
  return 'Lỗi xử lý hệ thống';
}

/** Tạo slug (chuỗi không dấu, an toàn URL) từ tên đơn vị. */
function makeSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `dashboard-${Date.now()}`
  );
}

/**
 * Tên bảng mà ứng dụng đang kết nối để lưu Dashboard.
 */
const DASHBOARD_TABLE = 'dashboards';

/**
 * Các cột CHẮC CHẮN tồn tại trong `dashboards` (dùng làm fallback khi không
 * introspect được schema qua information_schema). Chỉ bao gồm cột thực sự có
 * mặt ở cả schema cũ lẫn mới để tránh lỗi "column not found".
 */
const SAFE_DASHBOARD_COLUMNS = new Set<string>([
  'id',
  'unit_id',
  'title',
  'domain_link',
  'sync_schedule',
  'created_at',
  'updated_at',
]);

/**
 * Lấy tập hợp các cột hiện có của bảng `dashboards`.
 * Nếu không đọc được (information_schema chưa expose) thì dùng fallback an toàn.
 */
async function getDashboardColumns(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<ReadonlySet<string>> {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', DASHBOARD_TABLE);
    if (error) throw error;
    const columns = new Set(
      (data ?? []).map((c) => (c as { column_name?: string }).column_name ?? '')
    );
    columns.delete('');
    if (columns.size > 0) return columns;
  } catch {
    // bỏ qua → dùng fallback bên dưới
  }
  return SAFE_DASHBOARD_COLUMNS;
}

/**
 * Lọc `payload` chỉ giữ lại những cột THỰC SỰ tồn tại trong bảng — tránh lỗi
 * "Could not find the 'X' column in schema cache" khi push các cột (ví dụ
 * `code`) không tồn tại trong `dashboards`.
 */
function filterExistingColumns(
  payload: Record<string, unknown>,
  columns: ReadonlySet<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (columns.has(key)) out[key] = value;
  }
  return out;
}

/** In chi tiết lỗi Supabase ra Terminal server để dễ theo dõi. */
function logSupabaseError(context: string, error: unknown): void {
  console.error(`[create-province] ${context}:`);
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    console.error('  message :', e.message ?? '');
    console.error('  details :', e.details ?? '');
    console.error('  hint    :', e.hint ?? '');
    console.error('  code    :', e.code ?? '');
    console.error('  raw     :', error);
  } else {
    console.error('  raw     :', error);
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { provinceId, provinceName, domainLink, syncSchedule } = body;

    // 1. Kiểm tra thông tin Tỉnh
    let targetProvinceId = provinceId;
    let targetProvinceState = provinceName;
    let targetProvinceCode: string | null = null;

    if (!targetProvinceId && !targetProvinceState) {
      return NextResponse.json(
        { error: 'Vui lòng chọn hoặc nhập tên Tỉnh' },
        { status: 400 }
      );
    }

    // Nếu người dùng chọn Tỉnh từ danh sách có sẵn
    if (targetProvinceId) {
      const { data: existingUnit } = await supabaseAdmin
        .from('administrative_units')
        .select('*')
        .eq('id', targetProvinceId)
        .single();

      if (existingUnit) {
        targetProvinceState = existingUnit.name;
        targetProvinceCode = existingUnit.code ?? null;
      }
    } else {
      // Nếu nhập Tỉnh mới, tạo bản ghi trong administrative_units
      const provinceCode = `PROVINCE_${Date.now()}`;
      targetProvinceCode = provinceCode;
      const { data: newUnit, error: newUnitErr } = await supabaseAdmin
        .from('administrative_units')
        .insert({
          code: provinceCode,
          name: targetProvinceState,
          type: 'PROVINCE',
        })
        .select()
        .single();

      if (newUnitErr) throw newUnitErr;
      targetProvinceId = newUnit.id;
    }

    // 2. Tạo Dashboard Tỉnh — chỉ đẩy các cột THỰC SỰ tồn tại trong bảng.
    const slug = makeSlug(targetProvinceState);
    // Nếu cột `code` không có hoặc null thì dùng `id` (mã đơn vị hành chính) làm mặc định
    const effectiveCode = targetProvinceCode || targetProvinceId;

    const dashboardColumns = await getDashboardColumns(supabaseAdmin);
    const provincePayload = {
      unit_id: targetProvinceId,
      title: `DASHBOARD KINH TẾ SỐ ${targetProvinceState.toUpperCase()}`,
      domain_link: domainLink || null,
      sync_schedule: syncSchedule || '0 0 * * *',
      // metadata (nếu cột tồn tại) luôn là object — không bao giờ null/undefined.
      // name/code/slug được lưu trong metadata để không mất dữ liệu dù cột
      // top-level tương ứng chưa có trong bảng (ví dụ `code` gây lỗi schema cache).
      metadata: { level: 1, name: targetProvinceState, code: effectiveCode, slug },
    };

    const filteredProvince = filterExistingColumns(provincePayload, dashboardColumns);
    console.error(
      `[create-province] INSERT ${DASHBOARD_TABLE} (Tỉnh) →`,
      JSON.stringify(filteredProvince)
    );

    const { data: provinceDashboard, error: dashErr } = await supabaseAdmin
      .from(DASHBOARD_TABLE)
      .insert(filteredProvince)
      .select()
      .single();

    if (dashErr) {
      logSupabaseError('insert Dashboard Tỉnh', dashErr);
      throw dashErr;
    }

    // 3. TRUY VẦN Dữ LIỄU THỰC Tế TỤ TỤNG BẢNG DANH MụC XÃ/PHƯƯNG TRONG CSDL (source of truth)
    const { data: childCommunes } = await supabaseAdmin
      .from('administrative_units')
      .select('*')
      .eq('parent_id', targetProvinceId);

    // 3.1. LOẠI BỢ TRÙNG LỆP theo `code` (hoặc `id` nếu code thiếu) bằng Map/Set.
    //       Đội vớiựng đảm bảo số lượng Dashboard táo ra LUÔNG BẰNG CHÍNH X&Aacute;C số lượng xã thực sự có trong database của tỉnh.
    const uniqueCommunes = Array.from(
      new Map((childCommunes ?? []).map((c) => [c.code ?? c.id, c])).values()
    );

    // 4. SINH DASHBOARD CHO TỨNG XÃ/PHƯƯNG (đã deduplicate) bằng cơ chế upsert.
    if (uniqueCommunes.length > 0) {
      const communeDashboards = uniqueCommunes.map((commune) => {
        const communePayload = {
          unit_id: commune.id,
          title: `DASHBOARD KINH TẶM SỘ ${commune.name.toUpperCase()}`,
          sync_schedule: syncSchedule || '0 0 * * *',
          metadata: {
            code: commune.code ?? commune.id,
            name: commune.name,
            slug: makeSlug(commune.name),
          },
        };
        return filterExistingColumns(communePayload, dashboardColumns);
      });

      console.error(
        `[create-province] UPSERT ${DASHBOARD_TABLE} (Xã/Phường) → ${communeDashboards.length} bản ghi`
      );

      // 4.1. Dùng upsert theo `unit_id` để tránh tạo dashboard trùng khi chạy lại.
      //       Nếu bảng chưa có unique constraint trên `unit_id`, fallback về delete + insert.
      let upsertedCommunes;
      try {
        const { data: upsertData, error: upsertErr } = await supabaseAdmin
          .from(DASHBOARD_TABLE)
          .upsert(communeDashboards, { onConflict: 'unit_id' })
          .select();

        if (upsertErr) throw upsertErr;
        upsertedCommunes = upsertData;
      } catch {
        // Fallback: xóa dashboard cũ của các unit_id này rồi insert mới
        console.error(
          '[create-province] upsert thất bại (unit_id chưa có unique constraint), chuyển sang delete + insert'
        );
        const communeUnitIds = uniqueCommunes.map((c) => c.id);
        await supabaseAdmin
          .from(DASHBOARD_TABLE)
          .delete()
          .in('unit_id', communeUnitIds);

        const { data: insertData, error: insertErr } = await supabaseAdmin
          .from(DASHBOARD_TABLE)
          .insert(communeDashboards)
          .select();

        if (insertErr) {
          logSupabaseError('insert Dashboard Xã/Phường (fallback)', insertErr);
          throw insertErr;
        }
        upsertedCommunes = insertData;
      }

      // 4.2. KHỞI TẠO DỮ LIỆU KPI MẶC ĐỊNH (B1 = 0, B2 = 0) cho các Dashboard Xã mới.
      //       Chỉ tạo KPI cho dashboard chưa có bản ghi KPI (tránh ghi đè dữ liệu cũ).
      const upsertedIds = (upsertedCommunes ?? []).map((d) => (d as { id: string }).id);
      if (upsertedIds.length > 0) {
        const { data: existingB1 } = await supabaseAdmin
          .from('kpi_business_units')
          .select('dashboard_id')
          .in('dashboard_id', upsertedIds);
        const existingB1Set = new Set((existingB1 ?? []).map((r) => r.dashboard_id));

        const newKpiB1 = upsertedIds
          .filter((id) => !existingB1Set.has(id))
          .map((id) => ({
            dashboard_id: id,
            sme_total: 0, sme_cds: 0, hkd_total: 0, hkd_cds: 0, htx_total: 0, htx_cds: 0,
            sme_dx: 0, hkd_dx: 0, htx_dx: 0,
          }));

        if (newKpiB1.length > 0) {
          const { error: b1Err } = await supabaseAdmin
            .from('kpi_business_units')
            .insert(newKpiB1);
          if (b1Err) logSupabaseError('insert KPI B1 Xã', b1Err);
        }

        const { data: existingB2 } = await supabaseAdmin
          .from('kpi_products')
          .select('dashboard_id')
          .in('dashboard_id', upsertedIds);
        const existingB2Set = new Set((existingB2 ?? []).map((r) => r.dashboard_id));

        const newKpiB2 = upsertedIds
          .filter((id) => !existingB2Set.has(id))
          .map((id) => ({
            dashboard_id: id,
            ocop_3star: 0, ocop_4star: 0, ocop_5star: 0,
            sp_thuong: 0, dich_vu: 0,
          }));

        if (newKpiB2.length > 0) {
          const { error: b2Err } = await supabaseAdmin
            .from('kpi_products')
            .insert(newKpiB2);
          if (b2Err) logSupabaseError('insert KPI B2 Xã', b2Err);
        }
      }
    }

    // 5. TRẢ VỀ SỐ LƯỢNG ĐÃ ĐƯỢC DEDUPLICATE — luôn khớp với số xã thực tế trong database
    return NextResponse.json({
      success: true,
      message: `Đã tạo thành công Dashboard Tỉnh và ${uniqueCommunes.length} Dashboard Xã/Phường trực thuộc`,
      data: provinceDashboard,
    });
  } catch (error: unknown) {
    // In chi tiết lỗi Supabase ra Terminal server để dễ theo dõi
    logSupabaseError('Tạo Dashboard Tỉnh', error);
    // Trả về đúng error.message từ Supabase thay vì thông báo mặc định
    return NextResponse.json(
      { error: supabaseErrorMessage(error) },
      { status: 500 }
        );
  }
}