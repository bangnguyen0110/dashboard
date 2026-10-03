-- ============================================================================
-- Migration 0007 — ĐỒNG BỘ DOANH THU TỰ ĐỘNG THEO THỜI GIAN THỰC (Push-Data)
-- ----------------------------------------------------------------------------
-- Bối cảnh: Các website nguồn (trang thông tin xã/phường) hiển thị một con số
-- doanh thu tại <p class="chuxanh tongtienthu" data-value="...">. Khi con số đó
-- đổi, một đoạn JS nhúng (public/embed/doanh-thu-sync.js) sẽ POST lên Edge
-- Function `sync-revenue`, ghi vào bảng `doanh_thu_xa`. Trigger tự động:
--   1) Ghi log biến động vào `lich_su_doanh_thu` (append-only).
--   2) Cộng dồn (SUM) toàn bộ xã vào `doanh_thu_tinh`.
--
-- ⚠️ AN TOÀN (bắt buộc): CHỈ TẠO BẢNG/TRIGGER MỚI. KHÔNG ALTER, không đổi cấu
-- trúc hay luồng cào dữ liệu hiện có (`dashboards`, `kpi_*`, `metric_links`).
--
-- CÁCH CHẠY: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- File idempotent: chạy lại nhiều lần không lỗi, không nhân đôi dữ liệu.
--
-- MÔ HÌNH DỮ LIỆU:
--   doanh_thu_xa       : TRẠNG THÁI HIỆN TẠI — 1 dòng / 1 xã (ma_xa là khóa).
--   lich_su_doanh_thu  : LOG biến động — ghi mỗi khi gia_tri thay đổi.
--   doanh_thu_tinh     : TỔNG HỢP cấp Tỉnh — 1 dòng / 1 tỉnh, tự cộng dồn.
--   nguon_dong_bo      : CẤU HÌNH + Secret Token cho từng xã (không cho anon đọc).
--
--   ma_xa  : Mã Xã/Phường (khớp administrative_units.code hoặc .id).
--   ma_tinh: Mã Tỉnh (khớp administrative_units.code/.id của đơn vị type=PROVINCE).
-- ============================================================================

-- 1. BẢNG TRẠNG THÁI HIỆN TẠI (mỗi xã 1 dòng) --------------------------------
create table if not exists public.doanh_thu_xa (
  ma_xa      text primary key,
  ma_tinh    text,
  ten_xa     text,
  gia_tri    numeric(18,2) not null default 0,
  url_nguon  text,
  nguon      text not null default 'push',
  updated_at timestamptz not null default now()
);

comment on table public.doanh_thu_xa is
  'Doanh thu HIỆN TẠI của từng xã/phường (nguồn: JS nhúng push lên sync-revenue).';

-- 2. BẢNG LOG LỊCH SỬ (append-only) ------------------------------------------
create table if not exists public.lich_su_doanh_thu (
  id         bigint generated always as identity primary key,
  ma_xa      text not null,
  so_cu      numeric(18,2) not null default 0,
  so_moi     numeric(18,2) not null default 0,
  chenh_lech numeric(18,2) generated always as (so_moi - so_cu) stored,
  nguon      text not null default 'push',
  thoi_gian  timestamptz not null default now()
);

comment on table public.lich_su_doanh_thu is
  'Lịch sử biến động data-value doanh thu (audit trail, chỉ ghi khi giá trị đổi).';

