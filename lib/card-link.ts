import type { KeyboardEvent, MouseEvent } from "react";
import { getValidUrl } from "./url-utils";

export { getValidUrl };

export function getStoredMetricId(
  metricIds: Record<string, string> | undefined,
  metricKey: string,
  fallbackUrl?: string
): string {
  const stored = metricIds?.[metricKey];
  if (stored) return stored;
  const parts = (fallbackUrl || "").split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

/**
 * Mở "Đường dẫn tự động tạo" (target_url) của chỉ số trong tab mới.
 * Luôn chuẩn hóa URL trước khi mở để đảm bảo có tiền tố http(s)://.
 */
export function openTargetUrl(url: string): void {
  const valid = getValidUrl(url);
  if (!valid) return;
  window.open(valid, "_blank", "noopener,noreferrer");
}

/**
 * Props dùng để biến một Thẻ KPI thành nút bấm mở `target_url` trong tab mới.
 * - Click vào thân thẻ / tiêu đề / số liệu -> mở link.
 * - Click vào <a> hoặc <button> bên trong (Icon Link, Thiết lập ID, Setup số
 *   lượng) -> KHÔNG mở link của thẻ, phần tử đó tự xử lý riêng (tránh mở 2 tab).
 * - url rỗng -> trả về {} để thẻ giữ nguyên hành vi cũ (không bấm được).
 */
export function cardLinkProps(url: string | undefined | null) {
  const resolved = getValidUrl(url);
  if (!resolved) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (e: MouseEvent<HTMLElement>) => {
      const target = e.target as HTMLElement | null;
      // Bỏ qua nếu click vào link / nút bấm bên trong thẻ
      if (target?.closest("a, button")) return;
      openTargetUrl(resolved);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("a, button")) return;
      e.preventDefault();
      openTargetUrl(resolved);
    },
  };
}