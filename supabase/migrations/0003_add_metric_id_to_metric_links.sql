-- ============================================================================
-- Migration: Thêm cột metric_id vào bảng metric_links
-- ============================================================================
-- Cột `metric_id` lưu trữ ID liên kết (ví dụ: B4HbFf11820eB5C) của từng
-- chỉ tiêu để hỗ trợ tính năng cào dữ liệu tự động (web scraping).
--
-- Migration này an toàn (idempotent): chỉ thêm cột nếu chưa tồn tại.
-- ============================================================================

ALTER TABLE metric_links
  ADD COLUMN IF NOT EXISTS metric_id TEXT;