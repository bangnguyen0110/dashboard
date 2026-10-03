import { getSupabaseAdmin } from "@/lib/supabase";
import { errorMessage } from "@/lib/server-utils";
import { REVENUE_SOURCE_TABLE, REVENUE_XA_TABLE } from "@/lib/revenue-sync";

/**
 * ============================================================================
 * lib/revenue-scraper.ts — LUỒNG CÀO (PULL) DOANH THU TỰ ĐỘNG  [SERVER-ONLY]
 * ----------------------------------------------------------------------------
 * Đọc URL đã thiết lập (bảng `nguon_dong_bo`), cào thẻ:
 *     <p class="chuxanh tongtienthu" data-value="">0</p>
 * lấy `data-value`, SO SÁNH với số cũ trong `doanh_thu_xa`:
 *   - Nếu ĐỔI  -> ghi số mới (nguồn 'scraper') -> trigger 0007 tự ghi
 *                 `lich_su_doanh_thu` + cộng dồn `doanh_thu_tinh`.
 *   - Nếu KHÔNG -> chỉ cập nhật "trạng thái cào", không sinh sự kiện Realtime.
 *
 * File này CHỈ dùng service_role (server). KHÔNG import vào component client.
 * ============================================================================
 */

export interface RevenueScrapeResult {
  maXa: string;
  /** ok = có thay đổi và đã ghi; unchanged = không đổi; error = lỗi cào/parse. */
  status: "ok" | "unchanged" | "error";
  oldValue: number;
  newValue: number | null;
  changed: boolean;
  error?: string;
}

export interface RevenueScrapeSummary {
  scanned: number;
  changed: number;
  unchanged: number;
  errors: number;
  durationMs: number;
  results: RevenueScrapeResult[];
}

