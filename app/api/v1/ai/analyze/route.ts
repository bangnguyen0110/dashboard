import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

function cleanMarkdownToPlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, level = 0, scope = "all", forceRefresh = false, customPrompt } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    const { data: dash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !dash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard" }, { status: 404 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Chưa cấu hình GEMINI_API_KEY trong biến môi trường" },
        { status: 500 }
      );
    }

    // Nếu là request gọi từ tính năng bôi đen (Giải thích / Phân tích sâu)
    let promptToRun = customPrompt;

    if (!promptToRun) {
      // Kiểm tra cache nếu là phân tích tổng thể
      const cacheKey = scope || (level === 0 ? "all" : `level_${level}`);
      const cachedAnalysis = dash.metadata?.ai_analysis?.[cacheKey];

      if (cachedAnalysis && !forceRefresh) {
        return NextResponse.json({
          success: true,
          data: cachedAnalysis.content,
          updatedAt: cachedAnalysis.updated_at,
          isCached: true,
        });
      }

      // Tổng hợp dữ liệu ngữ cảnh cho phân tích tổng thể
      const unitName = dash.unit?.name || dash.title || "Địa phương";
      const unitType = dash.unit?.type === "PROVINCE" ? "Cấp Tỉnh" : "Cấp Xã/Phường";

      const b1 = dash.b1 || dash.metadata?.b1 || {};
      const totalUnits = Number(b1.sme_total || 0) + Number(b1.hkd_total || 0) + Number(b1.htx_total || 0);
      const totalDx = Number(b1.sme_dx || 0) + Number(b1.hkd_dx || 0) + Number(b1.htx_dx || 0);
      const dxRate = totalUnits > 0 ? ((totalDx / totalUnits) * 100).toFixed(1) : "0";

      const b2 = dash.b2 || dash.metadata?.b2 || {};
      const b3 = dash.b3 || dash.metadata?.b3 || {};
      const l2 = dash.level2 || dash.metadata?.level2 || {};
      const dynamicE = dash.metadata?.level2_e_items || [];

      const contextData = `
BÁO CÁO CƠ SỞ DỮ LIỆU ĐỊA BÀN: ${unitName.toUpperCase()} (${unitType.toUpperCase()})

[1. DỮ LIỆU TẦNG 1 - TỔNG QUAN KINH TẾ ĐỊA BÀN & CHUYỂN ĐỔI SỐ]
- Tổng số đơn vị kinh tế: ${totalUnits} cơ sở.
  + Doanh nghiệp nhỏ và vừa (SME): ${b1.sme_total || 0} DN (Đã CĐS: ${b1.sme_dx || 0} DN).
  + Hộ kinh doanh cá thể: ${b1.hkd_total || 0} hộ (Đã CĐS: ${b1.hkd_dx || 0} hộ).
  + Hợp tác xã (HTX): ${b1.htx_total || 0} HTX (Đã CĐS: ${b1.htx_dx || 0} HTX).
- Tỷ lệ chuyển đổi số chung: ${dxRate}%.
- Sản phẩm OCOP & Đặc sản địa phương: 
  + OCOP 3 sao: ${b2.ocop_3star || b2.ocop_3 || 0} SP
  + OCOP 4 sao: ${b2.ocop_4star || b2.ocop_4 || 0} SP
  + OCOP 5 sao: ${b2.ocop_5star || b2.ocop_5 || 0} SP
- Doanh thu ghi nhận: ${b3.doanh_thu || 0} triệu VNĐ.

[2. DỮ LIỆU TẦNG 2 - BỘ TIÊU CHÍ HỆ SINH THÁI SỐ (NHÓM A - E)]
- Nhóm A (Hạ tầng số): DN số hóa=${l2.l2_a_dn_cds_year || l2.l2_a_dn_cds || 0}, Cloud=${l2.l2_a_cloud_year || l2.l2_a_cloud || 0}.
- Nhóm B (TMĐT): Website=${l2.l2_b_web_year || l2.l2_b_web_ecom || 0}, Đơn hàng=${l2.l2_b_don_hang_year || l2.l2_b_don_hang || 0}.
- Nhóm C (Vận hành): ERP=${l2.l2_c_erp_year || l2.l2_c_erp || 0}.
- Nhóm D (Thị trường): Lượt xem=${l2.l2_d_trang_xem_year || l2.l2_d_trang_xem || 0}.
- Nhóm E (Bóc tách hệ sinh thái):
${dynamicE.length > 0 ? dynamicE.map((i: any) => `  - ${i.title}: ${i.value}`).join("\n") : "  - Không có mục bổ sung."}
`;

      promptToRun = `
Bạn là Cố vấn Cấp cao về Chiến lược Chuyển đổi số Quốc gia và Phát triển Kinh tế số Địa phương tại Việt Nam.
Hãy nghiên cứu kỹ các số liệu thực tế dưới đây của ${unitName} (${unitType}) và lập BÁO CÁO PHÂN TÍCH HIỆN TRẠNG & TƯ VẤN HÀNH ĐỘNG ĐIỀU HÀNH.

DỮ LIỆU ĐẦU VÀO:
${contextData}

YÊU CẦU NỘI DUNG VÀ CHIỀU SÂU:
1. Đánh giá tính cân đối giữa các chủ thể (SME, Hộ kinh doanh, HTX). Chỉ rõ "vùng trũng".
2. Phân tích chiều sâu công nghệ (Bề nổi vs Vận hành thực chất).
3. Đánh giá hệ sinh thái sản phẩm và nguồn lực bản địa.
4. Đưa ra khuyến nghị hành động cấp bách (30 ngày) và trung hạn (trong năm).
5. Đưa ra 3 chỉ số mục tiêu định lượng cụ thể.

QUY CÁCH TRÌNH BÀY:
- KHÔNG DÙNG BẤT KỲ KÝ TỰ MARKDOWN NÀO (Không dùng *, **, #, _, >).
- Định dạng báo cáo chuẩn mực hành chính:
  + Các phần lớn đánh số La Mã: I., II., III., IV., V.
  + Các mục con dùng số: 1., 2., 3.
  + Ý chi tiết dùng gạch đầu dòng (-) hoặc a., b.
`;
    }

    // Gọi Google Gemini API
    const MODEL_NAME = "gemini-3.6-flash";

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptToRun }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData?.candidates?.[0];
    const rawAnalysisText = candidate?.content?.parts?.[0]?.text || "Không thể tạo nội dung.";

    const cleanResultText = cleanMarkdownToPlainText(rawAnalysisText);

    // Nếu là phân tích tổng thể thì lưu cache vào DB
    if (!customPrompt) {
      const cacheKey = scope || (level === 0 ? "all" : `level_${level}`);
      const nowIso = new Date().toISOString();
      const updatedMeta = {
        ...(dash.metadata || {}),
        ai_analysis: {
          ...(dash.metadata?.ai_analysis || {}),
          [cacheKey]: {
            content: cleanResultText,
            updated_at: nowIso,
          },
        },
      };
      await supabase.from("dashboards").update({ metadata: updatedMeta }).eq("id", dashboardId);
      return NextResponse.json({
        success: true,
        data: cleanResultText,
        updatedAt: nowIso,
        isCached: false,
      });
    }

    // Nếu là gọi từ bôi đen chữ thì trả về kết quả trực tiếp
    return NextResponse.json({
      success: true,
      data: cleanResultText,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi xử lý yêu cầu AI" },
      { status: 500 }
    );
  }
}