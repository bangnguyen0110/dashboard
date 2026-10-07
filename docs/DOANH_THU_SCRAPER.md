# Luồng cào (PULL) doanh thu tự động — DOANH THU SCRAPER

> Tài liệu triển khai cho luồng **đọc / kéo (pull)** dữ liệu doanh thu.
> Bổ sung cho luồng **đẩy (push)** đã có tại [`DOANH_THU_REALTIME.md`](./DOANH_THU_REALTIME.md).

## 1. Vì sao cần luồng này?

Luồng **push** (mọi máy chạy `public/doanh-thu-sync.js` sẽ tự động gửi số lên
Edge Function) hoạt động tốt, nhưng **bắt buộc trình duyệt của máy hành chính
phải mở Dashboard suốt ngày**. Khi tắt tab thì dữ liệu không được gửi.

Luồng **cào** giải quyết việc đó bằng cách chương trình chạy nền (cron/worker)
**tự chủ động** mở URL nguồn đã thiết lập, đọc thẻ tổng tiền thu và ghi số mới
vào DB. Không cần ai mở trình duyệt, không cần máy hành chính bật tab.

```
┌──────────────────────┐  cron / worker mỗi 60s   ┌──────────────────────────┐
│ scripts/             │  GET /api/v1/revenue/    │ Site nguồn (URL đã lưu   │
│ revenue-scraper.mjs  │ ──────────────────────►  │ trong nguon_dong_bo)     │
│ (hoặc Vercel Cron)   │        scrape            │                          │
└──────────────────────┘                          │ <p class="chuxanh        │
                                                  │      tongtienthu         │
                                                  │      data-value=154000000│
                                                  │ >0</p>                   │
                                                  └────────────┬─────────────┘
                                                               │ bóc data-value
                                                               ▼
                                                 ┌──────────────────────────┐
                                                 │ lib/revenue-scraper.ts   │
                                                 │ (so sánh với số cũ)      │
                                                 └────────────┬─────────────┘
                                                              │ chỉ ghi khi ĐỔI
                                                              ▼
                                                 ┌──────────────────────────┐
                                                 │ doanh_thu_xa             │
                                                 │   ↑ trigger 0007         │
                                                 │   ├ lich_su_doanh_thu    │
                                                 │   └ doanh_thu_tinh (SUM) │
                                                 └────────────┬─────────────┘
                                                              │ Realtime
                                                              ▼
                                                 Khối B3 trên Dashboard
```

**Quan trọng:** Ghi số liệu **Chỉ khi giá trị THAY ĐỔ**. Nếu không đổi, chỉ ghi
`last_scraped_at` vào bảng cấu hình — **không sinh sự kiện Realtime**, nên:
- Realtime vẫn chạy mọi 60s (không có nhiễu),
- và bảng `lich_su_doanh_thu` không bị tràn bởi các bản ghi "y hệt nhau".

---

## 2. Các thành phần

| Thành phần | Vai trò |
|---|---|
| `supabase/migrations/0008_dashboard_xa_scraper.sql` | Thêm cột sức khỏe vào `nguon_dong_bo` + VIEW `dashboard_xa` |
| `lib/revenue-scraper.ts` | Logic thuần (server): tải URL → bóc `data-value` → so sánh → ghi |
| `app/api/v1/revenue/scrape/route.ts` | Endpoint được cron gọi (GET = tất cả, POST = 1 xã) |
| `scripts/revenue-scraper.mjs` | Vòng lặp chạy nền liên tục, gọi endpoint mỗi N giây |
| `lib/revenue-sync.ts` → `REVENUE_DASHBOARD_XA_VIEW` | Hằng `dashboard_xa` để đọc VIEW |

### 2.1 Cột sức khỏe (health) thêm cho `nguon_dong_bo`

