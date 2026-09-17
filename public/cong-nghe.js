(function() {
    if (!document.getElementById('z-tech-style')) {
        var style = document.createElement('style');
        style.id = 'z-tech-style';
        style.innerHTML = `
            .z-tech-wrapper { max-width: 1200px; margin: 40px auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; box-sizing: border-box; }
            .z-tech-wrapper * { box-sizing: border-box; }
            .z-tech-header { text-align: center; max-width: 800px; margin: 0 auto 30px auto; }
            .z-tech-eyebrow { font-size: 12px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px; }
            .z-tech-title { font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; margin-bottom: 12px; }
            .z-tech-desc { font-size: 15px; color: #475569; line-height: 1.6; }
            .z-tech-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .z-tech-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); transition: transform 0.2s ease; }
            .z-tech-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
            .z-tech-card-title { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
            .z-tech-card-sub { font-size: 12px; font-weight: 700; color: #0284c7; display: block; margin-bottom: 12px; text-transform: uppercase; }
            .z-tech-card p { font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 14px; }
            .z-tech-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; color: #1e293b; }
            .z-tech-list li { display: flex; align-items: flex-start; gap: 8px; }
            .z-tech-specs { background: #0f172a; color: #fff; border-radius: 12px; padding: 25px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center; }
            .z-spec-val { font-size: 22px; font-weight: 900; color: #38bdf8; }
            .z-spec-lbl { font-size: 11.5px; color: #94a3b8; margin-top: 4px; }
            @media (max-width: 900px) { .z-tech-grid { grid-template-columns: 1fr; } .z-tech-specs { grid-template-columns: repeat(2, 1fr); } }
        `;
        document.head.appendChild(style);
    }

    function injectTech() {
        if (document.querySelector('.z-tech-wrapper')) return true;

        var target = document.querySelector('.congnghe_h3_7517');
        if (!target) {
            var divs = document.querySelectorAll('div');
            for (var i = 0; i < divs.length; i++) {
                if (divs[i].className && divs[i].className.indexOf('congnghe_h3_7517') !== -1) {
                    target = divs[i];
                    break;
                }
            }
        }
        if (!target) {
            var h3s = document.getElementsByTagName('h3');
            for (var j = 0; j < h3s.length; j++) {
                if (h3s[j].innerText && (h3s[j].innerText.indexOf('Công Nghệ') !== -1 || h3s[j].innerText.indexOf('Nền Tảng Lõi Z+') !== -1)) {
                    target = h3s[j];
                    break;
                }
            }
        }

        if (target) {
            var html = '<div class="z-tech-wrapper">' +
                '<div class="z-tech-header">' +
                    '<h2 class="z-tech-title">Nền Tảng Lõi Z+ & Hệ Thống NetID AI Native</h2>' +
                    '<p class="z-tech-desc">Được nghiên cứu và làm chủ từ năm 2011, hệ sinh thái sở hữu kiến trúc công nghệ độc bản, vượt trội hoàn toàn so với các phần mềm rời rạc trên thị trường.</p>' +
                '</div>' +
                '<div class="z-tech-grid">' +
                    '<div class="z-tech-card" style="border-top: 4px solid #0284c7;">' +
                        '<div class="z-tech-card-title">Zcore Engine & Lõi Công Nghệ Z+</div>' +
                        '<span class="z-tech-card-sub">Kiến Trúc Vĩ Mô & Quy Mô Quốc Gia</span>' +
                        '<p>Nền tảng Cloud Native, PaaS & SaaS với cơ sở dữ liệu phân tán (DB Cluster) và chiến lược Backup tự động 3-2-1 đảm bảo an toàn tuyệt đối.</p>' +
                        '<ul class="z-tech-list">' +
                            '<li>⚡ <strong>Chịu tải siêu khủng:</strong> Hơn 10 triệu request/ngày, xử lý Big Data với độ trễ tính bằng mili-giây.</li>' +
                            '<li>⚡ <strong>Nhân bản siêu tốc:</strong> Thiết lập và nhân bản website, sàn TMĐT, LMS chỉ trong 10 phút.</li>' +
                            '<li>⚡ <strong>Chuyển giao mã nguồn:</strong> Độc bản cho phép đối tác làm chủ hoàn toàn dữ liệu.</li>' +
                        '</ul>' +
                    '</div>' +
                    '<div class="z-tech-card" style="border-top: 4px solid #ea580c;">' +
                        '<div class="z-tech-card-title">NetID AI Native & AI Writer</div>' +
                        '<span class="z-tech-card-sub" style="color: #ea580c;">Trợ Lý Ảo Sáng Tạo Dựa Trên Dữ Liệu Thực</span>' +
                        '<p>Hệ thống AI Writer đa tác tử phối hợp hơn 20 lớp công nghệ (RAG, LLM, NLP, Vector DB) khai thác trực tiếp tri thức riêng của doanh nghiệp.</p>' +
                        '<ul class="z-tech-list">' +
                            '<li>🤖 <strong>Viết bài chuẩn E.E.A.T:</strong> Tự động sản xuất hàng ngàn bài viết SEO gắn liền sản phẩm.</li>' +
                            '<li>🤖 <strong>Nhất quán thương hiệu:</strong> Kiểm soát ngữ nghĩa, giọng văn và thông điệp độc quyền.</li>' +
                            '<li>🤖 <strong>Tích lũy tài sản số:</strong> Biến tài liệu nội bộ thành kho tri thức vĩnh viễn.</li>' +
                        '</ul>' +
                    '</div>' +
                    '<div class="z-tech-card" style="border-top: 4px solid #7e22ce;">' +
                        '<div class="z-tech-card-title">AI War Room - Phòng Hội Ý Chiến Lược</div>' +
                        '<span class="z-tech-card-sub" style="color: #7e22ce;">Cơ Chế Mixture of Agents (MoA) & Debate (MAD)</span>' +
                        '<p>Tổ chức phòng hội ý số với 7 AI Agent chuyên biệt (Tìm kiếm, Tài chính, Đơn giản, Phản biện, Suy luận, Biểu đồ, Toàn năng) phản biện chéo trước khi ra quyết định.</p>' +
                        '<ul class="z-tech-list">' +
                            '<li>🎯 <strong>Phân tích đa chiều:</strong> Đánh giá rủi ro, tài chính, thị trường và kịch bản thay thế khách quan.</li>' +
                            '<li>🎯 <strong>Loại bỏ cảm tính:</strong> Tránh tư duy một chiều nhờ AI Phản biện chủ động tìm lỗ hổng.</li>' +
                            '<li>🎯 <strong>Ra quyết định có cơ sở:</strong> Tổng hợp báo cáo, ma trận và bản đồ rủi ro minh bạch.</li>' +
                        '</ul>' +
                    '</div>' +
                    '<div class="z-tech-card" style="border-top: 4px solid #16a34a;">' +
                        '<div class="z-tech-card-title">AI Workspace & One Data Flow</div>' +
                        '<span class="z-tech-card-sub" style="color: #16a34a;">Bản Thể Số & Dòng Chảy Trí Tuệ Đồng Nhất</span>' +
                        '<p>Không gian làm việc số hợp nhất toàn bộ Datafiles, Knowledge Graph, Timelines và công nghệ quét ý nghĩa (vô ngôn ngữ) tăng năng suất x10 lần.</p>' +
                        '<ul class="z-tech-list">' +
                            '<li>🌐 <strong>Đa ngôn ngữ thông minh:</strong> Máy quét ý nghĩa thấu cảm "Nghĩ" và "Làm" không cần thông dịch viên.</li>' +
                            '<li>🌐 <strong>Quản trị real-time:</strong> Streaming Organization đánh giá và phản hồi liên tục.</li>' +
                            '<li>🌐 <strong>Giải phóng lãnh đạo:</strong> Doanh nghiệp vận hành như một "siêu sinh vật" tự tiến hóa.</li>' +
                        '</ul>' +
                    '</div>' +
                '</div>' +
                '<div class="z-tech-specs">' +
                    '<div><div class="z-spec-val">Epyc 7513</div><div class="z-spec-lbl">40 Cores CPU Siêu Mạnh</div></div>' +
                    '<div><div class="z-spec-val">99.99%</div><div class="z-spec-lbl">Độ Sẵn Sàng Mục Tiêu</div></div>' +
                    '<div><div class="z-spec-val">Chuẩn A+</div><div class="z-spec-lbl">Bảo Mật Security Headers</div></div>' +
                    '<div><div class="z-spec-val">Auto 100%</div><div class="z-spec-lbl">Backup liên tục (1s/lần)</div></div>' +
                '</div>' +
            '</div>';

            target.insertAdjacentHTML('afterend', html);
            return true;
        }
        return false;
    }

    var attempts = 0;
    var interval = setInterval(function() {
        if (injectTech() || attempts >= 40) {
            clearInterval(interval);
        }
        attempts++;
    }, 500);
})();