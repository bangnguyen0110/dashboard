# ĐỒNG BỘ DOANH THU TỰ ĐỘNG THEO THỜI GIAN THỰC (Push-Data)

> Kiến trúc: **Website nguồn (MutationObserver) → Edge Function → PostgreSQL Trigger → Realtime → Dashboard (Xã & Tỉnh)**

---

## 0. Sơ đồ luồng hoạt động

```
 ┌─────────────────────────┐   (1) data-value đổi
 │  Website Nguồn (xã)     │───────────────────────────┐
 │  <p class="chuxanh      │                           │
 │     tongtienthu"        │   (2) fetch POST          │
 │     data-value="...">   │       x-sync-token        │
 └─────────────────────────┘                           ▼
                                         ┌──────────────────────────────┐
                                         │ Edge Function sync-revenue   │
                                         │  • verify Secret Token        │
                                         │  • chống spam (dedupe)        │
                                         │  • UPSERT doanh_thu_xa        │
                                         └──────────────┬───────────────┘
                                                        │ (3) ghi
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │ PostgreSQL                   │
                                         │  doanh_thu_xa                │
                                         │   ├─ TRIGGER: lich_su...     │  (4)
                                         │   └─ TRIGGER: SUM → tinh     │  (5)
                                         └──────────────┬───────────────┘
                                                        │ (6) WAL → Realtime
                              ┌─────────────────────────┴─────────────────────────┐
                              ▼                                                   ▼
                   ┌────────────────────┐                            ┌────────────────────┐
                   │ Dashboard Xã       │                            │ Dashboard Tỉnh     │
                   │ nghe doanh_thu_xa  │                            │ nghe doanh_thu_tinh│
                   │ → "nhảy số" (no F5)│                            │ → tổng tức thời    │
                   └────────────────────┘                            └────────────────────┘
```

**Các file đã tạo**

| Thành phần | Đường dẫn |
|---|---|
| Migration (schema + trigger + RLS + realtime) | `supabase/migrations/0007_doanh_thu_realtime.sql` |
| Edge Function | `supabase/functions/sync-revenue/index.ts` |
| Mã nhúng website nguồn | `public/doanh-thu-sync.js` |
| Kiểu & tiện ích chung | `lib/revenue-sync.ts` |
| API sinh/ lưu Secret Token | `app/api/v1/revenue/source/route.ts` |
| Hook Realtime | `components/dashboard/blocks/use-revenue-realtime.ts` |
| UI "Thiết lập doanh thu" + Modal | `components/dashboard/blocks/revenue-setup-modal.tsx` |
| UI bảng Lịch sử (history log) | `components/dashboard/blocks/revenue-history-log.tsx` |
| Tích hợp vào Khối B3 | `components/dashboard/blocks/b3-revenue-section.tsx` |

---

## 1. Triển khai Database (Supabase)

### 1.1. Chạy migration
1. Mở **Supabase Dashboard → SQL Editor**.
2. Dán toàn bộ nội dung `supabase/migrations/0007_doanh_thu_realtime.sql`.
3. Bấm **Run**. File **idempotent** — chạy lại nhiều lần không lỗi.

Hoặc dùng CLI (nếu đã `supabase link`):
```bash
supabase db push
```

### 1.2. Kiểm tra kết quả
```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
-- Kỳ vọng: doanh_thu_xa, doanh_thu_tinh, lich_su_doanh_thu

select tgname from pg_trigger where tgrelid = 'public.doanh_thu_xa'::regclass;
-- Kỳ vọng: trg_doanh_thu_xa_history, trg_doanh_thu_xa_rollup
```

### 1.3. Test cộng dồn + lịch sử (chạy tay)
```sql
insert into public.doanh_thu_xa (ma_xa, ma_tinh, ten_xa, gia_tri)
values ('TEST-01', 'TEST-TINH', 'Xã Test', 1000)
on conflict (ma_xa) do update set gia_tri = 1500;

select * from public.doanh_thu_tinh    where ma_tinh = 'TEST-TINH';   -- gia_tri = 1500
select * from public.lich_su_doanh_thu where ma_xa   = 'TEST-01';     -- 2 dòng: 0→1000, 1000→1500

delete from public.doanh_thu_xa where ma_xa = 'TEST-01';              -- dọn dẹp
```

### 1.4. Bật Realtime (đã tự động trong migration)
Migration đã: `replica identity full` + thêm 3 bảng vào publication `supabase_realtime`.
Nếu muốn kiểm tra bằng UI: **Database → Replication → supabase_realtime** xem 3 bảng đã bật.

