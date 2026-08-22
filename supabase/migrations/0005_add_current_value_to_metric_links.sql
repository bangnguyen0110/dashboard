-- ============================================================================
-- Migration: Thêm cột current_value vào bảng metric_links
-- ============================================================================
-- Cột `current_value` lưu giá trị số đã bóc tách (ví dụ: 154) của từng chỉ
-- tiêu (metric_key) để các lần tải lại (refetch) luôn hiển thị đúng số liệu
-- đã đồng bộ trên Thẻ KPI, kể cả khi bảng KPI chưa có dòng dữ liệu.
--
-- Cập nhật schema cho luồng:
--   Bảng DB metric_links -> API set-link -> State & Props hiển thị Thẻ KPI
--
-- Migration này an toàn (idempotent): chỉ thêm cột nếu chưa tồn tại.
-- ============================================================================

ALTER TABLE metric_links
  ADD COLUMN IF NOT EXISTS current_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metric_id TEXT;