/** Ghi chú: giá trị này là doanh thu nên đơn vị là VNĐ, làm tròn về số nguyên. */
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CONCURRENCY = 5;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Lấy giá trị một thuộc tính trong chuỗi thẻ mở (hỗ trợ " ", ' ', không nháy). */
function extractTagAttribute(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

/**
 * Parse số theo định dạng Việt Nam ("1.234.567" / "1,5" / "154 000").
 * Trả về null nếu không đọc được.
 */
export function parseVnNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;

  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[^0-9.,-]/g, "");
  if (!s || s === "-") return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decSep = "";

  if (lastDot > -1 && lastComma > -1) {
    decSep = lastDot > lastComma ? "." : ",";
  } else if (lastComma > -1) {
    const parts = s.split(",");
    decSep = parts.length === 2 && parts[1].length !== 3 ? "," : "";
  } else if (lastDot > -1) {
    const parts = s.split(".");
    decSep = parts.length === 2 && parts[1].length !== 3 ? "." : "";
  }

  if (decSep) {
    const idx = s.lastIndexOf(decSep);
    s = `${s.slice(0, idx).replace(/[.,]/g, "")}.${s.slice(idx + 1).replace(/[.,]/g, "")}`;
  } else {
    s = s.replace(/[.,]/g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tìm chính xác thẻ `<p class="chuxanh tongtienthu" data-value="...">` và
 * trích `data-value`. Nếu thẻ không có data-value (rỗng) thì đọc nội dung text
 * bên trong thẻ `<p>` đó làm phương án dự phòng.
 */
export function extractRevenueDataValue(html: string): number | null {
  if (!html) return null;

  // Tìm mọi thẻ <p ...> rồi lọc theo class chứa đồng thời "chuxanh" và "tongtienthu".
  const pTagRe = /<p\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = pTagRe.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const classValue = (extractTagAttribute(attrs, "class") ?? "").toLowerCase();
    const classes = classValue.split(/\s+/).filter(Boolean);

    if (!classes.includes("chuxanh") || !classes.includes("tongtienthu")) continue;

    // Ưu tiên tuyệt đối: thuộc tính data-value
    const dataValue = extractTagAttribute(attrs, "data-value");
    const parsed = parseVnNumber(dataValue);
    if (parsed !== null) return parsed;

    // Dự phòng: đọc text giữa <p>...</p>
    const startIndex = pTagRe.lastIndex;
    const closeIndex = html.indexOf("</p>", startIndex);
    if (closeIndex > -1) {
      const inner = html.slice(startIndex, closeIndex).replace(/<[^>]+>/g, " ");
      const fromText = parseVnNumber(inner);
      if (fromText !== null) return fromText;
    }
  }

  return null;
}

/** Tải nội dung HTML của URL nguồn (có timeout + User-Agent giống trình duyệt). */
export async function fetchSourceHtml(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Chuẩn hoá URL: thêm https:// nếu thiếu scheme. */
export function normalizeSourceUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

/** Cấu trúc cấu hình nguồn đọc từ bảng `nguon_dong_bo`. */
interface NguonRow {
  ma_xa: string;
  ma_tinh: string | null;
  url_nguon: string | null;
}

/** Cập nhật "trạng thái cào" (KHÔNG sinh sự kiện Realtime vì bảng này ngoài publication). */
async function markScrapeStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  maXa: string,
  status: "ok" | "unchanged" | "error",
  lastValue: number | null,
  lastError: string | null
): Promise<void> {
  try {
    await supabase
      .from(REVENUE_SOURCE_TABLE)
      .update({
        last_scraped_at: new Date().toISOString(),
        last_status: status,
        last_value: lastValue,
        last_error: lastError,
      })
      .eq("ma_xa", maXa);
  } catch {
    // Bỏ qua: không làm hỏng luồng cào chính nếu ghi trạng thái lỗi.
  }
}

/** Cào + so sánh + ghi cho MỘT xã. */
async function scrapeOne(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  row: NguonRow
): Promise<RevenueScrapeResult> {
  const maXa = row.ma_xa;

  // 1) Đọc giá trị cũ trong DB
  const { data: current } = await supabase
    .from(REVENUE_XA_TABLE)
    .select("ma_xa, gia_tri")
    .eq("ma_xa", maXa)
    .maybeSingle();
  const oldValue = Number((current as { gia_tri?: number } | null)?.gia_tri ?? 0);

  const url = normalizeSourceUrl(row.url_nguon);
  if (!url) {
    const message = "Chưa thiết lập URL nguồn";
    await markScrapeStatus(supabase, maXa, "error", oldValue, message);
    return { maXa, status: "error", oldValue, newValue: null, changed: false, error: message };
  }

  try {
    // 2) Cào HTML và bóc `data-value` của thẻ tongtienthu
    const html = await fetchSourceHtml(url);
    const newValue = extractRevenueDataValue(html);

    if (newValue === null) {
      const message = "Không tìm thấy thẻ <p class=\"chuxanh tongtienthu\"> data-value";
      await markScrapeStatus(supabase, maXa, "error", oldValue, message);
      return { maXa, status: "error", oldValue, newValue: null, changed: false, error: message };
    }

    // 3) Không đổi -> không ghi, không sinh sự kiện Realtime
    if (newValue === oldValue) {
      await markScrapeStatus(supabase, maXa, "unchanged", newValue, null);
      return { maXa, status: "unchanged", oldValue, newValue, changed: false };
    }

    // 4) Đổi -> ghi số mới (upsert để xử lý cả khi chưa có dòng)
    //    Trigger 0007 sẽ tự ghi `lich_su_doanh_thu` + cộng dồn `doanh_thu_tinh`.
    const { error: upsertError } = await supabase.from(REVENUE_XA_TABLE).upsert(
      {
        ma_xa: maXa,
        ma_tinh: row.ma_tinh,
        gia_tri: newValue,
        url_nguon: row.url_nguon,
        nguon: "scraper",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ma_xa" }
    );

    if (upsertError) {
      const message = `Ghi doanh_thu_xa thất bại: ${upsertError.message}`;
      await markScrapeStatus(supabase, maXa, "error", oldValue, message);
      return { maXa, status: "error", oldValue, newValue, changed: false, error: message };
    }

    await markScrapeStatus(supabase, maXa, "ok", newValue, null);
    return { maXa, status: "ok", oldValue, newValue, changed: true };
  } catch (err) {
    const message = errorMessage(err, "Lỗi cào dữ liệu");
    await markScrapeStatus(supabase, maXa, "error", oldValue, message);
    return { maXa, status: "error", oldValue, newValue: null, changed: false, error: message };
  }
}

export interface RunRevenueScrapeOptions {
  /** Chỉ cào 1 xã (dùng cho nút "Cào ngay"). Bỏ trống = cào tất cả. */
  maXa?: string | null;
  /** Số URL cào song song (mặc định 5, tối đa 10). */
  concurrency?: number;
  /** Giới hạn số nguồn xử lý mỗi lượt (an toàn cho serverless 60s). */
  limit?: number;
}

/**
 * Chạy một lượt cào cho toàn bộ nguồn đang bật (hoặc 1 xã).
 * Dùng pool song song có giới hạn để không làm quá tải website nguồn.
 */
export async function runRevenueScrape(
  options: RunRevenueScrapeOptions = {}
): Promise<RevenueScrapeSummary> {
  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from(REVENUE_SOURCE_TABLE)
    .select("ma_xa, ma_tinh, url_nguon")
    .eq("active", true)
    .not("url_nguon", "is", null);

  if (options.maXa) query = query.eq("ma_xa", options.maXa);
  if (options.limit && options.limit > 0) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Không đọc được danh sách nguồn: ${error.message}`);
  }

  const rows = (data ?? []) as NguonRow[];
  const concurrency = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, 10));

  const results: RevenueScrapeResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await scrapeOne(supabase, rows[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, () => worker())
  );

  const changed = results.filter((r) => r.status === "ok").length;
  const unchanged = results.filter((r) => r.status === "unchanged").length;
  const errors = results.filter((r) => r.status === "error").length;

  return {
    scanned: results.length,
    changed,
    unchanged,
    errors,
    durationMs: Date.now() - startedAt,
    results,
  };
}