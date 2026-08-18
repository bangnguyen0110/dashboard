-- ============================================================================
-- Migration: Cascade delete + metadata cho hệ thống Dashboard
-- ============================================================================
-- Hệ thống dùng một bảng `dashboards` duy nhất cho cả Tỉnh và Xã/Phường,
-- liên kết qua bảng `administrative_units` (cột `parent_id`).
--
-- Migration này:
--   1. Bảo đảm cột `metadata` / `settings` (JSONB) tồn tại trong `dashboards`.
--   2. Thiết lập ON DELETE CASCADE cho các bảng con tham chiếu `dashboards(id)`
--      để khi xóa Dashboard, dữ liệu KPI / link / log tự động được dọn sạch.
-- ============================================================================

-- 1. Cột JSONB cho Setup thông số / Thiết lập link (nếu chưa có)
ALTER TABLE dashboards
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 2. ON DELETE CASCADE cho các bảng con (idempotent: xóa ràng buộc cũ rồi tạo lại)

-- 2.1. kpi_business_units
ALTER TABLE kpi_business_units
  DROP CONSTRAINT IF EXISTS kpi_business_units_dashboard_id_fkey;
ALTER TABLE kpi_business_units
  ADD CONSTRAINT kpi_business_units_dashboard_id_fkey
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE;

-- 2.2. kpi_products
ALTER TABLE kpi_products
  DROP CONSTRAINT IF EXISTS kpi_products_dashboard_id_fkey;
ALTER TABLE kpi_products
  ADD CONSTRAINT kpi_products_dashboard_id_fkey
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE;

-- 2.3. metric_links
ALTER TABLE metric_links
  DROP CONSTRAINT IF EXISTS metric_links_dashboard_id_fkey;
ALTER TABLE metric_links
  ADD CONSTRAINT metric_links_dashboard_id_fkey
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE;

-- 2.4. sync_logs
ALTER TABLE sync_logs
  DROP CONSTRAINT IF EXISTS sync_logs_dashboard_id_fkey;
ALTER TABLE sync_logs
  ADD CONSTRAINT sync_logs_dashboard_id_fkey
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE;

-- ============================================================================
-- GHI CHÚ (không bắt buộc chạy trong schema hiện tại)
-- ----------------------------------------------------------------------------
-- Nếu bạn SỬ DỤNG các bảng riêng `province_dashboards` / `commune_dashboards`
-- (thay cho bảng `dashboards` dùng chung), hãy chạy block sau để đảm bảo khi
-- xóa 1 Dashboard Tỉnh thì toàn bộ Dashboard Xã/Phường trực thuộc bị xóa theo:
--
-- ALTER TABLE commune_dashboards
--   DROP CONSTRAINT IF EXISTS fk_province_dashboards,
--   ADD CONSTRAINT fk_province_dashboards
--     FOREIGN KEY (province_id)
--     REFERENCES province_dashboards(id)
--     ON DELETE CASCADE;
-- ============================================================================