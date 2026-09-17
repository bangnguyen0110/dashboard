(function() {
    if (!document.getElementById('z-calc-style')) {
        var style = document.createElement('style');
        style.id = 'z-calc-style';
        style.innerHTML = `
            .z-calc-wrapper { --z-primary: #0284c7; --z-primary-light: #e0f2fe; --z-navy-900: #0f172a; --z-navy-800: #1e293b; --z-navy-600: #475569; --z-slate-50: #f8fafc; --z-slate-200: #e2e8f0; --z-slate-300: #cbd5e1; --z-accent-orange: #ea580c; --z-accent-green: #16a34a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; max-width: 1200px; margin: 20px auto; box-sizing: border-box; }
            .z-calc-wrapper * { box-sizing: border-box; }
            .z-calc-box { background: #fff; border: 1px solid var(--z-slate-300); border-radius: 12px; box-shadow: 0 8px 20px -4px rgba(0,0,0,0.1); display: grid; grid-template-columns: 1.4fr 0.6fr; overflow: hidden; }
            .z-calc-left { padding: 20px; background: #ffffff; border-right: 1px solid var(--z-slate-200); max-height: 520px; overflow-y: auto; scrollbar-width: thin; }
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
            .z-calc-right h4 { font-size: 13px; color: var(--z-slate-300); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
            .z-calc-sum-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-bottom: 12px; color: var(--z-slate-300); }
            .z-calc-sum-row strong { color: #fff; text-decoration: line-through; font-size: 16px; font-weight: 800; }
            .z-calc-suggest { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin: 10px 0; }
            .z-calc-suggest small { font-size: 10px; color: var(--z-accent-orange); font-weight: 800; display: block; margin-bottom: 4px; text-transform: uppercase; }
            .z-calc-suggest strong { font-size: 14px; display: block; margin-bottom: 4px; color: #fff; }
            .z-suggest-price { font-size: 22px; font-weight: 900; color: #fff; }
            .z-calc-save-badge { background: var(--z-accent-green); color: #fff; padding: 8px; border-radius: 6px; text-align: center; font-weight: 900; font-size: 13px; margin-top: 8px; box-shadow: 0 4px 10px rgba(22, 163, 74, 0.3); }
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
        var hasWebshop = false;
        var hasPos = false;

        checkboxes.forEach(function(cb) {
            if(cb.checked) {
                var val = parseInt(cb.getAttribute('data-val')) || 0;
                totalRetail += val;
                if(cb.id === 'item-webshop') hasWebshop = true;
                if(cb.id === 'item-pos') hasPos = true;
            }
        });

        var retailDisplay = document.getElementById('z-live-retail');
        if(retailDisplay) retailDisplay.innerText = totalRetail.toLocaleString('vi-VN') + 'đ';

        var comboName = "Giải Pháp Kinh Doanh Số Tùy Chỉnh";
        var comboPrice = 7200000;

        if (hasWebshop && totalRetail >= 15000000) {
            comboName = "Giải pháp Doanh nghiệp (Kinh doanh số)";
            comboPrice = 10000000;
        } else if (hasWebshop) {
            comboName = "Giải pháp Doanh nghiệp (Khởi đầu)";
            comboPrice = 6400000;
        } else if (hasPos) {
            comboName = "Giải pháp bán hàng dành cho Tiểu thương";
            comboPrice = 1200000;
        } else {
            comboPrice = Math.round(totalRetail * 0.6);
        }

        var savings = totalRetail - comboPrice;
        var percentSave = totalRetail > 0 ? Math.round((savings / totalRetail) * 100) : 0;

        var titleEl = document.getElementById('z-combo-title');
        var priceEl = document.getElementById('z-combo-price');
        var badge = document.getElementById('z-live-save');

        if(titleEl) titleEl.innerText = comboName;
        if(priceEl) priceEl.innerText = comboPrice.toLocaleString('vi-VN') + 'đ';
        
        if(badge) {
            if(savings > 0) {
                badge.innerText = '🎉 TIẾT KIỆM NGAY: ' + savings.toLocaleString('vi-VN') + 'đ (' + percentSave + '%)';
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
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
                
                // Hạng mục I: Website & Webshop (Mở sẵn)
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
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" id="item-netid" data-val="120000" onchange="zCalcLogic()"> Tài khoản NetID xác thực</div><div class="z-calc-cost">120.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="120000" onchange="zCalcLogic()"> NetID doanh nghiệp (Tick hồng)</div><div class="z-calc-cost">120.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="200000" onchange="zCalcLogic()"> NetID doanh nghiệp (Tick sao)</div><div class="z-calc-cost">200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="600000" onchange="zCalcLogic()"> Số hóa Dữ liệu NetID cá nhân</div><div class="z-calc-cost">600.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID sản phẩm</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Số hóa dữ liệu kênh sản phẩm</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID showroom số</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID sự kiện</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Kênh NetID kiến thức / lớp học</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="100000" onchange="zCalcLogic()"> In Thẻ Nhựa NetID (Name Card)</div><div class="z-calc-cost">100.000đ</div></label>' +
                    '</div>' +
                '</div>' +

                // Hạng mục III: POS & Quản lý bán hàng
                '<div class="z-calc-category">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">III. POS, Quản lý bán hàng & Add-On</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" id="item-pos" data-val="1200000" onchange="zCalcLogic()"> Kênh cửa hàng số POS</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="720000" onchange="zCalcLogic()"> Số hóa dữ liệu POS (Cơ bản)</div><div class="z-calc-cost">720.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Số hóa dữ liệu POS (Nâng cao)</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="3900000" onchange="zCalcLogic()"> Phần mềm order</div><div class="z-calc-cost">3.900.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="3000000" onchange="zCalcLogic()"> Duyệt bài & hẹn giờ đăng bài</div><div class="z-calc-cost">3.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="500000" onchange="zCalcLogic()"> Quay số trúng thưởng</div><div class="z-calc-cost">500.000đ</div></label>' +
                    '</div>' +
                '</div>' +

                // Hạng mục IV: Pháp lý, TMĐT & Dịch vụ số
                '<div class="z-calc-category">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">IV. Pháp lý, TMĐT, Cloud & Dịch vụ số</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="2000000" onchange="zCalcLogic()"> Đăng ký Trang TMĐT BCT</div><div class="z-calc-cost">2.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1000000" onchange="zCalcLogic()"> Đăng ký Tín nhiệm mạng</div><div class="z-calc-cost">1.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Tạo Zalo OA</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="800000" onchange="zCalcLogic()"> Tạo Google Map đầy đủ</div><div class="z-calc-cost">800.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="500000" onchange="zCalcLogic()"> Tạo Fanpage</div><div class="z-calc-cost">500.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1848000" onchange="zCalcLogic()"> Cloud Server / Drive (1TB)</div><div class="z-calc-cost">1.848.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="910000" onchange="zCalcLogic()"> Email tên miền (05 tài khoản)</div><div class="z-calc-cost">910.000đ</div></label>' +
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
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="70000" onchange="zCalcLogic()"> Số hóa bài viết kiến thức / vệ tinh</div><div class="z-calc-cost">70.000đ</div></label>' +
                    '</div>' +
                '</div>' +

                // Hạng mục VI: Thiết kế Banner, Hình ảnh & Video AI
                '<div class="z-calc-category">' +
                    '<div class="z-calc-cat-header" onclick="zToggleCategory(this)">VI. Thiết kế Banner, Hình ảnh & Video AI</div>' +
                    '<div class="z-calc-cat-content">' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1000000" onchange="zCalcLogic()"> Thiết kế Logo (Nâng cao)</div><div class="z-calc-cost">1.000.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="200000" onchange="zCalcLogic()"> Banner chính / phụ (Nâng cao)</div><div class="z-calc-cost">200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="150000" onchange="zCalcLogic()"> Menu hình ảnh</div><div class="z-calc-cost">150.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="25000" onchange="zCalcLogic()"> Hình ảnh AI trong bài vệ tinh</div><div class="z-calc-cost">25.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="800000" onchange="zCalcLogic()"> Video AI truyền thông (10s-30s)</div><div class="z-calc-cost">800.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="1200000" onchange="zCalcLogic()"> Video AI truyền thông (30s-45s)</div><div class="z-calc-cost">1.200.000đ</div></label>' +
                        '<label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" data-val="530000" onchange="zCalcLogic()"> Video trailer sự kiện</div><div class="z-calc-cost">530.000đ</div></label>' +
                    '</div>' +
                '</div>' +

            '</div>' +
            '<div class="z-calc-right">' +
                '<div>' +
                    '<h4>2. KẾT QUẢ ĐỐI SOÁT & GỢI Ý COMBO</h4>' +
                    '<div class="z-calc-sum-row"><span>Tổng tiền nếu mua lẻ:</span><strong id="z-live-retail">18.400.000đ</strong></div>' +
                    '<div class="z-calc-suggest">' +
                        '<small>COMBO TỐI ƯU ĐỀ XUẤT:</small>' +
                        '<strong id="z-combo-title">Giải pháp Doanh nghiệp (Khởi đầu)</strong>' +
                        '<div class="z-suggest-price" id="z-combo-price">6.400.000đ <span style="font-size: 12px; font-weight: 500;">/ năm</span></div>' +
                    '</div>' +
                    '<div class="z-calc-save-badge" id="z-live-save">🎉 TIẾT KIỆM NGAY: 12.000.000đ (65%)</div>' +
                '</div>' +
                '<a href="tel:0900360360" style="display: block; text-align: center; background: #ea580c; color: #fff; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 12px; font-size: 13.5px;">' +
                    'Nhận Báo Giá & Đăng Ký Combo Này &rarr;' +
                '</a>' +
            '</div>' +
        '</div></div>';
        
        target.insertAdjacentHTML('afterend', html);
        zCalcLogic();
    }
})();