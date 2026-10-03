"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Save } from "lucide-react";
import { Dialog } from "../dialog";
import type { DashboardRow } from "@/lib/types";
import { defaultMaXa, readRevenueSource } from "@/lib/revenue-sync";

/**
 * ============================================================================
 * Nút "Thiết lập doanh thu" + Modal nhập URL nguồn / Mã Xã.
 * ----------------------------------------------------------------------------
 * - Lưu cấu hình nguồn và sinh SECRET TOKEN qua /api/v1/revenue/source.
 * - Hiển thị sẵn "mã nhúng" (<script ...>) để dán vào thẻ <head> website nguồn.
 * ============================================================================
 */

interface RevenueSetupModalProps {
  dashboard: DashboardRow;
  onClose: () => void;
  /** Gọi sau khi lưu thành công, kèm cấu hình vừa lưu để cha cập nhật tức thời. */
  onSaved?: (info: { maXa: string; maTinh?: string | null }) => void;
}

interface SaveResult {
  token: string;
  endpoint: string;
  scriptUrl: string;
  maXa: string;
  maTinh?: string | null;
}

export function RevenueSetupModal({ dashboard, onClose, onSaved }: RevenueSetupModalProps) {
  const saved = readRevenueSource(dashboard);

  const [maXa, setMaXa] = useState(saved.ma_xa || defaultMaXa(dashboard));
  const [maTinh, setMaTinh] = useState(saved.ma_tinh || "");
  const [urlNguon, setUrlNguon] = useState(saved.url_nguon || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Tải lại cấu hình (kèm token) khi mở modal — để hiển thị mã nhúng sẵn có.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/revenue/source?dashboardId=${encodeURIComponent(dashboard.id)}&reveal=1`
        );
        const data = await res.json().catch(() => null);
        if (!active || !data?.success) return;
        if (data.revenue?.ma_xa) setMaXa(data.revenue.ma_xa);
        if (data.revenue?.ma_tinh) setMaTinh(data.revenue.ma_tinh);
        if (data.revenue?.url_nguon) setUrlNguon(data.revenue.url_nguon);
        if (data.token) {
          setResult({
            token: data.token,
            endpoint: data.endpoint,
            scriptUrl: data.script_url || "/doanh-thu-sync.js",
            maXa: data.revenue.ma_xa,
            maTinh: data.revenue.ma_tinh ?? null,
          });
        }
      } catch {
        // Im lặng: không chặn nhập tay nếu API chưa sẵn sàng.
      }
    })();
    return () => {
      active = false;
    };
  }, [dashboard.id]);

  const buildSnippet = useCallback(
    (token: string, endpoint: string, scriptUrl: string, xa: string, tinh: string) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const src = scriptUrl.startsWith("http") ? scriptUrl : `${origin}${scriptUrl}`;
      const tinhAttr = tinh ? ` data-ma-tinh="${tinh}"` : "";
      return (
        `<script src="${src}" data-endpoint="${endpoint}" ` +
        `data-ma-xa="${xa}"${tinhAttr} data-token="${token}" defer></script>`
      );
    },
    []
  );

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/revenue/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: dashboard.id,
          maXa: maXa.trim(),
          maTinh: maTinh.trim() || undefined,
          urlNguon: urlNguon.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Không lưu được cấu hình doanh thu");
      }
      setResult({
        token: data.token,
        endpoint: data.endpoint,
        scriptUrl: data.script_url || "/doanh-thu-sync.js",
        maXa: data.maXa,
        maTinh: data.maTinh ?? null,
      });
      onSaved?.({ maXa: data.maXa, maTinh: data.maTinh ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Không thể copy tự động — hãy chọn và copy thủ công.");
    }
  };

  const snippet = result
    ? buildSnippet(result.token, result.endpoint, result.scriptUrl, result.maXa, result.maTinh || "")
    : "";

  return (
    <Dialog open title="Thiết lập doanh thu tự động" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="rev-ma-xa" className="mb-1 block text-sm opacity-70">
              Mã Xã/Phường <span className="text-red-400">*</span>
            </label>
            <input
              id="rev-ma-xa"
              type="text"
              value={maXa}
              onChange={(e) => setMaXa(e.target.value)}
              placeholder="vd: 89398"
              required
              className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="rev-ma-tinh" className="mb-1 block text-sm opacity-70">
              Mã Tỉnh
            </label>
            <input
              id="rev-ma-tinh"
              type="text"
              value={maTinh}
              onChange={(e) => setMaTinh(e.target.value)}
              placeholder="vd: 89 (tuỳ chọn)"
              className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="rev-url" className="mb-1 block text-sm opacity-70">
            URL nguồn (trang chứa con số doanh thu)
          </label>
          <input
            id="rev-url"
            type="url"
            value={urlNguon}
            onChange={(e) => setUrlNguon(e.target.value)}
            placeholder="https://xaphuong.example.gov.vn/..."
            className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="mt-1 text-[11px] opacity-50">
            Dùng để đối chiếu/kiểm tra; hệ thống vẫn nhận dữ liệu qua push từ website.
          </p>
        </div>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="glass rounded-xl px-4 py-2 text-sm opacity-80 transition hover:opacity-100"
          >
            Đóng
          </button>
          <button
            type="submit"
            disabled={saving || !maXa.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Đang lưu…" : "Lưu & sinh mã nhúng"}
          </button>
        </div>
      </form>

      {result ? (
        <div className="mt-5 space-y-3 rounded-xl border border-cyan-500/20 bg-[#0c1830]/90 p-4 text-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <Link2 size={14} /> MÃ NHÚNG — dán vào thẻ &lt;head&gt; website nguồn
          </div>

          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/10 bg-[#071326] p-3 text-[11px] leading-relaxed text-cyan-200">
            {snippet}
          </pre>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy(snippet)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Đã copy" : "Copy mã nhúng"}
            </button>

            <button
              type="button"
              onClick={() => void handleCopy(result.endpoint)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:text-cyan-300"
            >
              <Copy size={13} /> Copy Endpoint
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
              <p className="uppercase tracking-wide text-slate-500">Secret Token</p>
              <p className="mt-0.5 break-all font-mono text-emerald-300">{result.token}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
              <p className="uppercase tracking-wide text-slate-500">Endpoint</p>
              <p className="mt-0.5 break-all font-mono text-cyan-300">{result.endpoint}</p>
            </div>
          </div>

          <p className="text-[10px] leading-relaxed text-slate-500">
            ⚠️ Giữ Secret Token an toàn. Chỉ dùng trên HTTPS; có thể cấp lại token mới cho
            từng xã nếu bị lộ.
          </p>
        </div>
      ) : null}
    </Dialog>
  );
}

export default RevenueSetupModal;