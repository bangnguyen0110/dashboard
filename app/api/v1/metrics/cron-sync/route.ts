import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Nếu đặt CRON_SECRET trong biến môi trường thì endpoint buộc phải gửi header x-cron-secret khớp.
// Nếu không đặt thì cho phép gọi tự do (vẫn nên đặt CRON_SECRET trên production để tránh gọi trái phép).
const CRON_SECRET = process.env.CRON_SECRET || process.env.CRON_JOB_SECRET || "";

const nowISO = () => new Date().toISOString();

function getValidUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

// Bóc tách số từ nội dung HTML/JSON của web nguồn
function extractNumberFromContent(content: string): number | null {
  try {
    const parsedJson = JSON.parse(content);
    if (typeof parsedJson === "number") return parsedJson;
    if (typeof parsedJson === "object" && parsedJson !== null) {
      const candidates = ["value", "total", "count", "quantity", "so_luong", "tong", "data", "result"];
      for (const k of candidates) {
        if (typeof parsedJson[k] === "number") return parsedJson[k];
        if (typeof parsedJson[k] === "string" && !isNaN(Number(parsedJson[k]))) {
          return Number(parsedJson[k]);
        }
      }
      if (Array.isArray(parsedJson.data)) return parsedJson.data.length;
      if (Array.isArray(parsedJson)) return parsedJson.length;
    }
  } catch {
    // Không phải JSON -> xử lý HTML
  }

  const regexPatterns = [
    /<(?:span|div|b|strong|p|h\d)[^>]*class="[^"]*(?:count|total|stat|number|value|qty|badge|highlight)[^"]*"[^>]*>\s*([\d.,]+)\s*<\/i/i,
    /<(?:span|div|b|strong|p|h\d)[^>]*id="[^"]*(?:count|total|stat|number|value|qty)[^"]*"[^>]*>\s*([\d.,]+)\s*<\/i/i,
    /<meta\s+property="[^"]*(?:count|total|value)[^"]*"\s+content="([\d.,]+)"/i,
    /(?:Tổng|Số lượng|Hiện có|Đã có|SME|HKD|HTX)\s*[:\-]?\s*([\d.,]+)/i,
  ];

  for (const regex of regexPatterns) {
    const match = content.match(regex);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/,/g, "").replace(/\.(?=\d{3})/g, "");
      const val = parseFloat(cleanNum);
      if (!isNaN(val)) return val;
    }
  }

  const strippedText = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const fallbackMatch = strippedText.match(/(\b\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\b|\b\d+\b)/);
  if (fallbackMatch && fallbackMatch[1]) {
    const cleanNum = fallbackMatch[1].replace(/,/g, "").replace(/\.(?=\d{3})/g, "");
    const val = parseFloat(cleanNum);
    if (!isNaN(val)) return val;
  }

  return null;
}

// Quét (cào) toàn bộ metric_links của MỘT xã/phường từ web nguồn và cập nhật vào DB.
async function scrapeAndSaveForCommune(communeDashboardId: string): Promise<{ changed: number; total: number }> {
  try {
    const { data: links, error } = await supabase
      .from("metric_links")
      .select("metric_key, target_url, current_value")
      .eq("dashboard_id", communeDashboardId);

    if (error || !links || links.length === 0) {
      return { changed: 0, total: 0 };
    }

    const updates: Array<{ metricKey: string; finalUrl: string; value: number; prefix: string }> = [];

    for (const item of links) {
      const finalUrl = getValidUrl(item.target_url);
      if (!finalUrl) continue;
      try {
        const response = await fetch(finalUrl, {
          signal: AbortSignal.timeout(5000),
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
          },
          cache: "no-store",
        });
        if (!response.ok) continue;
        const htmlContent = await response.text();
        const extractedValue = extractNumberFromContent(htmlContent);
        if (extractedValue === null) continue;

        const currentValueNum =
          item.current_value !== null && item.current_value !== undefined ? Number(item.current_value) : null;
        // Bỏ qua nếu số liệu không đổi (tiết kiệm ghi DB)
        if (currentValueNum !== null && currentValueNum === extractedValue) continue;
        // Bảo vệ giá trị thấp bất thường
        if (currentValueNum !== null && currentValueNum > 10 && (extractedValue === 0 || extractedValue === 1)) continue;

        updates.push({
          metricKey: item.metric_key,
          finalUrl,
          value: extractedValue,
          prefix: item.metric_key.split("_")[0],
        });
      } catch {
        // Fetch/hết thời gian -> bỏ qua link này
      }
    }

    if (updates.length === 0) return { changed: 0, total: links.length };

    const [{ data: existingB1 }, { data: existingB2 }] = await Promise.all([
      supabase.from("kpi_business_units").select("*").eq("dashboard_id", communeDashboardId).maybeSingle(),
      supabase.from("kpi_products").select("*").eq("dashboard_id", communeDashboardId).maybeSingle(),
    ]);

    const b1Updates: Record<string, any> = { dashboard_id: communeDashboardId, updated_at: nowISO(), ...(existingB1 || {}) };
    const b2Updates: Record<string, any> = { dashboard_id: communeDashboardId, updated_at: nowISO(), ...(existingB2 || {}) };

    const b2FieldMap: Record<string, string> = {
      b2_ocop_3: "ocop_3star",
      b2_ocop_4: "ocop_4star",
      b2_ocop_5: "ocop_5star",
      b2_sp_thuong: "sp_thuong",
      b2_dich_vu: "dich_vu",
    };

    for (const update of updates) {
      await supabase
        .from("metric_links")
        .update({ current_value: update.value, target_url: update.finalUrl })
        .eq("dashboard_id", communeDashboardId)
        .eq("metric_key", update.metricKey);

      if (update.prefix === "b1") {
        b1Updates[update.metricKey.replace("b1_", "")] = update.value;
      } else if (update.prefix === "b2") {
        const field = b2FieldMap[update.metricKey];
        if (field) b2Updates[field] = update.value;
      }
    }

    delete b1Updates.created_at;
    delete b2Updates.created_at;

    await Promise.all([
      supabase.from("kpi_business_units").upsert(b1Updates, { onConflict: "dashboard_id" }),
      supabase.from("kpi_products").upsert(b2Updates, { onConflict: "dashboard_id" }),
    ]);

    return { changed: updates.length, total: links.length };
  } catch {
    return { changed: 0, total: 0 };
  }
}

