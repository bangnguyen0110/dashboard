import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * ĐỒNG BỘ SỐ LIỆU TỪ XÃ/PHƯỜNG LÊN DASHBOARD TỈNH.
 *
 * Khi bất kỳ Xã/Phường nào trực thuộc Tỉnh cập nhật các thông số B1 & B2,
 * hàm `recalculateProvinceMetrics(provinceId)` sẽ cộng dồn (SUM) toàn bộ
 * chỉ số của các Xã/Phường đó rồi ghi đè lên Dashboard Tỉnh tương ứng.
 *
 * `provinceId` là `administrative_units.id` của đơn vị cấp tỉnh.
 */

export const PROVINCE_B1_FIELDS = [
  "sme_total",
  "sme_cds",
  "hkd_total",
  "hkd_cds",
  "htx_total",
  "htx_cds",
] as const;

export const PROVINCE_B2_FIELDS = [
  "ocop_3star",
  "ocop_4star",
  "ocop_5star",
  "sp_thuong",
  "dich_vu",
] as const;

type KpiSum = Record<string, number>;

/** Đọc giá trị số từ một ô KPI (0 nếu rỗng / không hợp lệ). */
function toNum(row: Record<string, unknown>, field: string): number {
  const raw = row[field];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function initSum(fields: readonly string[]): KpiSum {
  const sum: KpiSum = {};
  for (const f of fields) sum[f] = 0;
  return sum;
}

/** Ghi / cập nhật bản ghi KPI (dòng mới nhất) của một Dashboard với các cột tính tổng. */
async function upsertKpi(
  table: "kpi_business_units" | "kpi_products",
  dashboardId: string,
  values: KpiSum
): Promise<void> {
  const admin = getSupabaseAdmin();

  const { data: existing } = await admin
    .from(table)
    .select("id")
    .eq("dashboard_id", dashboardId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from(table)
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from(table)
      .insert({ dashboard_id: dashboardId, ...values });
    if (error) throw error;
  }
}

/**
 * Tính tổng (SUM) toàn bộ chỉ số B1 & B2 của các Xã/Phường trực thuộc một Tỉnh
 * rồi tự động ghi đè / cập nhật lên Dashboard Tỉnh tương ứng.
 */
export async function recalculateProvinceMetrics(provinceId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  // 1. Dashboard Tỉnh (liên kết thành phần qua unit_id)
  const { data: provinceDash } = await admin
    .from("dashboards")
    .select("id")
    .eq("unit_id", provinceId)
    .maybeSingle();
  if (!provinceDash) return;

  // 2. Tất cả Xã/Phường trực thuộc
  const { data: communes } = await admin
    .from("administrative_units")
    .select("id")
    .eq("parent_id", provinceId);
  const communeUnitIds = (communes ?? []).map((c) => c.id);
  if (communeUnitIds.length === 0) return;

  // 3. Dashboard của các Xã/Phường trực thuộc
  const { data: communeDashes } = await admin
    .from("dashboards")
    .select("id")
    .in("unit_id", communeUnitIds);
  const communeDashIds = (communeDashes ?? []).map((d) => d.id);
  if (communeDashIds.length === 0) return;

  // 4. Cộng dồn B1 (kpi_business_units)
  const { data: b1rows } = await admin
    .from("kpi_business_units")
    .select(PROVINCE_B1_FIELDS.join(","))
    .in("dashboard_id", communeDashIds);

  const b1sum = initSum(PROVINCE_B1_FIELDS);
  for (const row of (b1rows ?? []) as unknown as Record<string, unknown>[]) {
    for (const f of PROVINCE_B1_FIELDS) b1sum[f] += toNum(row, f);
  }

  // 5. Cộng dồn B2 (kpi_products)
  const { data: b2rows } = await admin
    .from("kpi_products")
    .select(PROVINCE_B2_FIELDS.join(","))
    .in("dashboard_id", communeDashIds);

  const b2sum = initSum(PROVINCE_B2_FIELDS);
  for (const row of (b2rows ?? []) as unknown as Record<string, unknown>[]) {
    for (const f of PROVINCE_B2_FIELDS) b2sum[f] += toNum(row, f);
  }

  // 6. Ghi đè lên Dashboard Tỉnh
  await upsertKpi("kpi_business_units", provinceDash.id, b1sum);
  await upsertKpi("kpi_products", provinceDash.id, b2sum);
}