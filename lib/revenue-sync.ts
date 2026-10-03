/**
 * Kiểu dữ liệu & tiện ích dùng chung cho hệ thống
 * "ĐỒNG BỘ DOANH THU TỰ ĐỘNG THEO THỜI GIAN THỰC" (Push-Data).
 *
 * Bảng tương ứng (xem supabase/migrations/0007_doanh_thu_realtime.sql):
 *   - doanh_thu_xa      : trạng thái hiện tại của từng xã/phường.
 *   - lich_su_doanh_thu : log biến động data-value (append-only).
 *   - doanh_thu_tinh    : tổng cộng dồn cấp Tỉnh (auto SUM bằng trigger).
 *   - nguon_dong_bo     : cấu hình nguồn + Secret Token (chỉ server đọc).
 *
 * KHÔNG truy cập Supabase ở file này — chỉ khai báo kiểu & hàm thuần.
 */

export const REVENUE_XA_TABLE = "doanh_thu_xa";
export const REVENUE_TINH_TABLE = "doanh_thu_tinh";
export const REVENUE_HISTORY_TABLE = "lich_su_doanh_thu";
export const REVENUE_SOURCE_TABLE = "nguon_dong_bo";

/** VIEW tổng hợp: Mã Xã · URL thiết lập · Giá trị hiện tại (migration 0008). */
export const REVENUE_DASHBOARD_XA_VIEW = "dashboard_xa";

/** Đường dẫn Edge Function nhận push dữ liệu. */
export const SYNC_REVENUE_FUNCTION = "sync-revenue";

/** Một dòng trạng thái doanh thu hiện tại của xã/phường. */
export interface DoanhThuXaRow {
  ma_xa: string;
  ma_tinh?: string | null;
  ten_xa?: string | null;
  gia_tri: number;
  url_nguon?: string | null;
  nguon?: string | null;
  updated_at?: string | null;
}

/** Một dòng tổng hợp doanh thu cấp Tỉnh (do trigger tự cộng dồn). */
export interface DoanhThuTinhRow {
  ma_tinh: string;
  ten_tinh?: string | null;
  gia_tri: number;
  so_xa: number;
  updated_at?: string | null;
}

/** Một dòng log lịch sử biến động. */
export interface LichSuDoanhThuRow {
  id: number;
  ma_xa: string;
  so_cu: number;
  so_moi: number;
  chenh_lech: number;
  nguon?: string | null;
  thoi_gian: string;
}

/** Cấu hình nguồn (lưu trong dashboards.settings.revenue). */
export interface RevenueSourceSettings {
  ma_xa?: string;
  ma_tinh?: string;
  url_nguon?: string;
  /** Chỉ lưu 4 ký tự cuối để nhận diện, KHÔNG lưu token gốc ở đây. */
  token_hint?: string;
  updated_at?: string;
}

const vndFormatter = new Intl.NumberFormat("vi-VN");

/** 1234567 -> "1.234.567". */
export function formatVnNumber(value: unknown): string {
  const n = Number(value ?? 0);
  return vndFormatter.format(Number.isFinite(n) ? n : 0);
}

/** 1234567 -> "1.234.567 VNĐ". */
export function formatVnd(value: unknown): string {
  return `${formatVnNumber(value)} VNĐ`;
}

/** Giá trị có phải số hợp lệ không (dùng khi hiển thị badge realtime). */
export function isNumeric(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n);
}

/** "2 phút trước" — hiển thị mốc thời gian thân thiện. */
export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";

  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 5) return "vừa xong";
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay} ngày trước`;
}

/** Đọc cấu hình nguồn doanh thu từ `dashboards.settings`. */
export function readRevenueSource(
  dashboard: { settings?: Record<string, unknown> | null } | null | undefined
): RevenueSourceSettings {
  const raw = dashboard?.settings?.revenue;
  if (!raw || typeof raw !== "object") return {};
  return raw as RevenueSourceSettings;
}

/**
 * Suy ra Mã Xã mặc định cho dashboard: ưu tiên cấu hình đã lưu,
 * sau đó tới `unit.code`, cuối cùng là `unit_id`.
 */
export function defaultMaXa(
  dashboard:
    | { unit?: { code?: string | null } | null; unit_id?: string | null; settings?: Record<string, unknown> | null }
    | null
    | undefined
): string {
  const saved = readRevenueSource(dashboard).ma_xa;
  if (saved) return saved;
  const code = dashboard?.unit?.code;
  if (code) return code;
  return dashboard?.unit_id ?? "";
}