| Cột | Ý nghĩa |
|---|---|
| `last_scraped_at` | Lần cào cuối cùng (ISO) |
| `last_status` | `ok` (có thay đổi & đã ghi) · `unchanged` · `error` |
| `last_value` | Giá trị đọc được lần cuối |
| `last_error` | Thông báo lỗi nếu `last_status = 'error'` |

Index `(ma_xa)` **partial** `WHERE active = true` giúp quét nguồn đang bật nhanh.

### 2.2 VIEW `dashboard_xa`

`FULL OUTER JOIN` giữa `nguon_dong_bo` và `doanh_thu_xa`:

```
ma_xa | url_nguon | active | last_scraped_at | last_status | value | updated_at | nguon
```

Dùng cho trang admin giám sát (xem URL nào đang lỗi). **Lưu ý:** đây là VIEW
(`CREATE OR REPLACE VIEW`) — không phải bảng, nên **không trùng dữ liệu** với
luồng push ghi trực tiếp vào `doanh_thu_xa`.

---

## 3. Triển khai

### Bước 1 — Chạy migration 0008

Mở **Supabase SQL Editor** → dán toàn bộ nội dung
`supabase/migrations/0008_dashboard_xa_scraper.sql` → **Run**.

Xác nhận:

```sql
select column_name from information_schema.columns
 where table_name = 'nguon_dong_bo'
   and column_name in ('last_scraped_at','last_status','last_value','last_error');
-- mong đợi: 4 dòng

select * from dashboard_xa limit 5;
```

### Bước 2 — Biến môi trường

`.env.local` (hoặc dashboard Vercel → Environment Variables):

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `CRON_SECRET` | Khuyến nghị | Secret gửi kèm `x-cron-secret` để chỉ cron hợp lệ được gọi |
| `SCRAPER_BASE_URL` | Với script | URL Dashboard, mặc định `http://localhost:3000` |
| `SCRAPER_INTERVAL_SEC` | Không | Chu kỳ (giây), mặc định `60`, tối thiểu `5` |
| `SCRAPER_ONESHOT` | Không | `1` = chạy 1 lượt rồi thoát (dùng cho systemd/PM2) |

> **An toàn:** `CRON_SECRET` chỉ nằm ở **server**. Không bao giờ đọc nó trong
> code phía client (đặc biệt trong `components/`).

### Bước 3 — Thử bằng tay (curl)

```bash
# 1) Chạy app
npm run dev

# 2) Cào TẤT CẢ nguồn đang bật (cần secret nếu đã set CRON_SECRET)
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/v1/revenue/scrape

# 3) Cào 1 xã (cùng origin — dùng cho nút "Cào ngay")
curl -X POST -H "Content-Type: application/json" \
     -d '{"maXa":"05914"}' http://localhost:3000/api/v1/revenue/scrape
```

Phản hồi mẫu:

```json
{
  "success": true,
  "trigger": "cron",
  "scanned": 1,
  "changed": 1,
  "unchanged": 0,
  "errors": 0,
  "durationMs": 742,
  "results": [
    { "maXa": "05914", "status": "ok", "oldValue": 150000000, "newValue": 154000000, "changed": true }
  ]
}
```

Kiểm tra cascading trong SQL Editor:

```sql
select * from doanh_thu_xa order by updated_at desc limit 1;
select * from lich_su_doanh_thu order by created_at desc limit 1;
select * from doanh_thu_tinh;   -- tổng đã cộng dồn
select ma_xa,last_status,last_value,last_scraped_at,last_error from nguon_dong_bo;
```

### Bước 4 — Chạy nền liên tục

**Cách A — script lặp (không cần hạ tầng thêm):**

```bash
node scripts/revenue-scraper.mjs
SCRAPER_INTERVAL_SEC=30 SCRAPER_BASE_URL=https://your-app.vercel.app node scripts/revenue-scraper.mjs
SCRAPER_ONESHOT=1 node scripts/revenue-scraper.mjs   # chạy 1 lần rồi thoát
```

Script tự đọc `.env.local` (không cần cài thêm thư viện), in log mỗi lượt, và
dừng êm khi nhận `SIGINT` / `SIGTERM` (không cắt giữa lượt cào).

