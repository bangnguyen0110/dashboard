"use client";

import React, { useState, useEffect } from "react";
import { X, Hash, Globe, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import type { DashboardRow } from "@/lib/types";

export interface MetricIdModalProps {
  isOpen?: boolean;
  open?: boolean;
  dashboard?: DashboardRow;
  metricKey: string;
  metricLabel?: string;
  label?: string;
  currentId?: string;
  initialId?: string;
  baseDomain?: string;
  onClose: () => void;
  onSave?: (metricKey: string, id: string, fullUrl?: string, autoScrapedValue?: number) => Promise<void>;
  onSaved?: () => void;
}

export function MetricIdModal({
  isOpen = true,
  open = true,
  dashboard,
  metricKey,
  metricLabel,
  label,
  currentId,
  initialId,
  baseDomain = "",
  onClose,
  onSave,
  onSaved,
}: MetricIdModalProps) {
  // Đồng bộ các biến alias
  const displayLabel = metricLabel || label || metricKey || "chỉ số";
  const defaultId = initialId || currentId || "";
  const resolvedDomain = (
    baseDomain ||
    dashboard?.base_domain ||
    dashboard?.metadata?.base_domain ||
    dashboard?.domain_link ||
    ""
  ).trim().replace(/\/+$/, "");

  const [idInput, setIdInput] = useState(defaultId);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setIdInput(defaultId);
    setStatusMsg(null);
  }, [defaultId, metricKey]);

  // Kiểm tra trạng thái đóng/mở
  const isModalVisible = isOpen && open;
  if (!isModalVisible) return null;

  const cleanId = idInput.trim().replace(/^\/+/, "");
  const fullPreviewUrl = cleanId
    ? resolvedDomain
      ? `${resolvedDomain}/${cleanId}`
      : cleanId
    : resolvedDomain;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanId) {
      setStatusMsg({ type: "error", text: "Vui lòng nhập ID hợp lệ" });
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      if (onSave) {
        await onSave(metricKey, cleanId, fullPreviewUrl);
      }
      if (onSaved) {
        onSaved();
      }

      setStatusMsg({
        type: "success",
        text: "Đã lưu ID & đồng bộ số liệu thành công!",
      });

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi lưu và đồng bộ dữ liệu",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-[#0a1124] border-x-2 border-b-2 border-[#1d293d] border-t-0 rounded-2xl shadow-2xl overflow-hidden text-white my-auto">
        {/* Header */}
        <div className="bg-[#0c1e38] px-6 py-4 border-b border-[#1d293d] flex justify-between items-center">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-cyan-400 uppercase tracking-wider">
              THIẾT LẬP ID & ĐỒNG BỘ DỮ LIỆU
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Áp dụng cho: <strong className="text-slate-200">{displayLabel}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                statusMsg.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Ô nhập ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Mã ID thẻ (text)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Hash size={16} />
              </div>
              <input
                type="text"
                required
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                placeholder="Ví dụ: B4HbFf11820eB5C"
                className="w-full pl-10 pr-4 py-2.5 bg-[#061121] border-x-2 border-b-2 border-[#1d293d] border-t-0 rounded-xl text-sm focus:outline-hidden focus:border-cyan-400 text-slate-100 placeholder-slate-500 font-mono"
              />
            </div>
          </div>

          {/* Đường dẫn tự động ghép */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Đường dẫn tự động tạo</label>
            <div className="p-3 bg-[#061121] rounded-xl border border-[#1d293d] flex items-center gap-2 text-xs text-cyan-300 font-mono break-all">
              <Globe size={14} className="shrink-0 text-slate-400" />
              <span>{fullPreviewUrl || "Chưa có domain"}</span>
            </div>
            
          </div>

          {/* Nút lưu */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Đang đồng bộ..." : "Lưu & Đồng bộ số liệu"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}