-- 3. BẢNG TỔNG HỢP CẤP TỈNH ------------------------------------------------
create table if not exists public.doanh_thu_tinh (
  ma_tinh    text primary key,
  ten_tinh   text,
  gia_tri    numeric(18,2) not null default 0,
  so_xa      integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.doanh_thu_tinh is
  'Tổng doanh thu cấp Tỉnh = SUM(doanh_thu_xa.gia_tri) theo ma_tinh.';

-- 4. BẢNG CẤU HÌNH NGUỒN + SECRET TOKEN ------------------------------------
-- Bảng này KHÔNG mở cho anon (chứa token). Chỉ service_role / Edge Function đọc.
create table if not exists public.nguon_dong_bo (
  ma_xa        text primary key,
  ma_tinh      text,
  url_nguon    text,
  secret_token text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.nguon_dong_bo is
  'Cấu hình nguồn push + Secret Token cho từng xã (dùng bởi Edge Function).';

-- 5. CHỈ MỤC TĂNG TỐC -------------------------------------------------------
create index if not exists idx_lich_su_doanh_thu_ma_xa
  on public.lich_su_doanh_thu (ma_xa, thoi_gian desc);
create index if not exists idx_doanh_thu_xa_ma_tinh
  on public.doanh_thu_xa (ma_tinh);

-- ============================================================================
-- 6. TRIGGER 1 — TỰ ĐỘNG GHI LOG LỊCH SỬ KHI doanh_thu_xa THAY ĐỔI
-- ----------------------------------------------------------------------------
-- Chỉ ghi khi giá trị THỰC SỰ đổi (tránh rác log do push trùng).
-- Dùng SECURITY DEFINER + search_path cố định để an toàn (chống search_path
-- injection) và để trigger chạy được dù service_role đã bypass RLS sẵn.
-- ============================================================================
create or replace function public.fn_ghi_lich_su_doanh_thu()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_so_cu numeric(18,2) := 0;
begin
  -- ⚠️ Chỉ truy cập old/new đúng theo TG_OP (record chưa gán sẽ báo lỗi)
  if (tg_op = 'UPDATE') then
    if new.gia_tri is not distinct from old.gia_tri then
      return null; -- giá trị không đổi => không ghi log
    end if;
    v_so_cu := old.gia_tri;
  end if;

  insert into public.lich_su_doanh_thu (ma_xa, so_cu, so_moi, nguon)
  values (
    new.ma_xa,
    v_so_cu,
    new.gia_tri,
    coalesce(nullif(new.nguon, ''), 'push')
  );

  return null; -- AFTER trigger: giá trị trả về bị bỏ qua
end;
$$;

drop trigger if exists trg_doanh_thu_xa_history on public.doanh_thu_xa;
create trigger trg_doanh_thu_xa_history
  after insert or update on public.doanh_thu_xa
  for each row execute function public.fn_ghi_lich_su_doanh_thu();

-- ============================================================================
-- 7. TRIGGER 2 — TỰ ĐỘNG CỘNG DỒN (SUM) LÊN doanh_thu_tinh
-- ----------------------------------------------------------------------------
-- Mỗi khi 1 xã được thêm/đổi/xóa, tính lại tổng của Tỉnh tương ứng.
-- Dùng UPSERT (on conflict) để idempotent. Nếu ma_tinh đổi thì cập nhật cả
-- tỉnh cũ để không còn giữ số "mồ côi".
-- ============================================================================
create or replace function public.fn_tong_hop_doanh_thu_tinh(p_ma_tinh text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_ma_tinh is null or p_ma_tinh = '' then
    return;
  end if;

  insert into public.doanh_thu_tinh (ma_tinh, gia_tri, so_xa, updated_at)
  select
    p_ma_tinh,
    coalesce(sum(dt.gia_tri), 0),
    count(*)::int,
    now()
  from public.doanh_thu_xa dt
  where dt.ma_tinh = p_ma_tinh
  on conflict (ma_tinh) do update
    set gia_tri    = excluded.gia_tri,
        so_xa      = excluded.so_xa,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.fn_trigger_tong_hop_tinh()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- ⚠️ Chỉ truy cập old/new đúng theo TG_OP (record chưa gán sẽ báo lỗi)
  if (tg_op = 'DELETE') then
    perform public.fn_tong_hop_doanh_thu_tinh(old.ma_tinh);
    return null;
  end if;

  perform public.fn_tong_hop_doanh_thu_tinh(new.ma_tinh);

  -- Nếu xã bị chuyển sang tỉnh khác => tính lại cả tỉnh cũ
  if (tg_op = 'UPDATE' and new.ma_tinh is distinct from old.ma_tinh) then
    perform public.fn_tong_hop_doanh_thu_tinh(old.ma_tinh);
  end if;

  return null; -- AFTER trigger: giá trị trả về bị bỏ qua
end;
$$;

drop trigger if exists trg_doanh_thu_xa_rollup on public.doanh_thu_xa;
create trigger trg_doanh_thu_xa_rollup
  after insert or update or delete on public.doanh_thu_xa
  for each row execute function public.fn_trigger_tong_hop_tinh();

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) — CHỈ ĐỌC CHO DASHBOARD
-- ----------------------------------------------------------------------------
-- Dashboard (anon key) CHỈ được SELECT để hiển thị + nghe Realtime.
-- Mọi thao tác GHI đều do Edge Function (service_role) thực hiện và bỏ qua RLS.
-- Bảng `nguon_dong_bo` chứa token => KHÔNG tạo policy cho anon (mặc định chặn).
-- ============================================================================
alter table public.doanh_thu_xa      enable row level security;
alter table public.lich_su_doanh_thu enable row level security;
alter table public.doanh_thu_tinh    enable row level security;
alter table public.nguon_dong_bo     enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'doanh_thu_xa'
      and policyname = 'doanh_thu_xa_read'
  ) then
    execute 'create policy doanh_thu_xa_read on public.doanh_thu_xa for select using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lich_su_doanh_thu'
      and policyname = 'lich_su_doanh_thu_read'
  ) then
    execute 'create policy lich_su_doanh_thu_read on public.lich_su_doanh_thu for select using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'doanh_thu_tinh'
      and policyname = 'doanh_thu_tinh_read'
  ) then
    execute 'create policy doanh_thu_tinh_read on public.doanh_thu_tinh for select using (true)';
  end if;