---

## 2. Triển khai Edge Function `sync-revenue`

### 2.1. Cài Supabase CLI & đăng nhập
```bash
npm i -g supabase            # hoặc: scoop install supabase
supabase login
supabase link --project-ref pwigtwkfywmjxvpknvae
```

### 2.2. Khai báo Secret Token toàn hệ thống
```bash
supabase secrets set SYNC_SECRET_TOKEN="doi-mot-chuoi-ngau-nhien-that-dai-2024"
# SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY do Supabase tự inject, KHÔNG cần set.
```
> Có thể tạo thêm token riêng cho từng xã trong bảng `nguon_dong_bo` (xem mục 3.2) — function
> sẽ chấp nhận **token toàn hệ thống HOẶC token riêng của xã**.

### 2.3. Deploy function
```bash
supabase functions deploy sync-revenue --no-verify-jwt
```
> `--no-verify-jwt` cho phép website nguồn (không có JWT) gọi được. Bảo mật do **Secret Token**
> đảm nhiệm. Nếu muốn chặn cả ở tầng JWT, hãy tạo API key riêng thay vì tắt.

### 2.4. Test function bằng curl
```bash
curl -X POST "https://pwigtwkfywmjxvpknvae.supabase.co/functions/v1/sync-revenue" \
  -H "Content-Type: application/json" \
  -H "x-sync-token: doi-mot-chuoi-ngau-nhien-that-dai-2024" \
  -d '{"ma_xa":"TEST-01","ma_tinh":"TEST-TINH","ten_xa":"Xã Test","gia_tri":2000}'
# -> {"success":true,"changed":true,"ma_xa":"TEST-01","tong_tinh":2000,...}
```

---

## 3. Bảo mật luồng dữ liệu

### 3.1. Secret Token toàn hệ thống
Token nằm trong header `x-sync-token`. Edge Function so sánh bằng **SHA-256 constant-time**
(chống timing attack). So sánh chuỗi ngây thơ (`===`) có thể rò rỉ thông tin qua thời gian phản hồi.

Đổi token khi nghi ngờ lộ:
```bash
supabase secrets set SYNC_SECRET_TOKEN="chuoi-moi-2025"
supabase functions deploy sync-revenue --no-verify-jwt
```

### 3.2. Token riêng cho từng xã (khuyến nghị)
API nội bộ `/api/v1/revenue/source` sinh token 64 ký tự hex và lưu vào bảng `nguon_dong_bo`
(không mở cho anon). Mỗi xã có token riêng → lộ token 1 xã không ảnh hưởng xã khác.

```sql
-- Xem cấu hình (chỉ chạy trong SQL Editor / service_role)
select ma_xa, ma_tinh, url_nguon, active, left(secret_token, 8) || '…' as token_preview
from public.nguon_dong_bo order by updated_at desc;

-- Vô hiệu hoá 1 xã
update public.nguon_dong_bo set active = false where ma_xa = '89398';
```

### 3.3. Phòng chống tấn công
- **RLS**: dashboard (`anon`) chỉ được `SELECT`. Mọi ghi đi qua Edge Function (`service_role`).
- **Chống spam**: Edge Function bỏ qua nếu `gia_tri` không đổi; JS nhúng có debounce 300ms + retry có backoff.
- **HTTPS only**: chỉ nhúng script trên website `https://`.
- **Khuyến nghị production**: đặt rate-limit ở tầng Cloudflare/API Gateway, và bọc
  `/api/v1/revenue/source` bằng xác thực admin phía server.

---

## 4. Nhúng mã theo dõi vào Website Nguồn

### 4.1. Cách 1 — gắn thuộc tính `data-*` (đơn giản nhất)
Dán vào thẻ `<head>`:
```html
<script
  src="https://<dashboard-domain>/doanh-thu-sync.js"
  data-endpoint="https://pwigtwkfywmjxvpknvae.supabase.co/functions/v1/sync-revenue"
  data-ma-xa="89398"
  data-ma-tinh="89"
  data-token="<SECRET_TOKEN>"
  data-debug="false"
  defer></script>
```

### 4.2. Cách 2 — cấu hình qua JS (giấu token khỏi attribute)
```html
<script>
  window.DOANH_THU_SYNC = {
    endpoint: "https://pwigtwkfywmjxvpknvae.supabase.co/functions/v1/sync-revenue",
    maXa: "89398",
    maTinh: "89",
    token: "<?= $SECRET_TOKEN ?>",       // server-side render để không lộ trong JS
    selector: "p.chuxanh.tongtienthu",
    attribute: "data-value",
    debounceMs: 300
  };
</script>
<script src="https://<dashboard-domain>/doanh-thu-sync.js" defer></script>
```

