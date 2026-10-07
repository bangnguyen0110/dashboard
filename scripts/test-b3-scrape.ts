/**
 * ============================================================================
 * scripts/test-b3-scrape.ts — TEST CÀO NHIỀU URL + CỘNG TỔNG (Yêu cầu 1)
 * ----------------------------------------------------------------------------
 * Chạy:  npx tsx scripts/test-b3-scrape.ts   (hoặc: npm run test:b3)
 * Dựng 1 HTTP server nội bộ làm "web nguồn", rồi kiểm chứng:
 *   - buildTargets gộp MẢNG `settings.revenue.b3_urls` (+ url_nguon legacy)
 *     vào target `daily`;
 *   - scrapeTarget chạy Promise.all qua toàn bộ URL, bóc `data-value`
 *     và CỘNG TỔNG thành `total_scraped_value`;
 *   - URL lỗi một phần -> vẫn cộng tổng được URL tốt (vào warnings);
 *   - toàn bộ URL lỗi -> status error.
 * ============================================================================
 */
import http from "node:http";
import { normalizeUrlList, readRevenueSourceUrls } from "@/lib/revenue-sync";

let failed = 0;
let passed = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}  ->  ${JSON.stringify(extra)}`);
  }
}

const PAGES: Record<string, string> = {
  "/a": `<html><p class="chuxanh tongtienthu" data-value="1000">1000</p></html>`,
  "/b": `<html><p class="chuxanh tongtienthu" data-value="500">500</p></html>`,
  "/broken": `<html><p>trang không có data-value</p></html>`,
};

async function main(): Promise<void> {
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const page = PAGES[path];
    if (page) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(8791, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:8791";

  // Import SAU khi đặt env (lib/supabase tạo client ngay lúc import).
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon-dummy";
  const { buildTargets, scrapeTarget } = await import("@/lib/b3-scraper");

  try {
    console.log("S1: buildTargets với MẢNG b3_urls");
    const dash1 = {
      id: "dash-1",
      settings: {
        revenue: {
          b3_urls: [`${base}/a`, `${base}/b`, `${base}/broken`],
          url_nguon: `${base}/a/`, // trùng sau khi chuẩn hoá -> bỏ
        },
      },
    };
    const t1 = buildTargets(dash1, []);
    check("sinh đúng 1 target daily", t1.length === 1 && t1[0].field === "daily", t1);
    check(
      "target.urls = 3 URL (url_nguon trùng bị loại)",
      t1[0]?.urls.length === 3,
      t1[0]?.urls
    );
    check(
      "readRevenueSourceUrls đọc đủ mảng",
      readRevenueSourceUrls(dash1).length === 3,
      readRevenueSourceUrls(dash1)
    );

    console.log("S2: scrapeTarget -> Promise.all + CỘNG TỔNG");
    const r1 = await scrapeTarget(t1[0]);
    check("total_scraped_value = 1000 + 500 = 1500", r1.newValue === 1500, r1.newValue);
    check("status = changed", r1.status === "changed", r1.status);
    check(
      "URL lỗi (/broken) vào warnings, không chặn luồng",
      (r1.warnings ?? []).length === 1,
      r1.warnings
    );

    console.log("S3: link b3_daily có target_url riêng -> gộp vào mảng");
    const t2 = buildTargets(
      { id: "dash-2", settings: { revenue: { b3_urls: [`${base}/a`] } } },
      [
        {
          dashboard_id: "dash-2",
          metric_key: "b3_daily",
          target_url: `${base}/b`,
          current_value: 100,
        },
      ]
    );
    check("gộp communeUrls + linkUrl = 2 URL", t2.length === 1 && t2[0].urls.length === 2, t2[0]?.urls);
    const r2 = await scrapeTarget(t2[0]);
    check("tổng = 1500", r2.newValue === 1500, r2.newValue);
    check("prevValue lấy theo last_raw_value/current_value", t2[0].prevValue === 100, t2[0].prevValue);

    console.log("S4: link KHÁC daily (b3_weekly) giữ đúng 1 URL riêng");
    const t3 = buildTargets({ id: "dash-3" }, [
      { dashboard_id: "dash-3", metric_key: "b3_weekly", target_url: `${base}/b`, current_value: null },
    ]);
    check("chỉ 1 target, 1 URL", t3.length === 1 && t3[0].urls.length === 1, t3[0]?.urls);
    const r3 = await scrapeTarget(t3[0]);
    check("value = 500 (không cộng URL của xã)", r3.newValue === 500, r3.newValue);

    console.log("S5: toàn bộ URL lỗi -> status error");
    const t4 = buildTargets({ id: "dash-4", settings: { revenue: { b3_urls: [`${base}/broken`] } } }, []);
    const r4 = await scrapeTarget(t4[0]);
    check("error + newValue null", r4.status === "error" && r4.newValue === null, r4);

    console.log("S6: URL không tồn tại (HTTP 404) -> error");
    const t5 = buildTargets({ id: "dash-5", settings: { revenue: { b3_urls: [`${base}/khong-ton-tai`] } } }, []);
    const r5 = await scrapeTarget(t5[0]);
    check("HTTP 404 -> error", r5.status === "error", r5.error);

    console.log("S7: helper normalizeUrlList (bỏ trùng/ rỗng)");
    check(
      "dedupe theo khoá không phân biệt hoa/thường + slash cuối",
      JSON.stringify(normalizeUrlList([`${base}/a`, `${base}/a/`, "", "X"])) ===
        JSON.stringify([`${base}/a`, "X"]),
      normalizeUrlList([`${base}/a`, `${base}/a/`, "", "X"])
    );
  } finally {
    // Đóng server xong hẳn trước khi exit (tránh assertion libuv trên Windows).
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(`\n==== KẾT QUẢ: ${passed} passed, ${failed} failed ====`);
  // KHÔNG process.exit() ở đây: để event loop (socket keep-alive của fetch)
  // tự thoát — tránh crash libuv trên Windows khi đóng handle đang closing.
  process.exitCode = failed > 0 ? 1 : 0;
}

void main();
