-- ============================================================================
-- Migration 0009 — LỊCH SỬ GHI NHẬN DOANH THU KHỐI B3 (kpi_revenue_history)
-- ----------------------------------------------------------------------------
-- Bối cảnh: Khối B3 (Dòng chảy doanh thu) cần một kho lịch sử append-only để:
--   * Mỗi lần nút "Cào ngay" (Admin) THÀNH CÔNG  -> insert 1 dòng.
--   * Cron tự động /api/v1/metrics/cron-b3 PHÁT HIỆN data-value THAY ĐỔI
--     -> insert 1 dòng.
--   * Biểu đồ gấp khúc (LineChart) trong b3-revenue-section.tsx đọc bảng này
--     thay cho dữ liệu mock (giá trị 0) như trước đây.
--
-- ⚠️ AN TOÀN (bắt buộc):
--   * CHỈ TẠO BẢNG MỚI + INDEX + POLICY. Không ALTER bảng có sẵn,
--     không trigger/cron nào tác động luồng B1, B2, AI hay realtime hiện hữu.
--   * File idempotent: chạy lại nhiều lần không lỗi, không nhân đôi.
--
-- CÁCH CHẠY: Supabase Dashboard -> SQL Editor -> dán toàn bộ file -> Run.
--
-- MÔ HÌNH:
--   1 dòng = 1 lần ghi nhận trọn vẹn cả 5 mốc (daily..yearly) tại thời điểm
--   `scraped_at`. Dashboard Tỉnh không có dòng riêng — biểu đồ Tỉnh sẽ
--   cộng dồn history của các xã/phường trực thuộc (client side).
-- ============================================================================

-- 1. BẢNG LỊCH SỬ DOANH THU ---------------------------------------------------
create table if not exists public.kpi_revenue_history (
  id           uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  daily        numeric not null default 0,
  weekly       numeric not null default 0,
  monthly      numeric not null default 0,
  quarterly    numeric not null default 0,
  yearly       numeric not null default 0,
  scraped_at   timestamptz not null default now()
);

-- Tra cứu nhanh theo dashboard (mới nhất trước) — dùng cho LineChart khối B3.
create index if not exists kpi_revenue_history_dashboard_scraped_idx
  on public.kpi_revenue_history (dashboard_id, scraped_at desc);

comment on table public.kpi_revenue_history is
  'Lịch sử ghi nhận doanh thu B3 — chỉ insert khi "Cào ngay" thành công hoặc cron phát hiện data-value thay đổi.';

-- 2. RLS ---------------------------------------------------------------------
alter table public.kpi_revenue_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kpi_revenue_history'
      and policyname = 'kpi_revenue_history_read_all'
  ) then
    execute 'create policy kpi_revenue_history_read_all
             on public.kpi_revenue_history
             for select
             using (true)';
  end if;
end $$;
-- Ghi (INSERT) CHỈ thực hiện phía server bằng service_role (bypass RLS).
-- Không tạo policy insert/update/delete cho anon — khách chỉ đọc để vẽ biểu đồ.

-- 3. REALTIME (tùy chọn, an toàn) --------------------------------------------
-- Thêm bảng vào publication supabase_realtime để biểu đồ tự thêm điểm
-- khi cron ghi lịch sử (idempotent — làm theo đúng pattern migration 0007).
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
    -- Publication không tồn tại (instance chưa bật realtime) — bỏ qua, không chặn migration.
    null;
end $$;

-- 4. KIỂM TRA SAU KHI CHẠY ---------------------------------------------------
--   select count(*) from public.kpi_revenue_history;
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename = 'kpi_revenue_history';
--   select policyname from pg_policies where tablename = 'kpi_revenue_history';
--
-- Kỳ vọng: bảng tồn tại, có index *_dashboard_scraped_idx,
-- policy kpi_revenue_history_read_all, dòng trong supabase_realtime = 1.
-- ===========================================================================