### 4.3. Cơ chế theo dõi
`doanh-thu-sync.js` sẽ:
1. `document.querySelector("p.chuxanh.tongtienthu")` (chờ tối đa 10s nếu SPA render trễ).
2. Gắn `MutationObserver` theo dõi **`attributes`** `data-value` (+ `childList`/`characterData` dự phòng).
3. Khi đổi → **debounce 300ms** → `fetch POST` với header `x-sync-token`.
4. Chỉ gửi khi giá trị thực sự đổi; lỗi mạng thì retry 3 lần (backoff 1s/2s/4s).
5. Gửi giá trị đầu tiên ngay khi tải trang.

### 4.4. API công khai (khi cần gọi thủ công)
```js
window.DoanhThuSync.read();                   // -> 154000000
window.DoanhThuSync.push(154000000);          // gửi thủ công
window.DoanhThuSync.refresh();                // đọc lại DOM rồi gửi
```

### 4.5. Định dạng số được hỗ trợ
`154000000`, `"154.000.000"`, `"154,000,000"`, `"154 000 000"`, `"1,5"` (thập phân) — đều parse đúng.

---

## 5. Realtime trên Dashboard

### 5.1. Đã tích hợp sẵn trong Khối B3
`b3-revenue-section.tsx` tự động:
- **Dashboard Xã** → nghe kênh `doanh_thu_xa` (filter `ma_xa=eq.<Mã Xã>`) → cập nhật dải "Doanh thu hiện tại (push)".
- **Dashboard Tỉnh** → nghe kênh `doanh_thu_tinh` (filter `ma_tinh=eq.<Mã Tỉnh>`) → cập nhật "Tổng doanh thu toàn Tỉnh".
- Hiển thị badge trạng thái: `Realtime` (xanh) / `Đang kết nối` (vàng) / `Realtime lỗi` (đỏ).
- Hiệu ứng "nhảy số" bằng class `flash-up` (mỗi sự kiện đổi `key={pulse}` để replay animation).

### 5.2. Cơ chế ngầm (nếu muốn tự dựng lại)
```ts
import { supabase } from "@/lib/supabase";

const channel = supabase
  .channel("revenue:xa-89398")
  .on("postgres_changes",
      { event: "*", schema: "public", table: "doanh_thu_xa", filter: "ma_xa=eq.89398" },
      (payload) => { console.log(payload.new); /* cập nhật state */ })
  .subscribe((status) => console.log(status));   // SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT

// cleanup
supabase.removeChannel(channel);
```

---

## 6. Trigger cộng dồn cấp Tỉnh (PL/pgSQL)

Migration đã tạo 2 trigger trên `doanh_thu_xa`:

| Trigger | Thời điểm | Việc làm |
|---|---|---|
| `trg_doanh_thu_xa_history` | AFTER INSERT/UPDATE | Ghi log vào `lich_su_doanh_thu` (**chỉ khi giá trị đổi**) |
| `trg_doanh_thu_xa_rollup` | AFTER INSERT/UPDATE/DELETE | `SUM(gia_tri)` theo `ma_tinh` → UPSERT vào `doanh_thu_tinh` |

Hàm cộng dồn (rút gọn):
```sql
create or replace function public.fn_tong_hop_doanh_thu_tinh(p_ma_tinh text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_ma_tinh is null or p_ma_tinh = '' then return; end if;

  insert into public.doanh_thu_tinh (ma_tinh, gia_tri, so_xa, updated_at)
  select p_ma_tinh, coalesce(sum(gia_tri), 0), count(*)::int, now()
  from public.doanh_thu_xa where ma_tinh = p_ma_tinh
  on conflict (ma_tinh) do update
    set gia_tri = excluded.gia_tri, so_xa = excluded.so_xa, updated_at = excluded.updated_at;
end; $$;
```
> **Lưu ý an ninh:** dùng `security definer` + `set search_path = public, pg_temp` để tránh
> search_path injection. Trigger truy cập `old`/`new` **đúng theo `TG_OP`** (record chưa gán sẽ lỗi).

