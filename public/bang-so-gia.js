(function() {
    if (!document.getElementById('z-calc-style')) {
        var style = document.createElement('style');
        style.id = 'z-calc-style';
        style.innerHTML = '.z-calc-wrapper { --z-primary: #0284c7; --z-primary-light: #e0f2fe; --z-navy-900: #0f172a; --z-navy-800: #1e293b; --z-navy-600: #475569; --z-slate-50: #f8fafc; --z-slate-200: #e2e8f0; --z-slate-300: #cbd5e1; --z-slate-400: #94a3b8; --z-accent-orange: #ea580c; --z-accent-green: #16a34a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; max-width: 1200px; margin: 20px auto; box-sizing: border-box; } .z-calc-wrapper * { box-sizing: border-box; } .z-calc-box { background: #fff; border: 1px solid var(--z-slate-300); border-radius: 12px; box-shadow: 0 8px 20px -4px rgba(0,0,0,0.1); display: grid; grid-template-columns: 1.3fr 0.7fr; overflow: hidden; } .z-calc-left { padding: 25px; background: #ffffff; } .z-calc-left h4 { font-size: 17px; font-weight: 800; margin-bottom: 6px; color: var(--z-navy-900); line-height: 1.3; } .z-calc-left p { font-size: 14px; color: var(--z-navy-600); margin-bottom: 15px; } .z-calc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .z-calc-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--z-slate-50); border: 1px solid var(--z-slate-200); border-radius: 8px; cursor: pointer; transition: all 0.2s ease; } .z-calc-item:hover { background: var(--z-primary-light); border-color: var(--z-primary); } .z-calc-label { font-size: 13.5px; font-weight: 600; color: var(--z-navy-800); display: flex; align-items: center; gap: 8px; } .z-calc-label input { width: 16px; height: 16px; accent-color: var(--z-primary); cursor: pointer; } .z-calc-cost { font-weight: 800; font-size: 13.5px; color: var(--z-navy-900); } .z-calc-right { background: var(--z-navy-900); color: #fff; padding: 25px; display: flex; flex-direction: column; justify-content: center; } .z-calc-right h4 { font-size: 14px; color: var(--z-slate-300); margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; } .z-calc-sum-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-bottom: 15px; color: var(--z-slate-300); } .z-calc-sum-row strong { color: #fff; text-decoration: line-through; font-size: 18px; font-weight: 800; } .z-calc-suggest { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin: 15px 0; } .z-calc-suggest small { font-size: 11px; color: var(--z-accent-orange); font-weight: 800; display: block; margin-bottom: 5px; text-transform: uppercase; } .z-calc-suggest strong { font-size: 16px; display: block; margin-bottom: 5px; color: #fff; } .z-suggest-price { font-size: 24px; font-weight: 900; color: #fff; } .z-calc-save-badge { background: var(--z-accent-green); color: #fff; padding: 10px; border-radius: 6px; text-align: center; font-weight: 900; font-size: 14px; margin-top: 10px; box-shadow: 0 4px 10px rgba(22, 163, 74, 0.3); } @media (max-width: 900px) { .z-calc-box { grid-template-columns: 1fr; } .z-calc-grid { grid-template-columns: 1fr; } .z-calc-left, .z-calc-right { padding: 20px; } }';
        document.head.appendChild(style);
    }

    window.zCalcLogic = function() {
        var checkboxes = document.querySelectorAll('.z-calc-wrapper input[type="checkbox"]');
        if(checkboxes.length === 0) return;
        var totalRetail = 0;
        for(var i = 0; i < checkboxes.length; i++) {
            if(checkboxes[i].checked) {
                totalRetail += parseInt(checkboxes[i].parentElement.nextElementSibling.getAttribute('data-val'));
            }
        }
        var displayTotal = document.getElementById('z-live-retail');
        if(displayTotal) displayTotal.innerText = totalRetail.toLocaleString('vi-VN') + 'đ';
        var comboPrice = 7200000;
        var savings = totalRetail - comboPrice;
        var badge = document.getElementById('z-live-save');
        if(badge) {
            if(savings > 0) {
                badge.innerText = '🎉 BẠN SẼ TIẾT KIỆM ĐƯỢC: ' + savings.toLocaleString('vi-VN') + 'đ';
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    };

    function inject() {
        if (document.querySelector('.z-calc-wrapper')) return true;
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
            var html = '<div class="z-calc-wrapper"><div class="z-calc-box"><div class="z-calc-left"><h4>1. Tick Chọn Các Dịch Vụ Cần Mua Lẻ</h4><p>Mỗi hạng mục dưới đây đều có thể triển khai độc lập theo nhu cầu của doanh nghiệp:</p><div class="z-calc-grid"><label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked onchange="zCalcLogic()"> Nền tảng Webshop (1 năm)</div><div class="z-calc-cost" data-val="12000000">12.000.000đ</div></label><label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked onchange="zCalcLogic()"> Kênh Cửa hàng số POS</div><div class="z-calc-cost" data-val="1200000">1.200.000đ</div></label><label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked onchange="zCalcLogic()"> Tick xanh NetID + Thẻ NFC</div><div class="z-calc-cost" data-val="220000">220.000đ</div></label><label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked onchange="zCalcLogic()"> Khóa đào tạo Số hóa với AI</div><div class="z-calc-cost" data-val="1200000">1.200.000đ</div></label><label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked onchange="zCalcLogic()"> Tích hợp Chat Zalo OA (Web)</div><div class="z-calc-cost" data-val="1000000">1.000.000đ</div></label><label class="z-calc-item"><div class="z-calc-label"><input type="checkbox" checked onchange="zCalcLogic()"> Đăng ký TMĐT Bộ Công Thương</div><div class="z-calc-cost" data-val="2000000">2.000.000đ</div></label></div></div><div class="z-calc-right"><h4>2. KẾT QUẢ ĐỐI SOÁT</h4><div class="z-calc-sum-row"><span>Tổng tiền nếu mua lẻ:</span><strong id="z-live-retail">17.620.000đ</strong></div><div class="z-calc-suggest"><small>ĐỀ XUẤT COMBO TỐI ƯU CHO BẠN:</small><strong>Giải Pháp Kinh Doanh Số Toàn Diện</strong><div class="z-suggest-price">7.200.000đ <span style="font-size: 14px; font-weight: 500;">/ năm</span></div></div><div class="z-calc-save-badge" id="z-live-save">🎉 BẠN SẼ TIẾT KIỆM ĐƯỢC: 10.420.000đ</div><a href="tel:0939526665" style="display: block; margin-top: 20px; text-align: center; background: #ea580c; color: #fff; padding: 12px; border-radius: 6px; text-decoration: none; font-weight: bold;">Nhận Báo Giá Combo Này &rarr;</a></div></div></div>';
            target.insertAdjacentHTML('afterend', html);
            zCalcLogic();
            return true;
        }
        return false;
    }

    var attempts = 0;
    var interval = setInterval(function() {
        if (inject() || attempts >= 40) {
            clearInterval(interval);
        }
        attempts++;
    }, 500);
})();