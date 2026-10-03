/**
 * ============================================================================
 * DOANH THU SYNC — Mã nhúng theo dõi <p class="chuxanh tongtienthu" data-value>
 * ============================================================================
 * Đặt trong thẻ <head> của WEBSITE NGUỒN:
 *
 *   <script
 *     src="https://<dashboard-domain>/doanh-thu-sync.js"
 *     data-endpoint="https://<project>.supabase.co/functions/v1/sync-revenue"
 *     data-ma-xa="89398"
 *     data-ma-tinh="89"
 *     data-token="<SECRET_TOKEN>"
 *     defer></script>
 *
 * Hoặc cấu hình qua JS (nếu không muốn lộ token trong attribute):
 *
 *   <script>window.DOANH_THU_SYNC = {
 *     endpoint: "...", maXa: "89398", maTinh: "89", token: "...",
 *     selector: "p.chuxanh.tongtienthu", attribute: "data-value"
 *   };</script>
 *
 * ĐẶC TÍNH:
 *  - Dùng MutationObserver theo dõi CHÍNH XÁC thuộc tính data-value.
 *  - Chỉ gửi khi giá trị THỰC SỰ đổi (chống spam) + debounce 300ms.
 *  - Tự thử lại (retry) tối đa 3 lần với backoff khi mạng lỗi.
 *  - Không dùng thư viện ngoài, không chặn render (defer).
 *  - KHÔNG ghi log token ra console khi DEBUG = false.
 * ============================================================================
 */
