(function() {
    if (!document.getElementById('z-tech-custom-style')) {
        var style = document.createElement('style');
        style.id = 'z-tech-custom-style';
        style.innerHTML = `
            .z-tech-wrapper { max-width: 1200px; margin: 50px auto; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; box-sizing: border-box; }
            .z-tech-wrapper * { box-sizing: border-box; }
            
            .z-tech-container { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 40px; align-items: center; background: #ffffff;  border-radius: 24px; }
            
            /* Left Side: 3D Image with Motion Effect */
            .z-tech-left { display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 20px; padding: 35px 25px; text-align: center; height: 100%; position: relative; overflow: hidden; }
            
            .z-robot-img { 
                max-width: 330px; 
                width: 100%; 
                height: auto; 
                filter: drop-shadow(0 20px 30px rgba(2, 132, 199, 0.3)); 
                animation: imageFloat 4s ease-in-out infinite alternate; 
                transition: transform 0.3s ease;
            }
            .z-robot-img:hover {
                transform: scale(1.03);
            }
            
            .z-tech-left h3 { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 18px; }
            .z-tech-left p { font-size: 13.5px; color: #475569; margin-top: 6px; line-height: 1.5; }

            @keyframes imageFloat {
                0% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-10px) rotate(1deg); }
                100% { transform: translateY(0px) rotate(0deg); }
            }

            /* Right Side: 7 Core Technologies Grid */
            .z-tech-right { display: grid; grid-template-columns: repeat(1, 1fr); gap: 12px; max-height: 640px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin; }
            .z-tech-right::-webkit-scrollbar { width: 4px; }
            .z-tech-right::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

            .z-tech-item { display: flex; align-items: flex-start; gap: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; transition: all 0.25s ease; }
            .z-tech-item:hover { background: #fff; border-color: #0a6c0a; box-shadow: 0 6px 15px -4px rgb(2 199 20 / 10%); transform: translateX(4px); }

            .z-tech-icon-box { width: 42px; height: 42px; border-radius: 10px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
            
            .z-tech-content h4 { font-size: 14.5px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
            .z-tech-content p { font-size: 13px; color: #475569; line-height: 1.4; margin: 0; }

            @media (max-width: 992px) {
                .z-tech-container { grid-template-columns: 1fr; padding: 20px; }
            }
        `;
        document.head.appendChild(style);
    }

    function injectTechVisual() {
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
            var customImageUrl = "https://doanhnghiep360.net/datafiles/1/2026-09/72876745-cong-nghe-hay.png";

            var html = '<div class="z-tech-wrapper">' +
                '<div class="z-tech-container">' +
                    
                    /* Left Column: 3D Illustration with Animation */
                    '<div class="z-tech-left">' +
                        '<img src="' + customImageUrl + '" alt="3D Robot AI Analytics" class="z-robot-img">' +
                        '<h3>AI NATIVE</h3>' +
                        '<p>Chúng tôi không chỉ ứng dụng AI, chúng tôi là AI Native – nền tảng được xây dựng từ gốc để khai thác sức mạnh AI.</p>' +
                    '</div>' +

                    /* Right Column: 7 Core Technologies Grid */
                    '<div class="z-tech-right">' +
                        
                        /* Item 1 */
                        '<div class="z-tech-item">' +
                            '<div class="z-tech-icon-box">🧠</div>' +
                            '<div class="z-tech-content">' +
                                '<h4>AI Native</h4>' +
                                '<p>Trí tuệ nhân tạo được tích hợp thông minh ngay trong lõi hệ thống.</p>' +
                            '</div>' +
                        '</div>' +

                        /* Item 2 */
                        '<div class="z-tech-item">' +
                            '<div class="z-tech-icon-box">🚀</div>' +
                            '<div class="z-tech-content">' +
                                '<h4>Công nghệ lõi Z+</h4>' +
                                '<p>Mô phỏng khả năng nhân bản hệ thống và mở rộng quy mô doanh nghiệp.</p>' +
                            '</div>' +
                        '</div>' +

                        /* Item 3 */
                        '<div class="z-tech-item">' +
                            '<div class="z-tech-icon-box">☁️</div>' +
                            '<div class="z-tech-content">' +
                                '<h4>Kiến trúc Cloud – SaaS – PaaS</h4>' +
                                '<p>Phân định rõ ràng các mô hình dịch vụ đám mây và khả năng mở rộng linh hoạt.</p>' +
                            '</div>' +
                        '</div>' +

                        /* Item 4 */
                        '<div class="z-tech-item">' +
                            '<div class="z-tech-icon-box">📱</div>' +
                            '<div class="z-tech-content">' +
                                '<h4>Công nghệ WebApp – PWA</h4>' +
                                '<p>Trải nghiệm mượt mà trên đa thiết bị, hỗ trợ cả khi mạng không ổn định.</p>' +
                            '</div>' +
                        '</div>' +

                        /* Item 5 */
                        '<div class="z-tech-item">' +
                            '<div class="z-tech-icon-box">📊</div>' +
                            '<div class="z-tech-content">' +
                                '<h4>Big Data & Dữ liệu tập trung</h4>' +
                                '<p>Quy trình thu thập, xử lý và biến dữ liệu thành tài sản số chiến lược.</p>' +
                            '</div>' +
                        '</div>' +

                        /* Item 6 */
                        '<div class="z-tech-item">' +
                            '<div class="z-tech-icon-box">⚡</div>' +
                            '<div class="z-tech-content">' +
                                '<h4>CDN & Tối ưu hiệu năng</h4>' +
                                '<p>Tăng tốc độ tải trang và hỗ trợ lượng truy cập lớn nhờ phân phối nội dung thông minh.</p>' +
                            '</div>' +
                        '</div>' +

                        /* Item 7 */
                        '<div class="z-tech-item">' +
                            '<div class="z-tech-icon-box">🛡️</div>' +
                            '<div class="z-tech-content">' +
                                '<h4>Bảo mật đa lớp</h4>' +
                                '<p>Quy trình bảo mật toàn diện với cam kết đánh giá mức chuẩn A+.</p>' +
                            '</div>' +
                        '</div>' +

                    '</div>' +

                '</div>' +
            '</div>';

            target.insertAdjacentHTML('afterend', html);
            return true;
        }
        return false;
    }

    var attempts = 0;
    var interval = setInterval(function() {
        if (injectTechVisual() || attempts >= 40) {
            clearInterval(interval);
        }
        attempts++;
    }, 500);
})();