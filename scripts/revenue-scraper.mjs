#!/usr/bin/env node
/**
 * ============================================================================
 * scripts/revenue-scraper.mjs — LUỒNG CHẠY NGẦM CÀO DOANH THU LIÊN TỤC
 * ----------------------------------------------------------------------------
 * Vòng lặp vô hạn: mỗi `SCRAPER_INTERVAL_SEC` giây gọi endpoint
 * `GET /api/v1/revenue/scrape` (đã đọc DB danh sách URL + cào + so sánh + ghi).
 *
 * Endpoint cào tuân theo đúng kịch bản: tìm thẻ
 *   <p class="chuxanh tongtienthu" data-value="">0</p>
 * -> nếu data-value ĐỔI thì ghi số mới -> trigger DB tự ghi lịch sử + cộng dồn
 *    tỉnh -> Supabase Realtime phát cho Dashboard (không cần F5).
 *
 * CÁCH DÙNG (chạy nền, KHÔNG ảnh hưởng web):
 *   node scripts/revenue-scraper.mjs                 # chạy mãi, mỗi 60s
 *   SCRAPER_INTERVAL_SEC=30 node scripts/revenue-scraper.mjs
 *   SCRAPER_ONESHOT=1 node scripts/revenue-scraper.mjs   # cào 1 lần rồi thoát
 *   SCRAPER_BASE_URL=https://dashboard.example.com node scripts/revenue-scraper.mjs
 *
 * Biến môi trường (đọc tự động từ .env.local nếu có):
 *   SCRAPER_BASE_URL       (mặc định http://localhost:3000)
 *   SCRAPER_INTERVAL_SEC   (mặc định 60)
 *   SCRAPER_ONESHOT        ("1" = chạy 1 lần)
 *   CRON_SECRET / CRON_JOB_SECRET  (gửi kèm header x-cron-secret nếu được set)
 * ============================================================================
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Đọc file .env.local và nạp biến chưa tồn tại vào process.env (không cần thư viện). */
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const BASE_URL = (process.env.SCRAPER_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const INTERVAL_SEC = Math.max(5, Number(process.env.SCRAPER_INTERVAL_SEC || 60));
const ONESHOT = process.env.SCRAPER_ONESHOT === "1";
const SECRET = process.env.CRON_SECRET || process.env.CRON_JOB_SECRET || "";
const ENDPOINT = `${BASE_URL}/api/v1/revenue/scrape`;

const stamp = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Gọi 1 lượt cào; trả về summary hoặc ném lỗi. */
async function runOnce() {
  const headers = { Accept: "application/json" };
  if (SECRET) headers["x-cron-secret"] = SECRET;

  const res = await fetch(ENDPOINT, { method: "GET", headers, cache: "no-store" });
  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  console.log(
    `[${stamp()}] ✅ Đã cào ${data.scanned} xã · thay đổi: ${data.changed} · ` +
      `không đổi: ${data.unchanged} · lỗi: ${data.errors} · ${data.durationMs}ms`
  );

  // In chi tiết các xã vừa thay đổi để dễ đối chiếu
  const changed = (data.results || []).filter((r) => r.status === "ok");
  for (const r of changed) {
    console.log(`   ↳ ${r.maXa}: ${r.oldValue} → ${r.newValue}`);
  }

  return data;
}

async function main() {
  console.log(`[${stamp()}] 🚀 Scraper doanh thu khởi động · endpoint: ${ENDPOINT}`);
  console.log(
    `[${stamp()}]    chu kỳ: ${INTERVAL_SEC}s · ${ONESHOT ? "chạy 1 lần" : "chạy liên tục"}` +
      `${SECRET ? " · đã có CRON_SECRET" : " · KHÔNG có CRON_SECRET"}`
  );

  do {
    try {
      await runOnce();
    } catch (err) {
      console.error(`[${stamp()}] ❌ Lỗi lượt cào: ${err?.message || err}`);
    }
    if (ONESHOT) break;
    await sleep(INTERVAL_SEC * 1000);
  } while (true);
}

// Dừng êm khi nhận Ctrl+C / SIGTERM (không cắt giữa lượt cào)
process.on("SIGINT", () => {
  console.log(`\n[${stamp()}] ⏹  Đã dừng scraper (SIGINT).`);
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log(`\n[${stamp()}] ⏹  Đã dừng scraper (SIGTERM).`);
  process.exit(0);
});

main();