-- ============================================================================
-- Migration 0008 — VIEW `dashboard_xa` + SỨC KHOẺ CÀO DỮ LIỆU (Scraper)
-- ----------------------------------------------------------------------------
-- Bổ sung cho luồng PUSH (migration 0007): bổ sung luồng PULL/CÀO tự động.
-- Một tiến trình chạy ngầm đọc danh sách URL đã thiết lập, cào
--   <p class="chuxanh tongtienthu" data-value="">0</p>
-- rồi so sánh với số cũ. Nếu ĐỔI thì ghi số mới vào `doanh_thu_xa`; các TRIGGER
-- của migration 0007 tự động ghi `lich_su_doanh_thu` + cộng dồn `doanh_thu_tinh`.
--
-- ⚠️ AN TOÀN: CHỈ THÊM CỘT MỚI (nullable, ADD COLUMN IF NOT EXISTS) và TẠO VIEW.
-- KHÔNG sửa/xoá cột, không đổi kiểu dữ liệu, không đụng bảng/trigger hiện có.
--
-- CÁCH CHẠY: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- Idempotent: chạy lại nhiều lần không lỗi.
-- ============================================================================

-- 1. CỘT THEO DÕI SỨC KHOẺ CÀO (thêm vào bảng cấu hình nguồn đã có) ----------
-- Đặt trên `nguon_dong_bo` (KHÔNG nằm trong publication Realtime) để việc cập
-- nhật trạng thái cào KHÔNG tạo sự kiện Realtime thừa trên Dashboard.
alter table public.nguon_dong_bo
  add column if not exists last_scraped_at timestamptz,
  add column if not exists last_status     text,          -- 'ok' | 'unchanged' | 'error'
  add column if not exists last_error      text,
  add column if not exists last_value      numeric(18,2); -- giá trị cào được gần nhất

comment on column public.nguon_dong_bo.last_scraped_at is
  'Thời điểm lần cào gần nhất (bởi tiến trình scraper).';
comment on column public.nguon_dong_bo.last_status is
  'Kết quả cào gần nhất: ok | unchanged | error.';

-- Chỉ mục phục vụ truy vấn "lấy các xã đang bật để cào".
create index if not exists idx_nguon_dong_bo_active
  on public.nguon_dong_bo (active) where active;

-- 2. VIEW TỔNG HỢP `dashboard_xa` ---------------------------------------------
-- Đúng 3 nhóm thông tin đề bài yêu cầu: Mã Xã · URL thiết lập · Giá trị hiện tại
-- (kèm trạng thái cào). Gom từ bảng cấu hình nguồn + bảng trạng thái doanh thu.
--
-- Dùng VIEW để KHÔNG tạo bảng trùng lặp/đồng bộ 2 chiều (tránh mâu thuẫn dữ liệu
-- với luồng PUSH đang chạy tốt). Mọi ghi vẫn đi qua `doanh_thu_xa` như trước.
create or replace view public.dashboard_xa as
select
  coalesce(n.ma_xa, d.ma_xa)               as ma_xa,
  coalesce(n.ma_tinh, d.ma_tinh)           as ma_tinh,
  d.ten_xa                                 as ten_xa,
  coalesce(n.url_nguon, d.url_nguon)       as url_nguon,
  coalesce(d.gia_tri, 0)                   as gia_tri,
  d.updated_at                             as gia_tri_updated_at,
  coalesce(n.active, false)                as active,
  n.last_scraped_at                        as last_scraped_at,
  n.last_status                            as last_status,
  n.last_error                             as last_error,
  n.last_value                             as last_value
from public.nguon_dong_bo n
full outer join public.doanh_thu_xa d on d.ma_xa = n.ma_xa;

comment on view public.dashboard_xa is
  'Danh sách xã: Mã Xã · URL thiết lập · Giá trị hiện tại · trạng thái cào.';

-- Cho phép Dashboard (anon/authenticated) đọc view này để hiển thị trạng thái.
grant select on public.dashboard_xa to anon, authenticated;

-- ============================================================================
-- 3. KIỂM TRA SAU KHI CHẠY (dán tay trong SQL Editor)
-- ----------------------------------------------------------------------------
--   -- Xem danh sách cấu hình + trạng thái cào
--   select ma_xa, ma_tinh, url_nguon, gia_tri, active, last_status, last_scraped_at
--   from public.dashboard_xa order by last_scraped_at desc nulls last limit 20;
--
--   -- Kiểm tra cột mới đã có
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'nguon_dong_bo'
--   order by ordinal_position;
--
--   -- Mô phỏng scraper cập nhật doanh thu (trigger sẽ tự ghi lịch sử + cộng tỉnh)
--   update public.doanh_thu_xa set gia_tri = 250000000, nguon = 'scraper'
--   where ma_xa = '89398';
--   select * from public.lich_su_doanh_thu where ma_xa = '89398' order by thoi_gian desc limit 3;
-- ============================================================================