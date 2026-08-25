import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidUrl } from "@/lib/url-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 🔍 Hàm bóc tách cục bộ chính xác cho Nhóm D (Tương tác & Thị trường)
 */
function parseGroupDFromHtml(html: string) {
  const result: Record<string, number> = {};

  const cleanText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");

  const cleanNum = (str?: string) => {
    if (!str) return 0;
    const n = str.replace(/,/g, "").replace(/\.(?=\d{3})/g, "").trim();
    const val = parseFloat(n);
    return isNaN(val) ? 0 : val;
  };

  const extractMetricValues = (labelKeywords: string[]) => {
    for (const kw of labelKeywords) {
      const regex = new RegExp(`${kw}[\\s\\S]*?Th[a\u00E1]ng\\s*\\d+\\s*[:\\s]*([\\d.,]+)[\\s\\S]*?N\\u0103m\\s*\\d+\\s*[:\\s]*([\\d.,]+)`, "i");
      const match = cleanText.match(regex);
      if (match) {
        return {
          month: cleanNum(match[1]),
          year: cleanNum(match[2]),
        };
      }
    }
    return null;
  };

  const trangXem = extractMetricValues(["Tổng tương tác Trang xem", "Tương tác Trang xem", "Trang xem"]);
  if (trangXem) {
    result["l2_d_trang_xem_month"] = trangXem.month;
    result["l2_d_trang_xem_year"] = trangXem.year;
    result["l2_d_trang_xem"] = trangXem.year;
  }

  const nguoiXem = extractMetricValues(["Tổng số người xem", "Số người xem", "Người xem"]);
  if (nguoiXem) {
    result["l2_d_nguoi_xem_month"] = nguoiXem.month;
    result["l2_d_nguoi_xem_year"] = nguoiXem.year;
  }

  const googleSeo = extractMetricValues(["Tổng số Google SEO hàng tháng", "Google SEO hàng tháng", "Google SEO"]);
  if (googleSeo) {
    result["l2_d_seo_month"] = googleSeo.month;
    result["l2_d_seo_year"] = googleSeo.year;
    result["l2_d_seo"] = googleSeo.year;
  }

  const khachHang = extractMetricValues(["Khách hàng"]);
  if (khachHang) {
    result["l2_d_khach_hang_month"] = khachHang.month;
    result["l2_d_khach_hang_year"] = khachHang.year;
  }

  const doanhThu = extractMetricValues(["Tổng doanh thu", "Doanh thu"]);
  if (doanhThu) {
    result["l2_d_doanh_thu_month"] = doanhThu.month;
    result["l2_d_doanh_thu_year"] = doanhThu.year;
    result["l2_d_doanh_thu"] = doanhThu.year;
  }

  return result;
}

/**
 * 🌟 Trình quét động hoàn toàn chính xác cho Nhóm E:
 * Bóc tách trực tiếp nhãn từ class ad_di_info và giá trị từ ad_dileft_info.
 */
function parseDynamicGroupE(html: string, targetUrl: string) {
  const dynamicItems: Array<{ key: string; title: string; value: number; url: string }> = [];
  const seenKeys = new Set<string>();

  const cleanNum = (str?: string) => {
    if (!str) return 0;
    const n = str.replace(/,/g, "").replace(/\.(?=\d{3})/g, "").trim();
    const numbers = n.match(/[\d.,]+/g);
    if (!numbers || numbers.length === 0) return 0;
    const val = parseFloat(numbers[numbers.length - 1]);
    return isNaN(val) ? 0 : val;
  };

  const makeKey = (title: string) => {
    return (
      "l2_e_" +
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    );
  };

  // Từ khóa loại trừ các nhóm A, B, C, D để Nhóm E chỉ lấy đúng thông tin quản lý
  const excludeKeywords = [
    "số hóa thông tin", "lên cloud", "số hóa toàn diện", "netid",
    "website", "e-commerce", "sản phẩm / dịch vụ cđs", "đơn hàng", "tăng trưởng",
    "erp", "nhân sự", "khóa đào tạo",
    "trang xem", "người xem", "google seo", "khách hàng", "doanh thu",
    "tháng", "năm", "hệ thống điều hành"
  ];

  // Regex bắt chuẩn xác cấu trúc HTML thực tế: ad_di_info chứa tên và ad_dileft_info chứa số
  const regex = /<div[^>]*class=["']?[^"'\s]*ad_di_info[^"'\s]*["']?[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*class=["']?[^"'\s]*ad_dileft_info[^"'\s]*["']?[^>]*>([\s\S]*?)<\/div>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const rawTitle = match[1].replace(/<[^>]+>/g, "").trim();
    const rawVal = match[2].replace(/<[^>]+>/g, "").trim();

    if (!rawTitle) continue;

    // Làm sạch tiêu đề: loại bỏ ký hiệu checkmark ✅, dấu hai chấm `:` và khoảng trắng thừa
    const title = rawTitle.replace(/^[^\w\s\u00C0-\u1EF9]+/, "").replace(/[:\-\/]+$/, "").trim();
    if (!title) continue;

    const lowerTitle = title.toLowerCase();

    // Bỏ qua nếu thuộc nhóm A, B, C, D hoặc chứa tháng/năm
    if (excludeKeywords.some(kw => lowerTitle.includes(kw)) || lowerTitle.includes("tháng") || lowerTitle.includes("năm")) {
      continue;
    }

    const val = cleanNum(rawVal);
    const key = makeKey(title);

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      dynamicItems.push({
        key,
        title, // Lấy chuẩn 100% tên gốc (ví dụ: "Doanh nghiệp")
        value: val,
        url: targetUrl,
      });
    }
  }

  return dynamicItems;
}

