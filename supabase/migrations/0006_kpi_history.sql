-- ============================================================================
-- Migration 0006 — KHO LỊCH SỬ KPI (Historical Snapshot)
-- ----------------------------------------------------------------------------
-- Bối cảnh: `kpi_business_units` & `kpi_products` là bảng "TRẠNG THÁI HIỆN TẠI"
-- (ghi bằng upsert theo `dashboard_id`), nên số liệu của các kỳ trước (tháng
-- trước / quý trước) bị ghi đè và mất. Migration này tạo KHO LỊCH SỬ riêng để
-- tính năng "Bộ lọc và so sánh thông tin" truy vấn được dữ liệu quá khứ.
--
-- ⚠️ AN TOÀN (bắt buộc):
--   * CHỈ TẠO BẢNG MỚI. Không ALTER, không đổi khóa chính/cấu trúc của
--     `dashboards`, `kpi_business_units`, `kpi_products`.
--   * Không tạo trigger/job nào tác động vào luồng cào & tổng hợp dữ liệu chính.
--     Việc chốt mốc do tiến trình ĐỘC LẬP thực hiện (xem lib/kpi-history-server.ts
--     và API /api/v1/metrics/kpi-history/snapshot, có thể gọi qua cron riêng).
--
-- CÁCH CHẠY: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- File idempotent: chạy lại nhiều lần không lỗi, không nhân đôi dữ liệu.
--
-- MÔ HÌNH DỮ LIỆU:
--   kpi_history        : 1 dòng cho mỗi (dashboard_id, period_month) = trạng thái
--                        cuối cùng của kỳ đó. Dùng để tra cứu theo tháng/quý/năm.
--   kpi_history_events : log append-only, CHỈ ghi khi số liệu thay đổi (audit).
-- ============================================================================

-- 1. BẢNG LỊCH SỬ CHÍNH ------------------------------------------------------
-- Giữ ĐÚNG tên cột của bảng KPI hiện tại (kể cả các cột trùng nghĩa do backend
-- ghi song song: sme_cds/sme_dx, sp_thuong/normal_product, dich_vu/services_count)
-- để kho lịch sử phản ánh trung thực dữ liệu nguồn.
create table if not exists public.kpi_history (
  id                uuid primary key default gen_random_uuid(),
  dashboard_id      uuid not null references public.dashboards(id) on delete cascade,
  period_month      text not null,
  period_quarter    text not null,
  period_year       text not null,
  source            text not null default 'snapshot',

  -- Khối B1 — Doanh nghiệp, Hộ kinh doanh & Hợp tác xã
  sme_total         numeric not null default 0,
  hkd_total         numeric not null default 0,
  htx_total         numeric not null default 0,
  sme_cds           numeric not null default 0,
  hkd_cds           numeric not null default 0,
  htx_cds           numeric not null default 0,
  sme_dx            numeric not null default 0,
  hkd_dx            numeric not null default 0,
  htx_dx            numeric not null default 0,

  -- Khối B2 — Sản phẩm & Dịch vụ
  ocop_3star        numeric not null default 0,
  ocop_4star        numeric not null default 0,
  ocop_5star        numeric not null default 0,
  sp_thuong         numeric not null default 0,
  normal_product    numeric not null default 0,
  dich_vu           numeric not null default 0,
  services_count    numeric not null default 0,

  -- Dấu vết thời gian
  captured_at       timestamptz not null default now(),
  first_captured_at timestamptz not null default now(),
  capture_count     integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Ràng buộc định dạng kỳ "YYYY-MM" (thêm idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'kpi_history_period_month_chk'
  ) then
    alter table public.kpi_history
      add constraint kpi_history_period_month_chk
      check (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  end if;
end $$;

-- Khoá duy nhất (dashboard_id, period_month) — cần cho upsert onConflict của
-- tiến trình chốt mốc: mỗi dashboard chỉ có 1 dòng cho mỗi tháng.
create unique index if not exists kpi_history_dashboard_month_uidx
  on public.kpi_history (dashboard_id, period_month);

create index if not exists kpi_history_month_idx
  on public.kpi_history (period_month);
create index if not exists kpi_history_quarter_idx
  on public.kpi_history (period_quarter);
create index if not exists kpi_history_year_idx
  on public.kpi_history (period_year);

-- 2. BẢNG LOG SỰ KIỆN (append-only, audit) ----------------------------------
create table if not exists public.kpi_history_events (
  id             bigserial primary key,
  dashboard_id   uuid not null references public.dashboards(id) on delete cascade,
  period_month   text not null,
  period_quarter text not null,
  period_year    text not null,
  source         text not null default 'snapshot',
  captured_at    timestamptz not null default now(),
  payload        jsonb not null default '{}'::jsonb
);

create index if not exists kpi_history_events_dashboard_idx
  on public.kpi_history_events (dashboard_id, captured_at desc);
create index if not exists kpi_history_events_month_idx
  on public.kpi_history_events (period_month);

-- 3. BẢO MẬT (RLS) -----------------------------------------------------------
-- Bật RLS + CHỈ cho phép ĐỌC công khai (frontend dùng anon key).
-- Ghi dữ liệu lịch sử chỉ qua service role (bỏ qua RLS) => anon không thể sửa.
alter table public.kpi_history enable row level security;
alter table public.kpi_history_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'kpi_history'
      and policyname = 'kpi_history_read_all'
  ) then
    execute 'create policy kpi_history_read_all on public.kpi_history for select using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'kpi_history_events'
      and policyname = 'kpi_history_events_read_all'
  ) then
    execute 'create policy kpi_history_events_read_all on public.kpi_history_events for select using (true)';
  end if;