Để chạy dưới nền thực thụ, dùng trình quản lý tiến trình bất kỳ:

```bash
# PM2 (Ubuntu)
pm2 start scripts/revenue-scraper.mjs --name revenue-scraper --interpreter node

# systemd: Restart=always + Environment=SCRAPER_BASE_URL=...
# khi đó nên set SCRAPER_ONESHOT=1 để hệ thống tự khởi động lại mỗi vòng.
```

**Cách B — Vercel Cron** (không cần máy chủ riêng) — `vercel.json`:

```json
{ "crons": [{ "path": "/api/v1/revenue/scrape", "schedule": "*/1 * * * *" }] }
```

Vercel gửi header `x-vercel-cron: 1` → endpoint tin tưởng. Lưu ý **hạn mức
Function count** của gói Vercel.

**Cách C — `pg_cron` trong Supabase:** chạy một hàm định kỳ gọi
`fetch('https://…/api/v1/revenue/scrape')` — giống cách đã làm với push pipeline.

### Bước 5 — Dùng nút "Cào ngay"

Mở Dashboard **cấp Xã** đã thiết lập URL nguồn (admin → nút
**"Thiết lập doanh thu"**) → khối **B3** → bấm **"Cào ngay"** (icon ⟳, admin only).

- App hiện `Đang cào...` → `Đã cập nhật N giá trị mới` / `Dữ liệu đã là mới nhất`.
- **Endpoint của nút này chấp nhận request cùng origin** (so `Origin` với `Host`)
  để không phải lộ `CRON_SECRET` ra client, đồng thời chặn kích hoạt chéo site.
- Không có nguồn đang bật → hiện `Chưa có nguồn đang bật`.

---

## 4. Push vs Pull — khi nào dùng cái nào?

| | Push (`doanh-thu-sync.js`) | Pull (scraper này) |
|---|---|---|
| Ai khởi xướng | Trình duyệt máy hành chính | Server / cron |
| Dùng 1 URL tĩnh (không cần token/JS) | ❌ (cần máy có console) | ✅ |
| Độ trễ | Gần như tức thời | Theo chu kỳ (60s…) |
| Không cần mở trình duyệt | ❌ | ✅ |
| Vẫn chạy khi tắt tab | ❌ | ✅ |

**Khuyến nghị: chạy cả hai.** Push cho độ trễ thấp, pull làm lớp đảm bảo
(backstop). Cả hai đều `UPSERT` theo `ma_xa` và trigger chỉ ghi lịch sử khi
`NEW <> OLD`, nên **không xung đột** — cùng ghi thì cũng chỉ 1 bản ghi lịch sử.

---

## 5. Sự cố thường gặp

| Triệu chứng | Nguyên nhân → Cách xử lý |
|---|---|
| 403 `sai CRON_SECRET` | Header `x-cron-secret` sai, hoặc `CRON_SECRET` env của server khác giá trị bạn gửi. |
| `errors: 1` + `Không tìm thấy thẻ … data-value` | DOM site nguồn đổi hoặc tải trang lỗi. Mở URL xem còn thẻ `tongtienthu` không; nếu class đổi → sửa `extractRevenueDataValue` trong `lib/revenue-scraper.ts`. |
| `HTTP 403/429` khi cào | Nguồn chặn bot / rate-limit → tăng `SCRAPER_INTERVAL_SEC`, hoặc giảm `DEFAULT_CONCURRENCY`. |
| `scanned: 0` | Không có dòng `active = true` **và** `url_nguon IS NOT NULL` → thiết lập lại URL nguồn. |
| Đổi `data-value` nhưng B3 không nhận | Xem mục **"Realtime: tại sao không nhận sự kiện?"** trong `DOANH_THU_REALTIME.md`. |
| Script thoát ngay | Cần Node ≥ 18 (có `fetch`) và app phải chạy tại `SCRAPER_BASE_URL`. |
| VIEW `dashboard_xa` chưa tồn tại | Migration 0008 chưa chạy / SQL bị cắt — chạy lại. |

