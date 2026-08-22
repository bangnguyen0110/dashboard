/**
 * Chuẩn hóa URL để LUÔN có tiền tố giao thức đầy đủ (`https://` / `http://`).
 * - Dùng cho "Đường dẫn tự động tạo" (target_url) khi lưu & khi hiển thị.
 * - `daknong.gov.vn/x`      → `https://daknong.gov.vn/x`
 * - `//daknong.gov.vn/x`    → `https://daknong.gov.vn/x`
 * - đã có giao thức          → giữ nguyên
 * - rỗng / không hợp lệ      → `null` (không tạo link)
 */
export function getValidUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}