end $$;
-- 4. BACKFILL MỐC KHỞI TẠO ---------------------------------------------------
-- Không thể tái tạo số liệu các tháng đã bị ghi đè trong quá khứ, nhưng có thể
-- chốt ngay MỘT mốc cho kỳ gần nhất từ dữ liệu hiện có (kỳ được suy ra từ
-- metadata.last_sync_at / last_synced_at / dashboards.updated_at).
-- on conflict do nothing => chạy lại an toàn, không ghi đè mốc đã có.
with src as (
  select
    d.id as dashboard_id,
    coalesce(
      substring(d.metadata->>'last_sync_at' from '^[0-9]{4}-[0-9]{2}'),
      substring(d.metadata->>'last_synced_at' from '^[0-9]{4}-[0-9]{2}'),
      to_char(d.updated_at, 'YYYY-MM'),
      to_char(now(), 'YYYY-MM')
    ) as period_month,
    coalesce(b1.sme_total, 0) as sme_total,
    coalesce(b1.hkd_total, 0) as hkd_total,
    coalesce(b1.htx_total, 0) as htx_total,
    coalesce(b1.sme_cds, 0) as sme_cds,
    coalesce(b1.hkd_cds, 0) as hkd_cds,
    coalesce(b1.htx_cds, 0) as htx_cds,
    coalesce(b1.sme_dx, 0) as sme_dx,
    coalesce(b1.hkd_dx, 0) as hkd_dx,
    coalesce(b1.htx_dx, 0) as htx_dx,
    coalesce(b2.ocop_3star, 0) as ocop_3star,
    coalesce(b2.ocop_4star, 0) as ocop_4star,
    coalesce(b2.ocop_5star, 0) as ocop_5star,
    coalesce(b2.sp_thuong, 0) as sp_thuong,
    coalesce(b2.normal_product, 0) as normal_product,
    coalesce(b2.dich_vu, 0) as dich_vu,
    coalesce(b2.services_count, 0) as services_count
  from public.dashboards d
  left join public.kpi_business_units b1 on b1.dashboard_id = d.id
  left join public.kpi_products b2 on b2.dashboard_id = d.id
  where b1.id is not null or b2.id is not null
),
prepared as (
  select
    dashboard_id,
    period_month,
    substring(period_month, 1, 4) || '-Q' ||
      ((cast(substring(period_month, 6, 2) as integer) + 2) / 3)::text as period_quarter,
    substring(period_month, 1, 4) as period_year,
    sme_total, hkd_total, htx_total, sme_cds, hkd_cds, htx_cds,
    sme_dx, hkd_dx, htx_dx,
    ocop_3star, ocop_4star, ocop_5star, sp_thuong, normal_product,
    dich_vu, services_count
  from src
  where period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
)
insert into public.kpi_history (
  dashboard_id, period_month, period_quarter, period_year, source,
  sme_total, hkd_total, htx_total, sme_cds, hkd_cds, htx_cds, sme_dx, hkd_dx, htx_dx,
  ocop_3star, ocop_4star, ocop_5star, sp_thuong, normal_product, dich_vu, services_count
)
select
  dashboard_id, period_month, period_quarter, period_year, 'backfill-0006',
  sme_total, hkd_total, htx_total, sme_cds, hkd_cds, htx_cds, sme_dx, hkd_dx, htx_dx,
  ocop_3star, ocop_4star, ocop_5star, sp_thuong, normal_product, dich_vu, services_count
from prepared
on conflict (dashboard_id, period_month) do nothing;

-- 5. KIỂM TRA SAU KHI CHẠY ---------------------------------------------------
--   select period_month, period_quarter, period_year, count(*) as so_dashboard
--   from public.kpi_history group by 1, 2, 3 order by 1 desc;
--
-- Kỳ vọng: mỗi dashboard có 1 dòng cho kỳ hiện tại (khoảng 103 dòng ở lần
-- backfill đầu tiên). Từ đó, tiến trình chốt mốc độc lập sẽ bổ sung mỗi tháng.
-- ============================================================================
