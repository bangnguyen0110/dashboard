-- ============================================================================
-- 0011 — NHIỀU URL NGUỒN CÀO CHO 1 XÃ/PHƯỜNG (Khối B3 — Yêu cầu 1)
-- ----------------------------------------------------------------------------
-- * nguon_dong_bo.b3_urls                   : cột cấu hình URL cào DẠNG MẢNG
--                                              (jsonb Array of Strings).
-- * dashboards.settings.revenue.b3_urls     : mirror trong JSONB settings —
--                                              app luôn đọc/ghi nơi này nên
--                                              CHẠY MIGRATION NÀY hay không
--                                              luồng cào vẫn hoạt động.
-- * url_nguon (text cũ)                     : GIỮ NGUYÊN = phần tử ĐẦU TIÊN
--                                              của mảng, để VIEW `dashboard_xa`,
--                                              luồng push/embed và dữ liệu cũ
--                                              không bị vỡ.
--
-- Cách chạy: dán toàn bộ file vào Supabase SQL Editor -> Run.
-- ============================================================================

-- 1) Thêm cột mảng URL (Array of Strings, jsonb).
alter table public.nguon_dong_bo
  add column if not exists b3_urls jsonb not null default '[]'::jsonb;

comment on column public.nguon_dong_bo.b3_urls is
  'Mảng URL nguồn cào của xã/phường (jsonb Array of Strings). API cào lặp Promise.all qua toàn bộ mảng rồi CỘNG TỔNG data-value thành total_scraped_value.';

-- 2) Ràng buộc: PHẢI là mảng (phần tử do app normalizeUrlList đảm bảo là string).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nguon_dong_bo_b3_urls_is_array'
  ) then
    alter table public.nguon_dong_bo
      add constraint nguon_dong_bo_b3_urls_is_array
      check (b3_urls is null or jsonb_typeof(b3_urls) = 'array');
  end if;
end $$;

-- 3) Backfill: URL cũ (1 URL) -> mảng 1 phần tử.
update public.nguon_dong_bo
set b3_urls = jsonb_build_array(btrim(url_nguon))
where coalesce(b3_urls, '[]'::jsonb) = '[]'::jsonb
  and url_nguon is not null
  and btrim(url_nguon) <> '';

-- 4) Backfill mirror trong dashboards.settings.revenue.b3_urls (nếu chưa có).
update public.dashboards
set settings = jsonb_set(
      coalesce(settings, '{}'::jsonb),
      '{revenue,b3_urls}',
      to_jsonb(settings -> 'revenue' ->> 'url_nguon'),
      true
    )
where coalesce(settings -> 'revenue' ->> 'url_nguon', '') <> ''
  and (settings -> 'revenue') is not null
  and (settings -> 'revenue' -> 'b3_urls') is null;
