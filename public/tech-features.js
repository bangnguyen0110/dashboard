document.getElementById('tech-features-container').innerHTML = `
    <div class="sec-header">
        <span class="sec-eyebrow">ĐỈNH CAO CÔNG NGHỆ B2B</span>
        <h2 class="sec-title">Nền Tảng Lõi Z+ & Hệ Thống NetID AI Native</h2>
        <p class="sec-desc">Được nghiên cứu và làm chủ từ năm 2011, hệ sinh thái sở hữu kiến trúc công nghệ độc bản, vượt trội hoàn toàn so với các phần mềm rời rạc trên thị trường.</p>
    </div>

    <!-- 4 CORE PILLARS GRID -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 40px;">
        
        <!-- Pillar 1: Zcore Engine & Lõi Z+ -->
        <div style="background: #fff; border: 1px solid var(--slate-200); border-radius: 16px; padding: 32px; box-shadow: var(--shadow-sm); border-top: 4px solid var(--primary);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; background: var(--primary-light); color: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px;">Z+</div>
                <div>
                    <h3 style="font-size: 18px; font-weight: 900; color: var(--navy-900);">Zcore Engine & Lõi Công Nghệ Z+</h3>
                    <span style="font-size: 12px; font-weight: 700; color: var(--primary);">Kiến Trúc Vĩ Mô & Quy Mô Quốc Gia</span>
                </div>
            </div>
            <p style="font-size: 14.5px; color: var(--navy-600); margin-bottom: 16px;">Nền tảng Cloud Native, PaaS & SaaS với cơ sở dữ liệu phân tán (DB Cluster) và chiến lược Backup tự động 3-2-1 (1s/lần) đảm bảo an toàn tuyệt đối.</p>
            <ul style="list-style: none; font-size: 13.5px; color: var(--navy-800); display: flex; flex-direction: column; gap: 8px;">
                <li>⚡ <strong>Chịu tải siêu khủng:</strong> Hơn 10 triệu request/ngày, xử lý Big Data với độ trễ tính bằng mili-giây.</li>
                <li>⚡ <strong>Nhân bản siêu tốc:</strong> Thiết lập và nhân bản toàn bộ website, sàn TMĐT, LMS, gian hàng chỉ trong 10 phút.</li>
                <li>⚡ <strong>Chuyển giao mã nguồn:</strong> Độc bản cho phép đối tác làm chủ hoàn toàn dữ liệu và hệ thống.</li>
            </ul>
        </div>

        <!-- Pillar 2: AI Native & NetID AI -->
        <div style="background: #fff; border: 1px solid var(--slate-200); border-radius: 16px; padding: 32px; box-shadow: var(--shadow-sm); border-top: 4px solid var(--accent-orange);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; background: var(--accent-orange-light); color: var(--accent-orange); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px;">AI</div>
                <div>
                    <h3 style="font-size: 18px; font-weight: 900; color: var(--navy-900);">NetID AI Native & AI Writer</h3>
                    <span style="font-size: 12px; font-weight: 700; color: var(--accent-orange);">Trợ Lý Ảo Sáng Tạo Dựa Trên Dữ Liệu Thực</span>
                </div>
            </div>
            <p style="font-size: 14.5px; color: var(--navy-600); margin-bottom: 16px;">Hệ thống AI Writer đa tác tử phối hợp hơn 20 lớp công nghệ (RAG, LLM, NLP, Vector DB) khai thác trực tiếp tri thức riêng của doanh nghiệp.</p>
            <ul style="list-style: none; font-size: 13.5px; color: var(--navy-800); display: flex; flex-direction: column; gap: 8px;">
                <li>🤖 <strong>Viết bài chuẩn E.E.A.T:</strong> Tự động sản xuất hàng ngàn bài viết SEO gắn liền với sản phẩm thực tế.</li>
                <li>🤖 <strong>Nhất quán thương hiệu:</strong> Kiểm soát ngữ nghĩa, giọng văn và thông điệp độc quyền của doanh nghiệp.</li>
                <li>🤖 <strong>Tích lũy tài sản số:</strong> Biến tài liệu và tri thức nội bộ thành kho tri thức tái sử dụng vĩnh viễn.</li>
            </ul>
        </div>

        <!-- Pillar 3: AI War Room (7 AI Agents) -->
        <div style="background: #fff; border: 1px solid var(--slate-200); border-radius: 16px; padding: 32px; box-shadow: var(--shadow-sm); border-top: 4px solid #7e22ce;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; background: #f3e8ff; color: #7e22ce; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px;">WR</div>
                <div>
                    <h3 style="font-size: 18px; font-weight: 900; color: var(--navy-900);">AI War Room - Phòng Hội Ý Chiến Lược</h3>
                    <span style="font-size: 12px; font-weight: 700; color: #7e22ce;">Cơ Chế Mixture of Agents (MoA) & Debate (MAD)</span>
                </div>
            </div>
            <p style="font-size: 14.5px; color: var(--navy-600); margin-bottom: 16px;">Tổ chức phòng hội ý số với 7 AI Agent chuyên biệt (Tìm kiếm, Tài chính, Đơn giản, Phản biện, Suy luận, Biểu đồ, Toàn năng) phản biện chéo trước khi ra quyết định.</p>
            <ul style="list-style: none; font-size: 13.5px; color: var(--navy-800); display: flex; flex-direction: column; gap: 8px;">
                <li>🎯 <strong>Phân tích đa chiều:</strong> Đánh giá rủi ro, tài chính, thị trường và kịch bản thay thế khách quan.</li>
                <li>🎯 <strong>Loại bỏ cảm tính:</strong> Tránh tư duy một chiều nhờ AI Phản biện chủ động tìm lỗ hổng giả định.</li>
                <li>🎯 <strong>Ra quyết định có cơ sở:</strong> Tổng hợp báo cáo, ma trận và bản đồ rủi ro minh bạch tuyệt đối.</li>
            </ul>
        </div>

        <!-- Pillar 4: AI Workspace & One Data Flow -->
        <div style="background: #fff; border: 1px solid var(--slate-200); border-radius: 16px; padding: 32px; box-shadow: var(--shadow-sm); border-top: 4px solid var(--accent-green);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; background: var(--accent-green-light); color: var(--accent-green); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px;">ODF</div>
                <div>
                    <h3 style="font-size: 18px; font-weight: 900; color: var(--navy-900);">AI Workspace & One Data Flow</h3>
                    <span style="font-size: 12px; font-weight: 700; color: var(--accent-green);">Bản Thể Số & Dòng Chảy Trí Tuệ Đồng Nhất</span>
                </div>
            </div>
            <p style="font-size: 14.5px; color: var(--navy-600); margin-bottom: 16px;">Không gian làm việc số hợp nhất toàn bộ Datafiles, Knowledge Graph, Timelines và công nghệ quét ý nghĩa (vô ngôn ngữ) tăng năng suất x10 lần.</p>
            <ul style="list-style: none; font-size: 13.5px; color: var(--navy-800); display: flex; flex-direction: column; gap: 8px;">
                <li>🌐 <strong>Đa ngôn ngữ thông minh:</strong> Máy quét ý nghĩa thấu cảm "Nghĩ" và "Làm" không cần thông dịch viên.</li>
                <li>🌐 <strong>Quản trị theo thời gian thực:</strong> Streaming Organization đánh giá và phản hồi real-time.</li>
                <li>🌐 <strong>Giải phóng lãnh đạo:</strong> Doanh nghiệp vận hành như một "siêu sinh vật" tự động tiến hóa.</li>
            </ul>
        </div>

    </div>

    <!-- HARDWARE & SECURITY SPECS BAR -->
    <div style="background: var(--navy-900); color: #fff; border-radius: 16px; padding: 32px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; text-align: center;">
        <div>
            <div style="font-size: 24px; font-weight: 900; color: var(--primary);">Epyc 7513</div>
            <div style="font-size: 12px; color: var(--slate-400); margin-top: 4px;">40 Cores CPU Siêu Mạnh</div>
        </div>
        <div>
            <div style="font-size: 24px; font-weight: 900; color: var(--accent-green);">99.99%</div>
            <div style="font-size: 12px; color: var(--slate-400); margin-top: 4px;">Độ Sẵn Sàng Mục Tiêu</div>
        </div>
        <div>
            <div style="font-size: 24px; font-weight: 900; color: var(--accent-orange);">Tiêu chuẩn A+</div>
            <div style="font-size: 12px; color: var(--slate-400); margin-top: 4px;">Bảo Mật Security Headers</div>
        </div>
        <div>
            <div style="font-size: 24px; font-weight: 900; color: #a855f7;">Auto 100%</div>
            <div style="font-size: 12px; color: var(--slate-400); margin-top: 4px;">Backup liên tục (1s/lần)</div>
        </div>
    </div>
`;