// Tìm danh sách dashboard của xã/phường trực thuộc một tỉnh.
async function resolveCommuneDashboardIds(
  provinceUnitId: string | null | undefined,
  provinceDashboardId: string
): Promise<string[]> {
  let ids: string[] = [];
  if (provinceUnitId) {
    const { data: childUnits } = await supabase
      .from("administrative_units")
      .select("id")
      .eq("parent_id", provinceUnitId);
    const unitIds = childUnits?.map((u) => u.id) ?? [];
    if (unitIds.length > 0) {
      const { data: cDashboards } = await supabase.from("dashboards").select("id").in("unit_id", unitIds);
      ids = cDashboards?.map((d) => d.id) ?? [];
    }
  }
  if (ids.length === 0) {
    const { data: fallbackDash } = await supabase
      .from("dashboards")
      .select("id")
      .or(`parent_id.eq.${provinceDashboardId},province_code.eq.${provinceDashboardId}`);
    ids = fallbackDash?.map((d) => d.id) ?? [];
  }
  if (ids.length === 0) {
    const { data: fallbackAll } = await supabase
      .from("dashboards")
      .select("id")
      .neq("id", provinceDashboardId);
    ids = fallbackAll?.map((d) => d.id) ?? [];
  }
  return ids;
}

// Tổng hợp toàn bộ số liệu xã/phường lên Dashboard Tỉnh.
async function aggregateToProvince(provinceDashboardId: string, communeIds: string[]) {
  if (communeIds.length === 0) return { count: 0, totals: null };

  const [{ data: b1Rows }, { data: b2Rows }] = await Promise.all([
    supabase.from("kpi_business_units").select("*").in("dashboard_id", communeIds),
    supabase.from("kpi_products").select("*").in("dashboard_id", communeIds),
  ]);

  let totalSme = 0, totalHkd = 0, totalHtx = 0;
  let totalSmeDx = 0, totalHkdDx = 0, totalHtxDx = 0;
  let ocop3 = 0, ocop4 = 0, ocop5 = 0, spThuong = 0, dichVu = 0;

  (b1Rows ?? []).forEach((row: any) => {
    totalSme += Number(row.sme_total || 0);
    totalHkd += Number(row.hkd_total || 0);
    totalHtx += Number(row.htx_total || 0);
    totalSmeDx += Number(row.sme_dx ?? row.sme_cds ?? 0);
    totalHkdDx += Number(row.hkd_dx ?? row.hkd_cds ?? 0);
    totalHtxDx += Number(row.htx_dx ?? row.htx_cds ?? 0);
  });
  (b2Rows ?? []).forEach((row: any) => {
    ocop3 += Number(row.ocop_3star || 0);
    ocop4 += Number(row.ocop_4star || 0);
    ocop5 += Number(row.ocop_5star || 0);
    spThuong += Number(row.sp_thuong || 0);
    dichVu += Number(row.dich_vu || 0);
  });

  const now = nowISO();
  const [{ data: provB1 }, { data: provB2 }] = await Promise.all([
    supabase.from("kpi_business_units").select("*").eq("dashboard_id", provinceDashboardId).maybeSingle(),
    supabase.from("kpi_products").select("*").eq("dashboard_id", provinceDashboardId).maybeSingle(),
  ]);

  const b1: Record<string, any> = { dashboard_id: provinceDashboardId, updated_at: now, ...(provB1 || {}) };
  b1.sme_total = totalSme;
  b1.hkd_total = totalHkd;
  b1.htx_total = totalHtx;
  b1.sme_dx = totalSmeDx;
  b1.hkd_dx = totalHkdDx;
  b1.htx_dx = totalHtxDx;
  delete b1.created_at;

  const b2: Record<string, any> = { dashboard_id: provinceDashboardId, updated_at: now, ...(provB2 || {}) };
  b2.ocop_3star = ocop3;
  b2.ocop_4star = ocop4;
  b2.ocop_5star = ocop5;
  b2.sp_thuong = spThuong;
  b2.dich_vu = dichVu;
  delete b2.created_at;

  await Promise.all([
    supabase.from("kpi_business_units").upsert(b1, { onConflict: "dashboard_id" }),
    supabase.from("kpi_products").upsert(b2, { onConflict: "dashboard_id" }),
  ]);

  return {
    count: communeIds.length,
    totals: { totalSme, totalHkd, totalHtx, totalSmeDx, totalHkdDx, totalHtxDx, ocop3, ocop4, ocop5 },
  };
}

