-- ============================================================================
-- Migration 0010 — BẬT REALTIME CHO BẢNG `dashboards` (auto-refresh UI khối B3)
-- ============================================================================
-- BỐI CẢNH:
--   Cron ghi doanh thu vào `dashboards.b3` (và `kpi_revenue_history`) thành công,
--   nhưng giao diện vẫn hiển thị số cũ cho tới khi F5. Nguyên nhân KHÔNG phải
--   Data Cache của Next.js: `app/[provinceId]/page.tsx` và `components/dashboard/
--   dashboard-detail.tsx` đều là Client Component đọc Supabase bằng client TRONG
--   TRÌNH DUYỆT, nên dữ liệu chỉ nạp 1 lần lúc mount.
--   Cách sửa đúng là đẩy thay đổi qua Supabase Realtime. Việc này ĐÒI HỎI bảng
--   `dashboards` nằm trong publication `supabase_realtime`.
--
-- ⚠️ AN TOÀN:
--   * CHỈ thêm bảng vào publication + đặt replica identity. Không đổi cấu trúc
--     bảng, không tạo trigger, không đụng luồng B1/B2.
--   * Idempotent: chạy lại nhiều lần không lỗi.
--
-- CÁCH CHẠY: Supabase Dashboard -> SQL Editor -> dán file -> Run.
-- ============================================================================

-- Payload UPDATE/DELETE có đủ cột (không bắt buộc cho INSERT nhưng đồng bộ với
-- migration 0007 để hành vi nhất quán).
alter table public.dashboards replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'dashboards'
  ) then
    execute 'alter publication supabase_realtime add table public.dashboards';
  end if;
exception
  when undefined_object then
    -- Publication không tồn tại (instance chưa bật realtime) — bỏ qua an toàn.
    null;
end $$;

-- Bảng `kpi_revenue_history` (migration 0009) cũng là tín hiệu "đã cào xong";
-- đảm bảo nó cũng nằm trong publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'kpi_revenue_history'
  ) then
    execute 'alter publication supabase_realtime add table public.kpi_revenue_history';
  end if;
exception
  when undefined_object then
    null;
end $$;

-- KIỂM TRA SAU KHI CHẠY
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime'
--      and tablename in ('dashboards', 'kpi_revenue_history');
--   -- Kỳ vọng: trả về đúng 2 dòng. Nếu thiếu, UI chỉ còn polling dự phòng.
-- ============================================================================