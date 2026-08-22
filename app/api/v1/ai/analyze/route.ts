import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Tăng thời gian chờ xử lý lên tối đa 60 giây để tránh timeout
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

/**
 * Hàm làm sạch toàn bộ ký tự Markdown tương thích mọi phiên bản JavaScript / TypeScript
 */
function cleanMarkdownToPlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^#{1,6}\s+/gm, "") // Xóa các thẻ tiêu đề #, ##, ###
    .replace(/\*\*(.*?)\*\*/g, "$1") // Xóa in đậm **text**
    .replace(/\*(.*?)\*/g, "$1") // Xóa in nghiêng *text*
    .replace(/__(.*?)__/g, "$1") // Xóa gạch dưới __text__
    .replace(/_(.*?)_/g, "$1") // Xóa in nghiêng _text_
    .replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1") // Xóa code block (tương thích không cần cờ s)
    .replace(/~~(.*?)~~/g, "$1") // Xóa gạch ngang
    .replace(/^>\s+/gm, "") // Xóa blockquote
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)") // Chuyển đổi link
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, level = 0, scope = "all", forceRefresh = false } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId" }, { status: 400 });
    }

    // 1. Lấy dữ liệu thực tế từ Supabase
    const { data: dash, error: dashErr } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .eq("id", dashboardId)
      .single();

    if (dashErr || !dash) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dashboard" }, { status: 404 });
    }

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
        { success: false, error: "Chưa cấu hình GEMINI_API_KEY trong biến môi trường" },
        { status: 500 }
      );
    }

    // 2. Tổng hợp ngữ cảnh dữ liệu đa tầng
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
  + Doanh nghiệp nhỏ và vừa (SME): ${b1.sme_total || 0} DN (Đã CĐS: ${b1.sme_dx || 0} DN, đạt ${b1.sme_total ? ((b1.sme_dx / b1.sme_total) * 100).toFixed(1) : 0}%).
  + Hộ kinh doanh cá thể: ${b1.hkd_total || 0} hộ (Đã CĐS: ${b1.hkd_dx || 0} hộ, đạt ${b1.hkd_total ? ((b1.hkd_dx / b1.hkd_total) * 100).toFixed(1) : 0}%).
  + Hợp tác xã (HTX): ${b1.htx_total || 0} HTX (Đã CĐS: ${b1.htx_dx || 0} HTX, đạt ${b1.htx_total ? ((b1.htx_dx / b1.htx_total) * 100).toFixed(1) : 0}%).
- Tỷ lệ chuyển đổi số chung toàn địa bàn: ${dxRate}%.
- Sản phẩm OCOP & Đặc sản địa phương: 
  + OCOP 3 sao: ${b2.ocop_3star || b2.ocop_3 || 0} SP
  + OCOP 4 sao: ${b2.ocop_4star || b2.ocop_4 || 0} SP
  + OCOP 5 sao: ${b2.ocop_5star || b2.ocop_5 || 0} SP
  + Sản phẩm thương mại & Dịch vụ số: ${b2.sp_thuong || 0} SP, ${b2.dich_vu || 0} dịch vụ.
- Doanh thu ghi nhận: ${b3.doanh_thu || 0} triệu VNĐ.

[2. DỮ LIỆU TẦNG 2 - BỘ TIÊU CHÍ HỆ SINH THÁI SỐ (NHÓM A - E)]
- Nhóm A (Hạ tầng số & Sẵn sàng CĐS): DN số hóa thông tin=${l2.l2_a_dn_cds_year || l2.l2_a_dn_cds || 0}, Lên Cloud=${l2.l2_a_cloud_year || l2.l2_a_cloud || 0}, Danh thiếp NetID=${l2.l2_a_netid_year || l2.l2_a_netid || 0}.
- Nhóm B (Hiện diện số & TMĐT): Website/Gian hàng số=${l2.l2_b_web_year || l2.l2_b_web_ecom || 0}, Đơn hàng số=${l2.l2_b_don_hang_year || l2.l2_b_don_hang || 0}, Tốc độ tăng trưởng=${l2.l2_b_tang_truong_year || 0}%.
- Nhóm C (Vận hành & Nhân lực số): Hệ thống quản lý ERP=${l2.l2_c_erp_year || l2.l2_c_erp || 0}, Nhân sự số=${l2.l2_c_nhan_su_year || l2.l2_c_nhan_su || 0}, Khóa đào tạo kỹ năng=${l2.l2_c_dao_tao_year || l2.l2_c_dao_tao || 0}.
- Nhóm D (Tương tác & Thị trường số): Lượt xem trang=${l2.l2_d_trang_xem_year || l2.l2_d_trang_xem || 0}, Lượng tìm kiếm Google SEO=${l2.l2_d_seo_year || l2.l2_d_seo || 0}.
- Nhóm E (Bóc tách dữ liệu Hệ sinh thái số thực tế):
${dynamicE.length > 0 ? dynamicE.map((i: any) => `  - ${i.title}: ${i.value}`).join("\n") : "  - Chưa có mục bóc tách bổ sung."}
`;

    // 3. Prompt phân tích thực chứng không dùng Markdown
    const prompt = `