export async function GET(req: NextRequest) {
  try {
    // Cho phép các request từ Vercel Cron (header do nền tảng Vercel tự gắn) vượt qua kiểm tra secret,
    // còn các request bên ngoài thì phải gửi đúng x-cron-secret nếu biến CRON_SECRET được đặt.
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    if (CRON_SECRET && !isVercelCron) {
      const provided = req.headers.get("x-cron-secret") || "";
      if (provided !== CRON_SECRET) {
        return NextResponse.json({ success: false, error: "Forbidden: sai CRON_SECRET" }, { status: 403 });
      }
    }

    const startedAt = Date.now();

    // Lấy toàn bộ dashboard để xác định các dashboard cấp TỈNH
    const { data: dashboards, error: dbError } = await supabase
      .from("dashboards")
      .select("id, is_province, level, unit_id, province_code, metadata");

    if (dbError || !dashboards) {
      return NextResponse.json({ success: false, error: "Không thể đọc danh sách dashboard" }, { status: 500 });
    }

    const provinceCandidates = dashboards.filter((d: any) => d.is_province || d.level === "province");
    // Nếu không đánh dấu province, coi các dashboard không có parent_id là cấp Tỉnh
    const provinceDashboards =
      provinceCandidates.length > 0 ? provinceCandidates : dashboards.filter((d: any) => !d.parent_id);

    let totalScanned = 0;
    const details: Array<{
      province_id: string;
      totalScanned: number;
      updatedCount: number;
      totals: any;
    }> = [];

    // Duyệt từng Tỉnh, quét toàn bộ xã/phường trực thuộc (theo lô 10 xã/lần)
    for (const province of provinceDashboards) {
      try {
        const communeIds = await resolveCommuneDashboardIds(province.unit_id, province.id);
        if (communeIds.length === 0) continue;

        let changed = 0;
        const CHUNK_SIZE = 10;

        for (let i = 0; i < communeIds.length; i += CHUNK_SIZE) {
          const chunk = communeIds.slice(i, i + CHUNK_SIZE);
          const results = await Promise.all(chunk.map((id) => scrapeAndSaveForCommune(id)));
          results.forEach((r) => {
            totalScanned += r.total;
            changed += r.changed;
          });
          // Dừng an toàn trước ngưỡng 60s của serverless (~55s)
          if (Date.now() - startedAt > 55_000) break;
        }

        // Sau khi quét xong -> tổng hợp lên Tỉnh
        const agg = await aggregateToProvince(province.id, communeIds);

        const syncedAt = nowISO();
        const meta = { ...(province.metadata || {}), last_sync_at: syncedAt, last_sync_source: "cron-18h" };
        await supabase
          .from("dashboards")
          .update({ metadata: meta, updated_at: syncedAt })
          .eq("id", province.id);

        details.push({
          province_id: province.id,
          totalScanned: changed,
          updatedCount: agg.count,
          totals: agg.totals,
        });
      } catch (err: any) {
        console.error(`Lỗi quét tỉnh ${province.id}:`, err?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã tự động quét toàn bộ số liệu nguồn và đồng bộ lên ${details.length} Dashboard Tỉnh!`,
      syncedAt: nowISO(),
      processedProvinces: details.length,
      totalScanned,
      details,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    console.error("Lỗi cron-sync:", error);
    return NextResponse.json({ success: false, error: error.message || "Lỗi đồng bộ định kỳ" }, { status: 500 });
  }
}