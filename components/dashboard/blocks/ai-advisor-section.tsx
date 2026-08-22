"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  Sparkles,
  RefreshCw,
  Clock,
  Building2,
  TrendingUp,
  Target,
  Zap,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import type { DashboardRow } from "@/lib/types";

interface AiAdvisorModalProps {
  dashboard: DashboardRow;
  open: boolean;
  onClose: () => void;
}

export function AiAdvisorModal({ dashboard, open, onClose }: AiAdvisorModalProps) {
  const [selectedScope, setSelectedScope] = useState<"all" | "level1" | "level2">("all");
  const [analysis, setAnalysis] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const cached = dashboard.metadata?.ai_analysis?.[selectedScope];
    if (cached?.content) {
      setAnalysis(cached.content);
      setUpdatedAt(cached.updated_at);
    } else {
      setAnalysis("");
      setUpdatedAt("");
    }
  }, [dashboard, selectedScope, open]);

  if (!open) return null;

  const handleRunAnalysis = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: dashboard.id,
          level: selectedScope === "all" ? 0 : selectedScope === "level1" ? 1 : 2,
          scope: selectedScope,
          forceRefresh: force,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không thể phân tích dữ liệu");
      }

      setAnalysis(json.data);
      setUpdatedAt(json.updatedAt);
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối API AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-[#071326] border border-[#1e3a5f] rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header Modal */}
        <div className="relative shrink-0 px-6 py-5 border-b border-white/10 bg-gradient-to-r from-cyan-950/60 via-[#0a1c38] to-[#071326] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-blue-600/30 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Bot size={22} />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
              </span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-cyan-400/20 px-2 py-0.5 text-[10px] font-black tracking-wider text-cyan-300 border border-cyan-400/30 uppercase">
                  TRỢ LÝ AI ĐIỀU HÀNH
                </span>
                {updatedAt && (
                  <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                    <Clock size={11} />
                    {new Date(updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
                    {new Date(updatedAt).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-white truncate mt-0.5">
                Phân Tích Dữ Liệu & Lời Khuyên Chiến Lược
              </h3>
              <p className="text-xs text-slate-400 truncate">
                Địa bàn: <strong className="text-cyan-300">{dashboard.title}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Phạm vi phân tích */}
        <div className="shrink-0 px-6 py-3 bg-[#0a1830]/70 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "Toàn diện (Tầng 1 & 2)", icon: Zap },
              { id: "level1", label: "Tầng 1: Đơn vị KD & CĐS", icon: Building2 },
              { id: "level2", label: "Tầng 2: Hệ sinh thái Nhóm A-E", icon: TrendingUp },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedScope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedScope(tab.id as any)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#0d274c] text-[#00d2ff] border border-[#00d2ff]/50 shadow-sm"
                      : "bg-slate-900/60 text-slate-400 border border-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={13} className={isActive ? "text-[#00d2ff]" : "text-slate-400"} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleRunAnalysis(Boolean(analysis))}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-900/40 transition active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Đang phân tích...</span>
              </>
            ) : analysis ? (
              <>
                <RefreshCw size={13} />
                <span>Phân tích lại</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Bắt đầu phân tích</span>
              </>
            )}
          </button>
        </div>

        {/* Thông báo lỗi */}
        {error && (
          <div className="m-6 mb-0 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs sm:text-sm text-rose-300 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Nội dung kết quả phân tích */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="h-5 w-1/3 rounded bg-slate-800" />
              <div className="h-4 w-full rounded bg-slate-800/60" />
              <div className="h-4 w-5/6 rounded bg-slate-800/40" />
              <div className="h-4 w-4/6 rounded bg-slate-800/60" />
              <div className="h-24 w-full rounded-2xl bg-slate-900/60 mt-4" />
            </div>
          ) : analysis ? (
            <div className="rounded-2xl border border-white/5 bg-[#050e1c]/80 p-5 sm:p-6 text-slate-200">
              <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-4 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 size={15} />
                <span>Báo cáo chiến lược do AI trích xuất từ dữ liệu thời gian thực</span>
              </div>
              <div className="prose prose-invert max-w-none prose-headings:text-cyan-300 prose-headings:font-bold prose-h3:text-sm prose-h3:mt-5 prose-h3:mb-2 prose-strong:text-emerald-400 prose-p:text-slate-300 prose-p:leading-relaxed prose-li:text-slate-300 whitespace-pre-line text-xs sm:text-sm">
                {analysis}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700/80 bg-[#050e1c]/40 p-10 text-center flex flex-col items-center justify-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-400 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <Target size={28} />
              </span>
              <h4 className="text-base font-bold text-slate-100">
                Sẵn sàng phân tích chiến lược cho {selectedScope === "all" ? "Toàn bộ Địa bàn" : selectedScope === "level1" ? "Tầng 1" : "Tầng 2"}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mt-1.5">
                AI sẽ tự động đọc toàn bộ cơ sở dữ liệu thực tế, tìm ra điểm nghẽn chuyển đổi số và kiến nghị các giải pháp hành động cụ thể.
              </p>
              <button
                type="button"
                onClick={() => handleRunAnalysis(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:brightness-110"
              >
                <Sparkles size={14} />
                Bắt đầu phân tích ngay
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AiAdvisorModal;