function extractMonthYear(html: string, keywordRegex: RegExp): { month: number; year: number } | null {
  const lineRegex = new RegExp(
    `<div[^>]*class="[^"]*ad_in_line_1[^"]*"[^>]*>[\\s\\S]*?${keywordRegex.source}[\\s\\S]*?<div[^>]*class="[^"]*ad_dileft_info[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const match = html.match(lineRegex);
  if (!match || !match[1]) return null;

  const content = match[1];
  const monthMatch = content.match(/Th\u00E1ng\s*\d+\s*:\s*([\d.,]+)/i);
  const yearMatch = content.match(/N\u0103m\s*\d+\s*:\s*([\d.,]+)/i);

  const cleanNum = (str?: string) => {
    if (!str) return 0;
    const n = str.replace(/,/g, "").replace(/\.(?=\d{3})/g, "").trim();
    const val = parseFloat(n);
    return isNaN(val) ? 0 : val;
  };

  return {
    month: cleanNum(monthMatch?.[1]),
    year: cleanNum(yearMatch?.[1]),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, customId, targetUrl } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    const { data: dash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !dash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard" }, { status: 404 });
    }

    const cleanCustomId = (customId ?? "").trim();
    const base = (
      dash.base_domain ||
      dash.metadata?.base_domain ||
      dash.domain_link ||
      ""
    ).trim().replace(/\/+$/, "");

    let finalUrl = (targetUrl ?? "").trim();
    if (!finalUrl && cleanCustomId) {
      finalUrl = cleanCustomId.startsWith("http://") || cleanCustomId.startsWith("https://")
        ? cleanCustomId
        : base
        ? `${base}/${cleanCustomId}`
        : cleanCustomId;
    }

    const normalizedFinalUrl = getValidUrl(finalUrl);

    if (!normalizedFinalUrl) {
      return NextResponse.json(
        { success: false, error: "URL không hợp lệ hoặc Dashboard chưa cấu hình Domain gốc!" },
        { status: 400 }
      );
    }
    finalUrl = normalizedFinalUrl;

    const response = await fetch(finalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Không thể kết nối đến web liên kết (${response.status})` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const extractedLevel2: Record<string, number> = {};

    // --- BÓC TÁCH NHÓM A ---
    const aDn = extractMonthYear(html, /s\u1ED1\s*h\u00F3a\s*th\u00F4ng\s*tin/i);
    if (aDn) {
      extractedLevel2["l2_a_dn_cds_month"] = aDn.month;
      extractedLevel2["l2_a_dn_cds_year"] = aDn.year;
      extractedLevel2["l2_a_dn_cds"] = aDn.year;
    }
    const aCloud = extractMonthYear(html, /l\u00EAn\s*Cloud/i);
    if (aCloud) {
      extractedLevel2["l2_a_cloud_month"] = aCloud.month;
      extractedLevel2["l2_a_cloud_year"] = aCloud.year;
      extractedLevel2["l2_a_cloud"] = aCloud.year;
    }
    const aToanDien = extractMonthYear(html, /s\u1ED1\s*h\u00F3a\s*to\u00E0n\s*di\u1EC7n/i);
    if (aToanDien) {
      extractedLevel2["l2_a_toan_dien_month"] = aToanDien.month;
      extractedLevel2["l2_a_toan_dien_year"] = aToanDien.year;
    }
    const aNetId = extractMonthYear(html, /NetID/i);
    if (aNetId) {
      extractedLevel2["l2_a_netid_month"] = aNetId.month;
      extractedLevel2["l2_a_netid_year"] = aNetId.year;
      extractedLevel2["l2_a_netid"] = aNetId.year;
    }

    // --- BÓC TÁCH NHÓM B ---
    const bWeb = extractMonthYear(html, /Website\s*&\s*E-commerce/i);
    if (bWeb) {
      extractedLevel2["l2_b_web_month"] = bWeb.month;
      extractedLevel2["l2_b_web_year"] = bWeb.year;
      extractedLevel2["l2_b_web_ecom"] = bWeb.year;
    }
    const bSp = extractMonthYear(html, /s\u1EA3n\s*ph\u1EA9m\s*\/\s*d\u1ECBch\s*v\u1EE5\s*C\u0110S/i);
    if (bSp) {
      extractedLevel2["l2_b_sp_cds_month"] = bSp.month;
      extractedLevel2["l2_b_sp_cds_year"] = bSp.year;
    }
    const bDonHang = extractMonthYear(html, /t\u0103ng\s*tr\u01B0\u1EDFng\s*th\u01B0\u01A1ng\s*m\u1EA1i\s*s\u1ED1\s*&\s*T\u1ED5ng\s*\u0111\u01A1n\s*h\u00E0ng/i) || extractMonthYear(html, /T\u1ED5ng\s*\u0111\u01A1n\s*h\u00E0ng/i);
    if (bDonHang) {
      extractedLevel2["l2_b_don_hang_month"] = bDonHang.month;
      extractedLevel2["l2_b_don_hang_year"] = bDonHang.year;
      extractedLevel2["l2_b_don_hang"] = bDonHang.year;
      extractedLevel2["l2_b_tang_truong_month"] = bDonHang.month;
      extractedLevel2["l2_b_tang_truong_year"] = bDonHang.year;
    }

    // --- BÓC TÁCH NHÓM C ---
    const cErp = extractMonthYear(html, /qu\u1EA3n\s*l\u00FD\s*ERP/i);
    if (cErp) {
      extractedLevel2["l2_c_erp_month"] = cErp.month;
      extractedLevel2["l2_c_erp_year"] = cErp.year;
      extractedLevel2["l2_c_erp"] = cErp.year;
    }
    const cNhanSu = extractMonthYear(html, /nh\u00E2n\s*s\u1EF1\s*to\u00E0n\s*h\u1EC7\s*th\u1ED1ng/i);
    if (cNhanSu) {
      extractedLevel2["l2_c_nhan_su_month"] = cNhanSu.month;
      extractedLevel2["l2_c_nhan_su_year"] = cNhanSu.year;
      extractedLevel2["l2_c_nhan_su"] = cNhanSu.year;
    }
    const cDaoTao = extractMonthYear(html, /Kh\u00F3a\s*\u0111\u00E0o\s*t\u1EA1o/i);
    if (cDaoTao) {
      extractedLevel2["l2_c_dao_tao_month"] = cDaoTao.month;
      extractedLevel2["l2_c_dao_tao_year"] = cDaoTao.year;
      extractedLevel2["l2_c_dao_tao"] = cDaoTao.year;
    }

    // --- 👉 BÓC TÁCH CHUẨN XÁC NHÓM D ---
    const groupDMetrics = parseGroupDFromHtml(html);
    Object.assign(extractedLevel2, groupDMetrics);

    // --- 👉 BÓC TÁCH ĐỘNG CHUẨN XÁC 100% NHÓM E TỪ WEBSITE NGUỒN ---
    const dynamicEList = parseDynamicGroupE(html, finalUrl);
    for (const item of dynamicEList) {
      extractedLevel2[item.key] = item.value;
    }

    // Lưu vào database Supabase
    const currentLevel2 = (dash as any)?.level2 || (dash as any)?.metadata?.level2 || {};
    const mergedData = { ...currentLevel2, ...extractedLevel2 };

    const meta = { ...(dash.metadata || {}) };
    meta.level2_custom_id = cleanCustomId;
    meta.level2_url = finalUrl;
    meta.level2 = mergedData;
    meta.level2_e_items = dynamicEList;
    meta.level2_metrics = {
      ...(meta.level2_metrics || {}),
      ...extractedLevel2,
    };

    await supabase
      .from("dashboards")
      .update({
        level2: mergedData,
        metadata: meta,
      })
      .eq("id", dashboardId);

    await supabase.from("metric_links").upsert(
      {
        dashboard_id: dashboardId,
        metric_key: "level2_sync_all",
        target_url: finalUrl,
        metric_id: cleanCustomId,
      },
      { onConflict: "dashboard_id,metric_key" }
    );

    return NextResponse.json({
      success: true,
      message: `Đã bóc tách thành công toàn bộ chỉ số Nhóm D & E (gồm ${dynamicEList.length} mục Nhóm E động từ website nguồn)!`,
      data: extractedLevel2,
      dynamicEItems: dynamicEList,
      url: finalUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi xử lý bóc tách số liệu Tầng 2" },
      { status: 500 }
    );
  }
}