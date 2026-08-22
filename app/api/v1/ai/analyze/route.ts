import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, level = 0, scope = "all", forceRefresh = false } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    // 1. Lấy toàn bộ số liệu của Dashboard
    const { data: dash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !dash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard" }, { status: 404 });
    }

    // Khóa cache phân tích theo phạm vi (all | level1 | level2)
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

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Chưa cấu hình GEMINI_API_KEY trong file .env.local" },
        { status: 500 }
      );
    }

    // 2. Tổng hợp dữ liệu ngữ cảnh
    const unitName = dash.unit?.name || dash.title || "Địa phương";
    const unitType = dash.unit?.type === "PROVINCE" ? "Cấp Tỉnh" : "Cấp Xã/Phường";

    let contextSummary = `BÁO CÁO DỮ LIỆU ĐỊA BÀN: ${unitName} (${unitType})\n`;

    const b1 = dash.b1 || dash.metadata?.b1 || {};
    const totalUnits = Number(b1.sme_total || 0) + Number(b1.hkd_total || 0) + Number(b1.htx_total || 0);
    const totalDx = Number(b1.sme_dx || 0) + Number(b1.hkd_dx || 0) + Number(b1.htx_dx || 0);
    const dxRate = totalUnits > 0 ? ((totalDx / totalUnits) * 100).toFixed(1) : "0";

    contextSummary += `
--- DỮ LIỆU TẦNG 1 (ĐƠN VỊ KINH DOANH & CĐS) ---
- Tổng đơn vị kinh doanh: ${totalUnits} (SME: ${b1.sme_total || 0}, Hộ KD: ${b1.hkd_total || 0}, HTX: ${b1.htx_total || 0})
- Đã chuyển đổi số (CĐS): ${totalDx} đơn vị (Tỷ lệ: ${dxRate}%)
- Doanh nghiệp SME CĐS: ${b1.sme_dx || 0}/${b1.sme_total || 0}
- Hộ kinh doanh CĐS: ${b1.hkd_dx || 0}/${b1.hkd_total || 0}
- Hợp tác xã CĐS: ${b1.htx_dx || 0}/${b1.htx_total || 0}
- Sản phẩm OCOP & Dịch vụ: ${JSON.stringify(dash.b2 || {})}
- Doanh thu & Quy mô kinh tế: ${JSON.stringify(dash.b3 || {})}
`;

    const l2 = dash.level2 || dash.metadata?.level2 || {};
    const dynamicE = dash.metadata?.level2_e_items || [];
    contextSummary += `
--- DỮ LIỆU TẦNG 2 (HỆ SINH THÁI KTS NHÓM A - E) ---
- Nhóm A (Hạ tầng & Sẵn sàng CĐS): ${JSON.stringify(l2)}
- Nhóm B (Hiện diện số & TMĐT): Web/Ecom=${l2.l2_b_web_year || 0}, Đơn hàng=${l2.l2_b_don_hang_year || 0}
- Nhóm C (Vận hành & Nhân lực): ERP=${l2.l2_c_erp_year || 0}, Nhân sự=${l2.l2_c_nhan_su_year || 0}
- Nhóm D (Tương tác & Thị trường): Trang xem=${l2.l2_d_trang_xem_year || 0}, SEO=${l2.l2_d_seo_year || 0}
- Nhóm E (Bóc tách dữ liệu Hệ sinh thái):
${dynamicE.map((i: any) => `  + ${i.title}: ${i.value}`).join("\n")}
`;

    // 3. Prompt tư vấn chiến lược
    const prompt = `
Bạn là Chuyên gia Cao cấp về Chuyển đổi số và Phát triển Kinh tế địa phương tại Việt Nam.
Hãy phân tích dữ liệu thực tế sau và đưa ra đánh giá, khuyến nghị hành động cụ thể, súc tích và có tính ứng dụng cao cho lãnh đạo ${unitName}.

${contextSummary}

YÊU CẦU ĐỊNH DẠNG ĐẦU RA (Trả về định dạng Markdown chuẩn, không dùng lời mở đầu sáo rỗng):

### 🌟 1. Đánh giá Tổng quan & Điểm sáng
- Nêu rõ 2-3 điểm tích cực nổi bật nhất từ dữ liệu số liệu (kèm con số minh chứng cụ thể).

### ⚠️ 2. Điểm nghẽn & Thách thức cần tháo gỡ
- Chỉ rõ 2-3 nút thắt lớn nhất (ví dụ: tỷ lệ CĐS hộ kinh doanh còn thấp, chưa khai thác thương mại số, thiếu thông tin doanh nghiệp...).

### 🎯 3. Khuyến nghị Hành động Chiến lược (Next Steps)
- **Hành động ngắn hạn (Trong tháng):** 2 việc cần làm ngay.
- **Giải pháp trung hạn (Trong năm):** 2 giải pháp thúc đẩy phát triển hệ sinh thái số và tăng trưởng kinh tế địa phương.

### 💡 4. Dự báo & Mục tiêu đề xuất
- Đưa ra 1-2 con số mục tiêu khả thi cần đạt được trong chu kỳ tới.
`;

    // 4. Model Google Gemini API chuẩn
    const MODEL_NAME = "gemini-3.6-flash";

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const analysisText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể tạo nội dung phân tích.";

    // 5. Lưu Cache vào metadata Supabase
    const nowIso = new Date().toISOString();
    const updatedMeta = {
      ...(dash.metadata || {}),
      ai_analysis: {
        ...(dash.metadata?.ai_analysis || {}),
        [cacheKey]: {
          content: analysisText,
          updated_at: nowIso,
        },
      },
    };

    await supabase.from("dashboards").update({ metadata: updatedMeta }).eq("id", dashboardId);

    return NextResponse.json({
      success: true,
      data: analysisText,
      updatedAt: nowIso,
      isCached: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi tạo phân tích AI" },
      { status: 500 }
    );
  }
}