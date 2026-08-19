-- ============================================================================
-- Migration: Thêm cột base_domain vào bảng dashboards (Header Tầng 1)
-- ============================================================================
-- `base_domain` là nguồn chính cho "link Header Tầng 1" (domain / URL
-- đính kèm) của một Dashboard Tỉnh/Xã, thay thế/ưu tiên hóa so với cột
-- `domain_link` cũ. Toàn bộ ghi base_domain đều qua API route admin
-- (getSupabaseAdmin), kèm lưu dự phòng vào metadata.base_domain.
--
-- Migration này an toàn (idempotent): chỉ thêm cột nếu chưa tồn tại.
-- Các DB đã triển khai trước migration này vẫn hoạt động nhờ fallback
-- `metadata.base_domain` trong route + logic đọc base_domain || metadata → domain_link.
-- ============================================================================

ALTER TABLE dashboards
  ADD COLUMN IF NOT EXISTS base_domain TEXT;