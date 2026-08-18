/**
 * Tiện ích backend chung dùng cho các route API.
 * Tránh lặp lại ép kiểu `any` trong khối `catch` và mang kiểu dữ liệu trả về
 * từ API bên ngoài (provinces.open-api.vn) để tuân thủ
 * `@typescript-eslint/no-explicit-any`.
 */

/** Dữ liệu Địa phương mở (provinces.open-api.vn) dùng cho seed. */
export interface OfficialProvince {
  name?: string;
  code?: number;
  districts?: OfficialDistrict[];
}

export interface OfficialDistrict {
  name?: string;
  wards?: OfficialWard[];
}

export interface OfficialWard {
  name?: string;
  code?: number;
}

/** Bản ghi Xã/Phường cần upsert vào bảng `administrative_units`. */
export interface CommuneInsert {
  code: string;
  name: string;
  type: string;
  parent_id: string;
}

/**
 * Lấy thông điệp lỗi an toàn từ giá trị `unknown` bắt được trong `catch`.
 * Thay thế trực tiếp `catch (error: any)` + `error.message` để tránh `no-explicit-any`.
 */
export function errorMessage(
  error: unknown,
  fallback = "Lỗi hệ thống"
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}
