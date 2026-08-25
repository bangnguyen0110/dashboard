import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidUrl } from "@/lib/url-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { dashboardId } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    // 1. Lấy thông tin dashboard hiện tại
    const { data: dash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !dash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard" }, { status: 404 });
    }

    // 2. Kiểm tra xem có phải cấp Tỉnh hay không
    const isProvinceLevel =
      dash.is_province ||
      dash.level === "province" ||
      (!dash.parent_id && dash.level !== "commune" && dash.level !== "district");

    const customId = dash.metadata?.level2_custom_id || dash.l2_custom_id || "";
    const isCustomIdBlank = !customId || customId.trim() === "";

    // 🌟 Mốc thời gian hiện tại chính xác khi nhấn nút Làm mới
    const nowIso = new Date().toISOString();

    // 3. NẾU LÀ TỈNH VÀ ĐỂ TRỐNG ID -> TỰ ĐỘNG TỔNG HỢP TỪ XÃ/PHƯỜNG & RESET ID
    if (isProvinceLevel && isCustomIdBlank) {
      const { data: communeDashboards, error: communeErr } = await supabase
        .from("dashboards")
        .select("*")
        .or(`parent_id.eq.${dashboardId},province_code.eq.${dash.province_code || dashboardId}`);

      if (communeErr) {
        return NextResponse.json({ success: false, error: "Lỗi truy vấn danh sách xã/phường trực thuộc" }, { status: 500 });
      }

      if (!communeDashboards || communeDashboards.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Dashboard Tỉnh đang để trống ID nhưng không tìm thấy xã/phường trực thuộc nào để tổng hợp!",
        }, { status: 400 });
      }

      // Tiến hành tổng sum (sum) số liệu từ các xã/phường
      const aggregatedLevel2: Record<string, number> = {};
      const aggregatedEItemsMap: Record<string, { key: string; title: string; value: number; url: string }> = {};

      for (const commune of communeDashboards) {
        const cLevel2 = commune.level2 || commune.metadata?.level2 || commune.metadata?.level2_metrics || {};
        for (const [k, v] of Object.entries(cLevel2)) {
          const num = Number(v) || 0;
          aggregatedLevel2[k] = (aggregatedLevel2[k] || 0) + num;
        }

        const cItems = commune.metadata?.level2_e_items || [];
        if (Array.isArray(cItems)) {
          for (const item of cItems) {
            if (item && item.key) {
              if (!aggregatedEItemsMap[item.key]) {
                aggregatedEItemsMap[item.key] = {
                  key: item.key,
                  title: item.title || item.key,
                  value: 0,
                  url: item.url || "",
                };
              }
              aggregatedEItemsMap[item.key].value += Number(item.value) || 0;
            }
          }
        }
      }

      const aggregatedEList = Object.values(aggregatedEItemsMap);

      // Cập nhật metadata & reset ID
      const currentLevel2 = dash.level2 || dash.metadata?.level2 || {};
      const mergedLevel2 = { ...currentLevel2, ...aggregatedLevel2 };

      const meta = { ...(dash.metadata || {}) };
      meta.level2_custom_id = ""; // Reset ID trống
      meta.level2_url = "";
      meta.level2 = mergedLevel2;
      meta.level2_e_items = aggregatedEList;
      meta.level2_metrics = aggregatedLevel2;
      meta.last_sync_at = nowIso; // 🌟 Lưu mốc thời gian thủ công mới nhất

      await supabase
        .from("dashboards")
        .update({
          level2: mergedLevel2,
          metadata: meta,
          updated_at: nowIso, // 🌟 Cập nhật thời gian chuẩn của database
        })
        .eq("id", dashboardId);

      // Reset / Xóa sạch các metric_links riêng lẻ đã thiết lập ở dashboard tỉnh
      await supabase
        .from("metric_links")
        .delete()
        .eq("dashboard_id", dashboardId);

      return NextResponse.json({
        success: true,
        message: `Đã tự động tổng hợp số liệu từ ${communeDashboards.length} xã/phường và cập nhật thời gian thành công!`,
        updatedCount: communeDashboards.length,
        syncedAt: nowIso,
      });
    }

    // --- TRƯỜNG HỢP THÔNG THƯỜNG (CÓ ID HOẶC KHÔNG PHẢI TỈNH) ---
    const { data: links, error } = await supabase
      .from("metric_links")
      .select("metric_key, target_url")
      .eq("dashboard_id", dashboardId);

    if (error || !links || links.length === 0) {
      // Dù không có link vẫn cập nhật thời gian làm mới thủ công
      const meta = { ...(dash.metadata || {}), last_sync_at: nowIso };
      await supabase.from("dashboards").update({ updated_at: nowIso, metadata: meta }).eq("id", dashboardId);

      return NextResponse.json({ success: true, message: "Chưa có liên kết chỉ số nào để đồng bộ", updatedCount: 0, syncedAt: nowIso });
    }

    let successCount = 0;

    // Quét song song tất cả các link
    await Promise.all(
      links.map(async (item) => {
        const targetUrl = getValidUrl(item.target_url);
        if (targetUrl) {
          try {
            const res = await fetch(`${req.nextUrl.origin}/api/scrape-metric`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: targetUrl,
                targetUrl,
                metricKey: item.metric_key,
                dashboardId,
              }),
            });
            const data = await res.json();
            if (data.success) {
              successCount++;
              if (typeof data.value === "number") {
                await supabase
                  .from("metric_links")
                  .update({ current_value: data.value, target_url: targetUrl })
                  .eq("dashboard_id", dashboardId)
                  .eq("metric_key", item.metric_key);
              }
            }
          } catch (e) {
            console.error(`Lỗi quét link ${item.metric_key}:`, e);
          }
        }
      })
    );

    // 🌟 4. CẬP NHẬT THỜI GIAN MỚI NHẤT VÀO CSDL SAU KHI SYNC THÀNH CÔNG
    const meta = { ...(dash.metadata || {}), last_sync_at: nowIso };
    await supabase
      .from("dashboards")
      .update({
        updated_at: nowIso,
        metadata: meta,
      })
      .eq("id", dashboardId);

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ thành công ${successCount}/${links.length} chỉ số từ website!`,
      updatedCount: successCount,
      syncedAt: nowIso,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi đồng bộ dữ liệu trực tiếp" },
      { status: 500 }
    );
  }
}