-- ============================================================================
-- Migration: Unique constraint trên dashboards.unit_id
-- ============================================================================
-- Mỗi administrative unit (Tỉnh/Xã) chỉ nên có DUY NHẤT một Dashboard.
-- Constraint này hỗ trợ cơ chế upsert trong API create-province để tránh tạo
-- dashboard trùng khi chạy lại hoặc khi administrative_units có bản ghi trùng.
--
-- Migration này an toàn (idempotent):
--   1. Xóa các dashboard trùng unit_id (giữ lại bản ghi mới nhất theo created_at)
--   2. Thêm unique constraint nếu chưa tồn tại
-- ============================================================================

-- 1. Xóa các bản ghi dashboard trùng unit_id (giữ lại bản ghi mới nhất)
DELETE FROM dashboards
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY unit_id ORDER BY created_at DESC) AS rn
    FROM dashboards
    WHERE unit_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- 2. Thêm unique constraint trên unit_id (hỗ trợ upsert)
ALTER TABLE dashboards
  ADD CONSTRAINT IF NOT EXISTS dashboards_unit_id_unique UNIQUE (unit_id);