**Tinh chỉnh hiệu năng khi dữ liệu lớn:** nếu mỗi lần cập nhật phải SUM hàng nghìn xã, hãy
chuyển sang cộng dồn gia tăng (delta) hoặc dùng `statement-level` trigger gom theo lô:
```sql
-- Gợi ý: dùng cột delta và BEFORE/AFTER statement trigger, hoặc job định kỳ
-- refresh materialized view. Với quy mô ~100 xã, trigger row-level hiện tại là đủ nhanh.
```

---

## 7. Luồng Dashboard Tỉnh (tự động cộng dồn)

1. Xã A push `gia_tri` mới → Edge Function UPSERT `doanh_thu_xa` (có `ma_tinh='89'`).
2. `trg_doanh_thu_xa_rollup` chạy `SUM` cho `ma_tinh='89'` → cập nhật `doanh_thu_tinh`.
3. `doanh_thu_tinh` nằm trong publication Realtime → phát sự kiện.
4. Dashboard Tỉnh (đang nghe `filter: ma_tinh=eq.89`) nhận sự kiện → cập nhật con số tức thời.

**Xác định `ma_tinh` tự động:** nếu client không gửi `ma_tinh`, Edge Function tra
`administrative_units` (theo `code` hoặc `id`) → `parent_id` → lấy `code`/`id` của đơn vị Tỉnh.
Client cũng có thể gửi thẳng `ma_tinh` trong payload / cấu hình qua nút "Thiết lập doanh thu".

---

## 8. Kiểm thử End-to-End

### 8.1. Test bằng curl (không cần website nguồn)
```bash
TOKEN="doi-mot-chuoi-ngau-nhien-that-dai-2024"
URL="https://pwigtwkfywmjxvpknvae.supabase.co/functions/v1/sync-revenue"

curl -X POST "$URL" -H "Content-Type: application/json" -H "x-sync-token: $TOKEN" \
  -d '{"ma_xa":"89398","ma_tinh":"89","ten_xa":"Phường Mỹ Bình","gia_tri":154000000}'
# -> {"success":true,"changed":true,...,"tong_tinh":154000000,"so_xa":1}

curl -X POST "$URL" -H "Content-Type: application/json" -H "x-sync-token: $TOKEN" \
  -d '{"ma_xa":"89398","gia_tri":154000000}'
# -> {"success":true,"changed":false,"deduped":true,...}   (chống spam hoạt động)

curl -X POST "$URL" -H "Content-Type: application/json" -H "x-sync-token: SAI_TOKEN" \
  -d '{"ma_xa":"89398","gia_tri":1}'
# -> 401 {"error":"Sai hoặc thiếu Secret Token"}
```

### 8.2. Test trên website nguồn
Mở Console của trang nguồn và chạy:
```js
document.querySelector("p.chuxanh.tongtienthu").setAttribute("data-value", "200000000");
// Sau ~300ms: Console log "[doanh-thu-sync] Đã đồng bộ: 89398 = 200000000"
window.DoanhThuSync.read();   // -> 200000000
```

### 8.3. Test Realtime
Mở Dashboard trên 2 tab; chạy lại lệnh curl → cả 2 tab "nhảy số" không cần F5.

---

## 9. Vận hành & Checklist

- [ ] Đã chạy migration `0007` và kiểm tra 3 bảng có trong `supabase_realtime`.
- [ ] Đã `supabase secrets set SYNC_SECRET_TOKEN=...`.
- [ ] Đã `supabase functions deploy sync-revenue --no-verify-jwt`.
- [ ] Đã bấm **"Thiết lập doanh thu"** trên Dashboard Xã (sinh token riêng) và copy mã nhúng.
- [ ] Đã dán mã nhúng vào `<head>` website nguồn (HTTPS).
- [ ] Đã xác nhận Dashboard Xã & Tỉnh "nhảy số" theo thời gian thực.
- [ ] Đã xem **Lịch sử** để đối chiếu biến động `data-value`.

**Troubleshooting nhanh**

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| `401` | Sai/thiếu `x-sync-token`; hoặc `SYNC_SECRET_TOKEN` chưa set. |
| `404` khi gọi function | Sai URL, hoặc chưa deploy. |
| Lỗi CORS | Function chưa trả `Access-Control-Allow-*` (đã có `OPTIONS` 204 trong code). |
| Đã có dữ liệu nhưng Dashboard không nhảy | Bảng chưa được thêm vào publication Realtime (chạy lại mục 9 của migration). |
| Bảng `doanh_thu_*` không tồn tại | Chưa chạy migration `0007`. |
| Trigger lỗi `record new is not assigned` | Đã sửa trong migration (truy cập `old`/`new` theo `TG_OP`). |