---

## 6. Bảo mật & vận hành

- **Không lộ token ra client:** `CRON_SECRET` chỉ nằm ở server; không bao giờ
  import vào component phía client.
- **Token trong `nguon_dong_bo`:** bảng này chỉ được đọc khi đăng nhập
  (`policy_select`), **không** cấp policy cho `anon`.
- **SSRF:** scraper chỉ request **đúng URL đã lưu trong DB** (admin đã thiết
  lập); không nhận URL từ request → không thể dùng làm SSRF proxy.
- **Bounded work:** `runRevenueScrape({ limit })` giữ luồng dưới giới hạn 60s của
  serverless; pool song song mặc định 5, tối đa 10.
- **Không ghi khi không đổi:** tránh nhiễu Realtime và giữ
  `lich_su_doanh_thu` sạch (bảng này tăng theo số lần đổi, không theo số lần cào).
- **Tự phục hồi:** lượt lỗi sẽ được thử lại ở lượt sau; nếu nguồn hỏng kéo dài,
  `last_error` trên `nguon_dong_bo` cho biết để xử lý thủ công.
- **Giám sát:** truy vấn `select * from dashboard_xa where last_status = 'error'`.

---

## 7. NHIỀU URL NGUỒN + CỘNG DỒN LŨY KẾ (Khối B3)

### 7.1 Nhiều URL cho 1 xã/phường (Yêu cầu 1)

- **UI:** Modal *"Thiết lập doanh thu"* là **Dynamic Form** — nút **"Thêm URL"** /
  icon thùng rác để thêm/xóa bao nhiêu dòng URL tùy ý.
- **Lưu:**
  - `dashboards.settings.revenue.b3_urls` — mảng JSONB (Array of Strings),
    app luôn đọc/ghi nơi này;
  - `nguon_dong_bo.b3_urls` — **cột jsonb** (migration
    `0011_b3_urls_multi_source.sql`); `url_nguon` cũ = phần tử đầu tiên để
    VIEW/luồng push không vỡ.
- **Cào:** `lib/b3-scraper.ts` dựng target cho thẻ `daily` gồm toàn bộ mảng URL
  rồi `Promise.all` → bóc `data-value` từng trang → **CỘNG TỔNG** thành biến
  `total_scraped_value` duy nhất. URL lỗi một phần vẫn tổng hợp được URL tốt
  (vào `warnings`); mọi URL mới lỗi thì báo `error`.

```bash
# Chạy migration (Supabase SQL Editor -> Run):
#   supabase/migrations/0011_b3_urls_multi_source.sql
```

### 7.2 Thuật toán reset + cộng dồn (Yêu cầu 2)

`lib/b3-revenue.ts` — `accumulateB3ScrapedValue(total_scraped_value)`:

1. Fetch object B3 hiện tại `{ daily, weekly, monthly, quarterly, yearly,
   last_updated, last_raw_value }`;
2. `now` theo **múi giờ GMT+7** (dayjs + `Asia/Ho_Chi_Minh`);
3. **Reset đúng kỳ** (chỉ reset mốc tương ứng, không đụng mốc khác):
   `isSameDay/ISO-week/Month/Quarter/Year == false` → mốc đó = 0;
4. `delta = total_scraped_value - last_raw_value`; nếu `delta < 0` (web nguồn
   reset số) → `delta = total_scraped_value`;
5. Cả 5 thẻ `+= delta`;
6. Lưu `last_updated = now` (GMT+7) + `last_raw_value = total_scraped_value`.

> Kết quả: sang ngày mới chỉ có `daily` reset, tuần/tháng/quý/năm vẫn giữ số
> đã tích lũy và cộng delta mới.

### 7.3 Test

```bash
npm run test:b3    # 53 assertion thuật toán + 14 assertion cào nhiều URL
```


---