Bạn là Cố vấn Cấp cao về Chiến lược Chuyển đổi số Quốc gia và Phát triển Kinh tế số Địa phương tại Việt Nam.
Hãy nghiên cứu kỹ các số liệu thực tế dưới đây của ${unitName} (${unitType}) và lập BÁO CÁO PHÂN TÍCH HIỆN TRẠNG & TƯ VẤN HÀNH ĐỘNG ĐIỀU HÀNH.

DỮ LIỆU ĐẦU VÀO:
${contextData}

YÊU CẦU NỘI DUNG VÀ CHIỀU SÂU:
1. Đánh giá tính cân đối giữa các chủ thể: So sánh tỷ lệ CĐS giữa Doanh nghiệp SME vs Hộ kinh doanh vs HTX. Chỉ rõ chủ thể nào đang là "vùng trũng" kéo lùi tốc độ chung.
2. Phân tích chiều sâu công nghệ: Đánh giá xem địa phương mới dừng ở mức "hiện diện số bề nổi" (tạo trang web, đưa thông tin) hay đã đi vào "chiều sâu vận hành" (ứng dụng Cloud, ERP, tạo ra đơn hàng, giao dịch TMĐT).
3. Đánh giá hệ sinh thái sản phẩm và nguồn lực bản địa (OCOP, quy hoạch, dự án đầu tư, chính sách): Phân tích hiệu quả liên kết giữa kinh tế số và kinh tế thực.
4. Đưa ra các khuyến nghị hành động cấp bách (30 ngày) và trung hạn (trong năm) có tính khả thi cao.
5. Đưa ra 3 chỉ số mục tiêu định lượng cụ thể cần đạt trong kỳ tới.

QUY CÁCH TRÌNH BÀY BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG DÙNG BẤT KỲ KÝ TỰ MARKDOWN NÀO (Không dùng dấu sao *, **, dấu thăng #, ##, ###, gạch dưới _, dấu >).
- Trình bày toàn bộ theo định dạng VĂN BẢN BÁO CÁO HÀNH CHÍNH chuẩn mực:
  + Các phần lớn đánh số La Mã: I. TỔNG QUAN VÀ ĐÁNH GIÁ ĐIỂM SÁNG, II. NHẬN DIỆN ĐIỂM NGHẼN VÀ NGUY CƠ, III. CƠ HỘI ĐỘT PHÁ, IV. LỘ TRÌNH VÀ HÀNH ĐỘNG CHIẾN LƯỢC, V. CHỈ SỐ MỤC TIÊU ĐỀ XUẤT.
  + Các mục con dùng số: 1., 2., 3.
  + Các ý chi tiết dùng gạch đầu dòng đơn giản (-) hoặc a., b., c.
- Hãy viết cô đọng, súc tích, đi thẳng vào vấn đề và ĐẢM BẢO HOÀN THÀNH ĐẦY ĐỦ CẢ 5 PHẦN TỚI KẾT LUẬN CUỐI CÙNG (không được dừng giữa chừng).
`;

    // 4. Model Google Gemini API
    const MODEL_NAME = "gemini-3.6-flash";

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
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
    const rawAnalysisText = candidate?.content?.parts?.[0]?.text || "Không thể tạo nội dung phân tích.";

    // 5. Làm sạch triệt để ký tự Markdown trước khi lưu
    const cleanAnalysisText = cleanMarkdownToPlainText(rawAnalysisText);

    const nowIso = new Date().toISOString();
    const updatedMeta = {
      ...(dash.metadata || {}),
      ai_analysis: {
        ...(dash.metadata?.ai_analysis || {}),
        [cacheKey]: {
          content: cleanAnalysisText,
          updated_at: nowIso,
        },
      },
    };

    await supabase.from("dashboards").update({ metadata: updatedMeta }).eq("id", dashboardId);

    return NextResponse.json({
      success: true,
      data: cleanAnalysisText,
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