end $$;

-- Quyền SELECT cho 2 role của dashboard (policy ở trên mới là lớp quyết định)
grant select on public.doanh_thu_xa      to anon, authenticated;
grant select on public.lich_su_doanh_thu to anon, authenticated;
grant select on public.doanh_thu_tinh    to anon, authenticated;

-- ============================================================================
-- 9. SUPABASE REALTIME — BẬT ĐỒNG BỘ CHO 3 BẢNG
-- ----------------------------------------------------------------------------
-- * replica identity full  : để payload UPDATE/DELETE có đủ cột cũ.
-- * thêm vào publication   : để bảng phát sự kiện qua WebSocket.
-- ============================================================================
alter table public.doanh_thu_xa      replica identity full;
alter table public.lich_su_doanh_thu replica identity full;
alter table public.doanh_thu_tinh    replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'doanh_thu_xa'
  ) then
    execute 'alter publication supabase_realtime add table public.doanh_thu_xa';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'doanh_thu_tinh'
  ) then
    execute 'alter publication supabase_realtime add table public.doanh_thu_tinh';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'lich_su_doanh_thu'
  ) then
    execute 'alter publication supabase_realtime add table public.lich_su_doanh_thu';
  end if;
end $$;

-- ============================================================================
-- 10. BACKFILL TỔNG TỈNH TỪ DỮ LIỆU ĐANG CÓ
-- ----------------------------------------------------------------------------
-- Chốt lại tổng cấp Tỉnh cho toàn bộ dữ liệu hiện hữu (idempotent).
-- ============================================================================
insert into public.doanh_thu_tinh (ma_tinh, gia_tri, so_xa, updated_at)
select
  dt.ma_tinh,
  coalesce(sum(dt.gia_tri), 0),
  count(*)::int,
  now()
from public.doanh_thu_xa dt
where dt.ma_tinh is not null and dt.ma_tinh <> ''
group by dt.ma_tinh
on conflict (ma_tinh) do update
  set gia_tri    = excluded.gia_tri,
      so_xa      = excluded.so_xa,
      updated_at = excluded.updated_at;

-- ============================================================================
-- 11. KIỂM TRA NHANH SAU KHI CHẠY (chạy tay trong SQL Editor)
-- ----------------------------------------------------------------------------
--   select * from public.doanh_thu_xa order by updated_at desc limit 20;
--   select * from public.lich_su_doanh_thu order by thoi_gian desc limit 20;
--   select * from public.doanh_thu_tinh;
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime';
--
--   -- Test rollup + history (thay ma_xa/ma_tinh thật):
--   insert into public.doanh_thu_xa (ma_xa, ma_tinh, ten_xa, gia_tri)
--   values ('TEST-01', 'TEST-TINH', 'Xã Test', 1000)
--   on conflict (ma_xa) do update set gia_tri = 1500;
--   select * from public.doanh_thu_tinh where ma_tinh = 'TEST-TINH';
--   select * from public.lich_su_doanh_thu where ma_xa = 'TEST-01';
--   -- Dọn dẹp: delete from public.doanh_thu_xa where ma_xa = 'TEST-01';
-- ============================================================================