(function () {
  "use strict";

  var PREFIX = "[doanh-thu-sync]";
  var scriptEl = document.currentScript;

  function attr(name) {
    return scriptEl && scriptEl.getAttribute ? scriptEl.getAttribute(name) : null;
  }

  var cfg = window.DOANH_THU_SYNC || {};

  function pick(cfgKey, attrName, fallback) {
    var v = cfg[cfgKey];
    if (v === undefined || v === null || v === "") v = attr(attrName);
    if (v === undefined || v === null || v === "") v = fallback;
    return v;
  }

  var CONFIG = {
    endpoint: String(pick("endpoint", "data-endpoint", "")).trim(),
    maXa: String(pick("maXa", "data-ma-xa", "")).trim(),
    maTinh: String(pick("maTinh", "data-ma-tinh", "")).trim() || null,
    token: String(pick("token", "data-token", "")).trim(),
    selector: String(pick("selector", "data-selector", "p.chuxanh.tongtienthu")),
    attribute: String(pick("attribute", "data-attribute", "data-value")),
    debounceMs: Number(pick("debounceMs", "data-debounce-ms", 300)) || 300,
    debug: String(pick("debug", "data-debug", "false")) === "true",
  };

  var lastSentValue = null;
  var debounceTimer = null;

  function log() {
    if (!CONFIG.debug || !window.console) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift(PREFIX);
    window.console.log.apply(window.console, args);
  }

  function warn() {
    if (!window.console) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift(PREFIX);
    window.console.warn.apply(window.console, args);
  }

  /**
   * Parse số từ chuỗi có thể ở định dạng Việt Nam ("1.234.567", "1,5", "1 234").
   * Trả về null nếu không đọc được.
   */
  function parseNumber(raw) {
    if (typeof raw === "number") return isFinite(raw) ? raw : null;
    if (raw === null || raw === undefined) return null;

    var s = String(raw).trim();
    if (!s) return null;
    s = s.replace(/[^0-9.,-]/g, "");
    if (!s || s === "-") return null;

    var lastDot = s.lastIndexOf(".");
    var lastComma = s.lastIndexOf(",");
    var decSep = "";

    if (lastDot > -1 && lastComma > -1) {
      decSep = lastDot > lastComma ? "." : ",";
    } else if (lastComma > -1) {
      var pc = s.split(",");
      decSep = pc.length === 2 && pc[1].length !== 3 ? "," : "";
    } else if (lastDot > -1) {
      var pd = s.split(".");
      decSep = pd.length === 2 && pd[1].length !== 3 ? "." : "";
    }

    if (decSep) {
      var idx = s.lastIndexOf(decSep);
      s = s.slice(0, idx).replace(/[.,]/g, "") + "." +
          s.slice(idx + 1).replace(/[.,]/g, "");
    } else {
      s = s.replace(/[.,]/g, "");
    }

    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  /** Đọc giá trị hiện tại từ element (ưu tiên attribute data-value). */
  function readValue(el) {
    if (!el) return null;
    var fromAttr = parseNumber(el.getAttribute(CONFIG.attribute));
    if (fromAttr !== null) return fromAttr;
    return parseNumber(el.textContent);
  }

  /** Gửi giá trị lên Edge Function (có dedupe + retry). */
  function pushValue(value, attempt) {
    attempt = attempt || 1;

    if (value === null) {
      warn("Bỏ qua: không đọc được số từ", CONFIG.selector);
      return;
    }
    if (value === lastSentValue) {
      log("Bỏ qua: giá trị chưa đổi =", value);
      return;
    }
    if (!CONFIG.endpoint || !CONFIG.maXa || !CONFIG.token) {
      warn("Thiếu cấu hình endpoint / maXa / token.");
      return;
    }

    lastSentValue = value;

    var payload = {
      ma_xa: CONFIG.maXa,
      gia_tri: value,
      url_nguon: location.href,
    };
    if (CONFIG.maTinh) payload.ma_tinh = CONFIG.maTinh;

    fetch(CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-token": CONFIG.token,
      },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        log("Đã đồng bộ:", CONFIG.maXa, "=", value, data && data.changed === false ? "(dedup)" : "");
      })
      .catch(function (err) {
        warn("Gửi thất bại (lần " + attempt + "):", err && err.message);
        // Cho phép gửi lại giá trị này ở lần thử kế tiếp
        if (lastSentValue === value) lastSentValue = null;
        if (attempt < 3) {
          var delay = 1000 * Math.pow(2, attempt - 1);
          window.setTimeout(function () {
            pushValue(value, attempt + 1);
          }, delay);
        }
      });
  }

  /** Lên lịch gửi (debounce) để tránh bắn liên tục khi DOM nhảy nhiều lần. */
  function scheduleSync(el) {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(function () {
      debounceTimer = null;
      pushValue(readValue(el));
    }, CONFIG.debounceMs);
  }

  /** Gắn MutationObserver vào element mục tiêu. */
  function observe(el) {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        // Trường hợp chính: đổi thuộc tính data-value
        if (m.type === "attributes" && m.attributeName === CONFIG.attribute) {
          scheduleSync(el);
          return;
        }
        // Trường hợp phụ: website cập nhật bằng text bên trong <p>
        if (m.type === "childList" || m.type === "characterData") {
          scheduleSync(el);
          return;
        }
      }
    });

    observer.observe(el, {
      attributes: true,
      attributeFilter: [CONFIG.attribute],
      childList: true,
      characterData: true,
      subtree: true,
    });

    log("Đang theo dõi:", CONFIG.selector, "· thuộc tính:", CONFIG.attribute);
    return observer;
  }

  /** Khởi tạo: chờ element xuất hiện (SPA render trễ) rồi gắn observer. */
  function init(retry) {
    retry = retry || 0;

    if (!window.MutationObserver) {
      warn("Trình duyệt không hỗ trợ MutationObserver.");
      return;
    }

    var el = document.querySelector(CONFIG.selector);
    if (!el) {
      if (retry < 20) {
        window.setTimeout(function () {
          init(retry + 1);
        }, 500);
      } else {
        warn("Không tìm thấy element:", CONFIG.selector);
      }
      return;
    }

    observe(el);
    pushValue(readValue(el)); // Gửi giá trị đầu tiên ngay khi tải trang
  }

  // API công khai để website nguồn gọi thủ công khi cần.
  window.DoanhThuSync = {
    config: CONFIG,
    read: function () {
      return readValue(document.querySelector(CONFIG.selector));
    },
    push: function (value) {
      pushValue(parseNumber(value));
    },
    refresh: function () {
      var el = document.querySelector(CONFIG.selector);
      if (el) pushValue(readValue(el));
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init(0);
    });
  } else {
    init(0);
  }
})();