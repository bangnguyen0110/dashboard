(function() {
    if (!document.getElementById('z-faq-style')) {
        var style = document.createElement('style');
        style.id = 'z-faq-style';
        style.innerHTML = '.z-faq-wrapper { max-width: 800px; margin: 20px auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; box-sizing: border-box; } .z-faq-wrapper * { box-sizing: border-box; } .z-faq-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: all 0.2s ease; } .z-faq-item:hover { border-color: #0284c7; } .z-faq-item summary { padding: 18px 20px; font-size: 15.5px; font-weight: 700; color: #0f172a; cursor: pointer; user-select: none; list-style: none; display: flex; justify-content: space-between; align-items: center; } .z-faq-item summary::-webkit-details-marker { display: none; } .z-faq-item summary::after { content: "+"; font-size: 22px; font-weight: 700; color: #0284c7; transition: transform 0.2s ease; } .z-faq-item[open] summary::after { transform: rotate(45deg); color: #ea580c; } .z-faq-ans { padding: 0 20px 20px 20px; color: #475569; font-size: 14.5px; line-height: 1.6; border-top: 1px solid #f1f5f9; margin-top: 5px; padding-top: 15px; }';
        document.head.appendChild(style);
    }

    function injectFAQ() {
        if (document.querySelector('.z-faq-wrapper')) return true;

        var target = document.querySelector('.cauhoi_title_7520');
        if (!target) {
            var divs = document.querySelectorAll('div');
            for (var i = 0; i < divs.length; i++) {
                if (divs[i].className && divs[i].className.indexOf('cauhoi_title_7520') !== -1) {
                    target = divs[i];
                    break;
                }
            }
        }
        if (!target) {
            var h3s = document.getElementsByTagName('h3');
            for (var j = 0; j < h3s.length; j++) {
                if (h3s[j].innerText && h3s[j].innerText.indexOf('Câu Hỏi Thường Gặp') !== -1) {
                    target = h3s[j].parentElement;
                    break;
                }
            }
        }

        if (target) {
            var html = '<div class="z-faq-wrapper"><details class="z-faq-item"><summary>1. Tôi không rành về công nghệ thì có sử dụng được hệ thống không?</summary><div class="z-faq-ans">Hoàn toàn được! Điểm khác biệt lớn nhất của chúng tôi là cam kết đào tạo chuyển giao 1 kèm 1. Mọi thao tác đều được thiết kế tối giản, đồng thời hệ thống tích hợp sẵn Trợ lý AI hỗ trợ tự động hóa công việc cho bạn.</div></details><details class="z-faq-item"><summary>2. Cam kết bàn giao trong 1 - 3 ngày bao gồm những gì?</summary><div class="z-faq-ans">Chúng tôi không chỉ cung cấp phần mềm trống. Trong thời gian từ 1 đến 3 ngày, đội ngũ sẽ khởi tạo tên miền, kích hoạt Webshop, nhập sẵn dữ liệu sản phẩm, tối ưu bộ bài viết chuẩn SEO và bàn giao tài khoản vận hành ngay.</div></details><details class="z-faq-item"><summary>3. Sau khi mua gói dịch vụ có phát sinh thêm phí ẩn nào không?</summary><div class="z-faq-ans">Tuyệt đối không. Mọi gói Combo đều được niêm yết minh bạch, có hợp đồng dịch vụ pháp lý và hỗ trợ xuất hóa đơn VAT đầy đủ theo đúng quy định nhà nước.</div></details><details class="z-faq-item"><summary>4. Doanh nghiệp có thể nâng cấp gói dịch vụ sau khi đã trải nghiệm không?</summary><div class="z-faq-ans">Hoàn toàn linh hoạt. Bạn có thể nâng cấp từ gói cơ bản lên gói nâng cao bất cứ lúc nào với chính sách khấu trừ chi phí minh bạch từ hệ thống.</div></details></div>';
            
            target.insertAdjacentHTML('afterend', html);
            return true;
        }
        return false;
    }

    var attempts = 0;
    var interval = setInterval(function() {
        if (injectFAQ() || attempts >= 40) {
            clearInterval(interval);
        }
        attempts++;
    }, 500);
})();