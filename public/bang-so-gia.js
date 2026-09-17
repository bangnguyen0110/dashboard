(function() {
    if (!document.getElementById('z-calc-style')) {
        var style = document.createElement('style');
        style.id = 'z-calc-style';
        style.innerHTML = `
            .z-calc-wrapper { --z-primary: #0284c7; --z-primary-light: #e0f2fe; --z-navy-900: #0f172a; --z-navy-800: #1e293b; --z-navy-600: #475569; --z-slate-50: #f8fafc; --z-slate-200: #e2e8f0; --z-slate-300: #cbd5e1; --z-accent-orange: #ea580c; --z-accent-green: #16a34a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; max-width: 1200px; margin: 20px auto; box-sizing: border-box; }
            .z-calc-wrapper * { box-sizing: border-box; }
            .z-calc-box { background: #fff; border: 1px solid var(--z-slate-300); border-radius: 12px; box-shadow: 0 8px 20px -4px rgba(0,0,0,0.1); display: grid; grid-template-columns: 1.4fr 0.6fr; overflow: hidden; }
            .z-calc-left { padding: 20px; background: #ffffff; border-right: 1px solid var(--z-slate-200); max-height: 540px; overflow-y: auto; scrollbar-width: thin; }
            .z-calc-left::-webkit-scrollbar { width: 6px; }
            .z-calc-left::-webkit-scrollbar-thumb { background: var(--z-slate-300); border-radius: 4px; }
            .z-calc-left h4 { font-size: 16px; font-weight: 800; margin-bottom: 4px; color: var(--z-navy-900); }
            .z-calc-left p { font-size: 13px; color: var(--z-navy-600); margin-bottom: 12px; }
            .z-calc-category { margin-bottom: 8px; border: 1px solid var(--z-slate-200); border-radius: 8px; overflow: hidden; background: #fff; }
            .z-calc-cat-header { padding: 10px 14px; background: var(--z-slate-50); font-weight: 700; font-size: 13px; color: var(--z-navy-900); cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; }
            .z-calc-cat-header:hover { background: var(--z-primary-light); color: var(--z-primary); }
            .z-calc-cat-content { padding: 10px; display: none; grid-template-columns: 1fr 1fr; gap: 8px; background: #fff; border-top: 1px solid var(--z-slate-200); }
            .z-calc-category.active .z-calc-cat-content { display: grid; }
            .z-calc-cat-header::after { content: "+"; font-size: 15px; font-weight: bold; }
            .z-calc-category.active .z-calc-cat-header::after { content: "-"; }
            .z-calc-item { display: flex; justify-content: space-between; align-items: center; padding: 7px 9px; background: var(--z-slate-50); border: 1px solid var(--z-slate-200); border-radius: 6px; cursor: pointer; transition: all 0.2s ease; }
            .z-calc-item:hover { background: var(--z-primary-light); border-color: var(--z-primary); }
            .z-calc-label { font-size: 11.5px; font-weight: 600; color: var(--z-navy-800); display: flex; align-items: center; gap: 6px; }
            .z-calc-label input { width: 14px; height: 14px; accent-color: var(--z-primary); cursor: pointer; }
            .z-calc-cost { font-weight: 800; font-size: 11.5px; color: var(--z-navy-900); white-space: nowrap; }
            .z-calc-right { background: var(--z-navy-900); color: #fff; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; }
            .z-calc-right h4 { font-size: 13px; color: var(--z-slate-300); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
            .z-selected-list { max-height: 180px; overflow-y: auto; padding-right: 4px; margin: 5px 0; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1); padding: 8px 0; scrollbar-width: thin; }
            .z-selected-list::-webkit-scrollbar { width: 4px; }
            .z-selected-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .z-calc-sum-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-top: 10px; color: var(--z-slate-300); }
            .z-suggest-price { font-size: 24px; font-weight: 900; color: #fff; margin: 4px 0; }
            
            /* Modal Popup CSS */
            .z-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 15px; box-sizing: border-box; }
            .z-modal-box { background: #fff; width: 100%; max-width: 480px; border-radius: 12px; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); position: relative; font-family: inherit; }
            .z-modal-box h3 { margin-top: 0; font-size: 18px; color: #0f172a; font-weight: 800; margin-bottom: 15px; }
            .z-modal-group { margin-bottom: 14px; }
            .z-modal-group label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 5px; }
            .z-modal-group input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; box-sizing: border-box; }
            .z-modal-group input:focus { border-color: #0284c7; }
            .z-modal-close { position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 20px; font-weight: bold; cursor: pointer; color: #64748b; }
            .z-modal-btn { width: 100%; background: #ea580c; color: #fff; border: none; padding: 12px; border-radius: 6px; font-size: 15px; font-weight: bold; cursor: pointer; margin-top: 10px; transition: background 0.2s; }
            .z-modal-btn:hover { background: #c2410c; }
            @media (max-width: 900px) { .z-calc-box { grid-template-columns: 1fr; } .z-calc-cat-content { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
    }

    window.zToggleCategory = function(headerElement) {
        headerElement.parentElement.classList.toggle('active');
    };

    window.zCalcLogic = function() {
        var checkboxes = document.querySelectorAll('.z-calc-wrapper input[type="checkbox"]');
        if(checkboxes.length === 0) return;
        
        var totalRetail = 0;
        var selectedHtml = '';

        checkboxes.forEach(function(cb) {
            if(cb.checked) {
                var val = parseInt(cb.getAttribute('data-val')) || 0;
                totalRetail += val;
                
                var labelNode = cb.closest('.z-calc-item').querySelector('.z-calc-label');
                var labelText = labelNode ? labelNode.innerText.trim() : '';
                
                selectedHtml += '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; margin-bottom: 6px; color: #cbd5e1; gap: 8px;">' +
                    '<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">• ' + labelText + '</span>' +
                    '<span style="font-weight: 700; color: #fff; white-space: nowrap;">' + val.toLocaleString('vi-VN') + 'đ</span>' +
                '</div>';
            }
        });

        if (selectedHtml === '') {
            selectedHtml = '<div style="font-size: 11.5px; color: #94a3b8; font-style: italic; text-align: center; padding: 10px 0;">Chưa chọn dịch vụ nào</div>';
        }

        var listContainer = document.getElementById('z-selected-items-list');
        if(listContainer) listContainer.innerHTML = selectedHtml;

        var retailDisplay = document.getElementById('z-live-retail');
        if(retailDisplay) retailDisplay.innerText = totalRetail.toLocaleString('vi-VN') + 'đ';
    };

    window.zOpenCheckoutModal = function() {
        var checkboxes = document.querySelectorAll('.z-calc-wrapper input[type="checkbox"]:checked');
        if(checkboxes.length === 0) {
            alert('Vui lòng chọn ít nhất một gói dịch vụ trước khi xác nhận!');
            return;
        }

        if(document.getElementById('z-custom-modal')) return;

        var modalHtml = '<div class="z-modal-overlay" id="z-custom-modal">' +
            '<div class="z-modal-box">' +
                '<button class="z-modal-close" onclick="zCloseCheckoutModal()">×</button>' +
                '<h3>Xác Nhận Đăng Ký Tư Vấn</h3>' +
                '<div class="z-modal-group">' +
                    '<label>Tên Công Ty / Doanh Nghiệp *</label>' +
                    '<input type="text" id="z-input-company" placeholder="Nhập tên công ty của bạn">' +
                '</div>' +
                '<div class="z-modal-group">' +
                    '<label>Số Điện Thoại Liên Hệ *</label>' +
                    '<input type="tel" id="z-input-phone" placeholder="Nhập số điện thoại liên hệ">' +
                '</div>' +
                '<button class="z-modal-btn" onclick="zSubmitOrderToTelegram()">Gửi Yêu Cầu Đến Doanh Nghiệp</button>' +
            '</div>' +
        '</div>';

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    window.zCloseCheckoutModal = function() {
        var modal = document.getElementById('z-custom-modal');
        if(modal) modal.remove();
    };

    window.zSubmitOrderToTelegram = function() {
        var company = document.getElementById('z-input-company').value.trim();
        var phone = document.getElementById('z-input-phone').value.trim();

        if(!company || !phone) {
            alert('Vui lòng điền đầy đủ Tên công ty và Số điện thoại!');
            return;
        }

        var checkboxes = document.querySelectorAll('.z-calc-wrapper input[type="checkbox"]:checked');
        var itemsList = [];
        var totalVal = 0;

        checkboxes.forEach(function(cb) {
            var val = parseInt(cb.getAttribute('data-val')) || 0;
            totalVal += val;
            var labelNode = cb.closest('.z-calc-item').querySelector('.z-calc-label');
            var labelText = labelNode ? labelNode.innerText.trim() : '';
            itemsList.push('- ' + labelText + ': ' + val.toLocaleString('vi-VN') + 'đ');
        });

        var message = "🔔 YÊU CẦU TƯ VẤN & ĐĂNG KÝ GÓI MỚI!\n\n" +
            "KHÁCH HÀNG TỰ CHỌN GÓI"+ "\n"    
            "🏢 Tên công ty: " + company + "\n" +
            "📞 Số điện thoại: " + phone + "\n\n" +
            "🛒 Chi tiết các gói đã chọn:\n" + itemsList.join('\n') + "\n\n" +
            "-----------------\n" +
            "💰 Tổng thanh toán: " + totalVal.toLocaleString('vi-VN') + "đ";

        var botToken = "8010796365:AAEe85waz1xrjJWv9ilnRJBIVVxz53HKKms";
        var chatId = "1088364004";
        var url = "https://api.telegram.org/bot" + botToken + "/sendMessage";

        var submitBtn = document.querySelector('.z-modal-btn');
        submitBtn.innerText = "Đang gửi yêu cầu...";
        submitBtn.disabled = true;

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message
            })
        })
        .then(function(response) {
            if(response.ok) {
                alert('Gửi yêu cầu thành công! Đội ngũ tư vấn sẽ liên hệ lại với bạn trong thời gian sớm nhất.');
                zCloseCheckoutModal();
            } else {
                alert('Có lỗi xảy ra khi gửi thông báo. Vui lòng thử lại sau!');
            }
        })
        .catch(function(error) {
            console.error(error);
            alert('Lỗi kết nối đến hệ thống Telegram!');
        })
        .finally(function() {
            submitBtn.innerText = "Gửi Yêu Cầu Đến Doanh Nghiệp";
            submitBtn.disabled = false;
        });
    };

    var target = document.querySelector('.boctach_h3_7532');
    if (!target) {
        var h3s = document.getElementsByTagName('h3');
        for (var i = 0; i < h3s.length; i++) {
            if (h3s[i].innerText && h3s[i].innerText.indexOf('Lắp Ráp Gói Lẻ') !== -1) {
                target = h3s[i];
                break;
            }
        }
    }

    if (target) {
        if (document.querySelector('.z-calc-wrapper')) return;
        var html = '<div class="z-calc-wrapper"><div class="z-calc-box">' +
            '<div class="z-calc-left">' +
                '<h4>1. Chọn Các Hạng Mục Lẻ Theo Nhu Cầu</h4>' +
                '<p>Hạng mục I mở sẵn. Bấm vào các hạng mục khác để mở rộng danh sách gói lẻ:</p>' +
                
                // Hạng mục I: Website & Tích hợp
                '<div class="z-calc-category active">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">I. Nền tảng Website & Tích hợp</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" id="item-webshop" checked data-val="12000000" onchange="zCalcLogic()"> Nền tảng Webshop (1 năm)</div><div class="z-calc-cost">12.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" id="item-webbiz" data-val="24000000" onchange="zCalcLogic()"> Nền tảng Webbiz</div><div class="z-calc-cost">24.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked data-val="3600000" onchange="zCalcLogic()"> Số hóa nội dung web (Cơ bản)</div><div class="z-calc-cost">3.600.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="7200000" onchange="zCalcLogic()"> Số hóa nội dung web (Nâng cao)</div><div class="z-calc-cost">7.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked data-val="500000" onchange="zCalcLogic()"> Google Analytics + GSC</div><div class="z-calc-cost">500.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked data-val="500000" onchange="zCalcLogic()"> Bot Telegram</div><div class="z-calc-cost">500.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked data-val="800000" onchange="zCalcLogic()"> Liên kết Socials & Hotline</div><div class="z-calc-cost">800.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked data-val="1000000" onchange="zCalcLogic()"> Tích hợp Chat Zalo OA</div><div class="z-calc-cost">1.000.000đ</div></label>' +
                    '</div>' +
                '</div>' +

                // Hạng mục II: NetID & Định danh
                '<div class="z-calc-category">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">II. Hệ sinh thái NetID & Định danh</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="120000" onchange="zCalcLogic()"> Tài khoản NetID xác thực</div><div class="z-calc-cost">120.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="120000" onchange="zCalcLogic()"> NetID doanh nghiệp (Tick hồng)</div><div class="z-calc-cost">120.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="200000" onchange="zCalcLogic()"> NetID doanh nghiệp (Tick sao)</div><div class="z-calc-cost">200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="600000" onchange="zCalcLogic()"> Số hóa Dữ liệu NetID cá nhân</div><div class="z-calc-cost">600.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID sản phẩm</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="360000" onchange="zCalcLogic()"> Số hóa kênh NetID sản phẩm (Cơ bản)</div><div class="z-calc-cost">360.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Số hóa kênh NetID sản phẩm (Nâng cao)</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID sự kiện</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Số hóa kênh NetID sự kiện (Cơ bản)</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1800000" onchange="zCalcLogic()"> Số hóa kênh NetID sự kiện (Nâng cao)</div><div class="z-calc-cost">1.800.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Kênh NetID theo từ khóa</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID showroom số</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID chia sẻ kiến thức</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID lớp học / CSKH</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="100000" onchange="zCalcLogic()"> In Thẻ Nhựa NetID (Name Card)</div><div class="z-calc-cost">100.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="50000" onchange="zCalcLogic()"> Thiết kế NetID Card mềm</div><div class="z-calc-cost">50.000đ</div></label>' +
                    '</div>' +
                '</div>' +

                // Hạng mục III: POS & Add-On
                '<div class="z-calc-category">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">III. POS, Quản lý bán hàng & Add-On</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Kênh cửa hàng số POS</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Số hóa dữ liệu POS (Cơ bản)</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Số hóa dữ liệu POS (Nâng cao)</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="3900000" onchange="zCalcLogic()"> Phần mềm order</div><div class="z-calc-cost">3.900.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="3000000" onchange="zCalcLogic()"> Duyệt bài & hẹn giờ đăng bài</div><div class="z-calc-cost">3.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="500000" onchange="zCalcLogic()"> Quay số trúng thưởng</div><div class="z-calc-cost">500.000đ</div></label>' +
                    '</div>' +
                '</div>' +

                // Hạng mục IV: Pháp lý, TMĐT, Cloud & Email
                '<div class="z-calc-category">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">IV. Pháp lý, TMĐT, Cloud & Dịch vụ số</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="2000000" onchange="zCalcLogic()"> Đăng ký Trang TMĐT BCT</div><div class="z-calc-cost">2.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="10000000" onchange="zCalcLogic()"> Đăng ký TTĐT tổng hợp</div><div class="z-calc-cost">10.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1000000" onchange="zCalcLogic()"> Đăng ký Tín nhiệm mạng</div><div class="z-calc-cost">1.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Tạo Zalo OA</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="800000" onchange="zCalcLogic()"> Tạo Google Map đầy đủ</div><div class="z-calc-cost">800.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="500000" onchange="zCalcLogic()"> Tạo Fanpage</div><div class="z-calc-cost">500.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1848000" onchange="zCalcLogic()"> Cloud Server / Drive (1TB)</div><div class="z-calc-cost">1.848.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="2772000" onchange="zCalcLogic()"> Cloud Server / Drive (2TB)</div><div class="z-calc-cost">2.772.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="3696000" onchange="zCalcLogic()"> Cloud Server / Drive (3TB)</div><div class="z-calc-cost">3.696.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="6468000" onchange="zCalcLogic()"> Cloud Server / Drive (6TB)</div><div class="z-calc-cost">6.468.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="910000" onchange="zCalcLogic()"> Email tên miền (05 tài khoản)</div><div class="z-calc-cost">910.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="4900000" onchange="zCalcLogic()"> Email tên miền (20 tài khoản)</div><div class="z-calc-cost">4.900.000đ</div></label>' +
                    '</div>' +
                '</div>' +

                // Hạng mục V: Số hóa bài viết & Nội dung
                '<div class="z-calc-category">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">V. Dịch vụ số hóa bài viết & Nội dung</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="500000" onchange="zCalcLogic()"> Số hóa bài viết sản phẩm (Mức 1)</div><div class="z-calc-cost">500.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="800000" onchange="zCalcLogic()"> Số hóa bài viết sản phẩm (Mức 2)</div><div class="z-calc-cost">800.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="2000000" onchange="zCalcLogic()"> Số hóa bài viết sản phẩm (Mức 3)</div><div class="z-calc-cost">2.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="150000" onchange="zCalcLogic()"> Số hóa bài viết thông tin DN (Mức 1)</div><div class="z-calc-cost">150.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1500000" onchange="zCalcLogic()"> Số hóa bài viết thông tin DN (Mức 2)</div><div class="z-calc-cost">1.500.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="250000" onchange="zCalcLogic()"> Số hóa bài viết sự kiện (Mức 1)</div><div class="z-calc-cost">250.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="600000" onchange="zCalcLogic()"> Số hóa bài viết sự kiện (Mức 2)</div><div class="z-calc-cost">600.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="70000" onchange="zCalcLogic()"> Số hóa bài viết thông tin/kiến thức (Mức 1)</div><div class="z-calc-cost">70.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="150000" onchange="zCalcLogic()"> Số hóa bài viết thông tin/kiến thức (Mức 2)</div><div class="z-calc-cost">150.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="550000" onchange="zCalcLogic()"> Số hóa bài viết thông tin/kiến thức (Mức 3)</div><div class="z-calc-cost">550.000đ</div></label>' +
                    '</div>' +
                '</div>' +

                // Hạng mục VI: Thiết kế Banner, Hình ảnh & Video AI
                '<div class="z-calc-category">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">VI. Thiết kế Banner, Hình ảnh & Video AI</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="200000" onchange="zCalcLogic()"> Thiết kế Logo (Cơ bản)</div><div class="z-calc-cost">200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1000000" onchange="zCalcLogic()"> Thiết kế Logo (Nâng cao)</div><div class="z-calc-cost">1.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="100000" onchange="zCalcLogic()"> Banner chính/phụ/giữa/vuông (Cơ bản)</div><div class="z-calc-cost">100.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="200000" onchange="zCalcLogic()"> Banner chính/phụ/giữa/vuông (Nâng cao)</div><div class="z-calc-cost">200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="150000" onchange="zCalcLogic()"> Menu hình ảnh / Banner bài viết</div><div class="z-calc-cost">150.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="250000" onchange="zCalcLogic()"> Menu icon không nền</div><div class="z-calc-cost">250.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="25000" onchange="zCalcLogic()"> Hình ảnh AI trong bài vệ tinh</div><div class="z-calc-cost">25.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="400000" onchange="zCalcLogic()"> Video AI mức 1 (10s)</div><div class="z-calc-cost">400.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="800000" onchange="zCalcLogic()"> Video AI mức 2 (10s-30s)</div><div class="z-calc-cost">800.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Video AI mức 4 (30s-45s)</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1500000" onchange="zCalcLogic()"> Video AI mức 5 (45s-60s)</div><div class="z-calc-cost">1.500.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="530000" onchange="zCalcLogic()"> Video trailer sự kiện</div><div class="z-calc-cost">530.000đ</div></label>' +
                    '</div>' +
                '</div>' +

            '</div>' +
            '<div class="z-calc-right">' +
                '<div>' +
                    '<h4>2. GIỎ HÀNG ĐÃ CHỌN</h4>' +
                    '<div class="z-selected-list" id="z-selected-items-list">' +
                        '<!-- Danh sách dịch vụ user chọn sẽ hiển thị động ở đây -->' +
                    '</div>' +
                    '<div class="z-calc-sum-row"><span>Tổng thanh toán:</span></div>' +
                    '<div class="z-suggest-price" id="z-live-retail">0đ</div>' +
                '</div>' +
                '<button type="button" onclick="zOpenCheckoutModal()" style="width: 100%; background: #ea580c; color: #fff; border: none; padding: 12px; border-radius: 6px; font-weight: bold; margin-top: 15px; font-size: 14px; cursor: pointer; text-align: center;">' +
                    'Xác Nhận Đăng Ký Các Gói Đã Chọn &rarr;' +
                '</button>' +
            '</div>' +
        '</div></div>';
        
        target.insertAdjacentHTML('afterend', html);
        zCalcLogic();
    }
})();