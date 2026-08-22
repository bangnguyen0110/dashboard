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
} from "lucide-react";
import type { DashboardRow } from "@/lib/types";

interface AiAnalysisViewProps {
  dashboard: DashboardRow;
}

export function AiAnalysisView({ dashboard }: AiAnalysisViewProps) {
  const [selectedScope, setSelectedScope] = useState<"all" | "level1" | "level2">("all");
  const [analysis, setAnalysis] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nạp cache sẵn có từ metadata
  useEffect(() => {
    const cached = dashboard.metadata?.ai_analysis?.[selectedScope];
    if (cached?.content) {
      setAnalysis(cached.content);
      setUpdatedAt(cached.updated_at);
    } else {
      setAnalysis("");
      setUpdatedAt("");
    }
  }, [dashboard, selectedScope]);

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
    <div className="space-y-6 w-full">
      {/* HEADER TRANG AI */}
      <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-500/15 via-blue-600/10 to-purple-600/15 p-6 shadow-2xl">
        <div className="pointer-events-none absolute -top-20 right-10 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
        
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-blue-600/30 text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.4)]">
              <Bot size={28} />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-cyan-500" />
              </span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wider text-cyan-300 border border-cyan-500/30 uppercase">
                  TRÍ TUỆ NHÂN TẠO ĐIỀU HÀNH
                </span>
                {updatedAt && (
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                    <Clock size={12} />
                    Cập nhật: {new Date(updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
                    {new Date(updatedAt).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl sm:text-2xl font-black uppercase text-slate-100 tracking-wide">
                Trung Tâm Phân Tích & Tư Vấn Chiến Lược AI
              </h2>
              <p className="text-xs text-slate-400">
                Địa bàn: <strong className="text-cyan-300">{dashboard.title}</strong> ({dashboard.unit?.name ?? ""})
              </p>
            </div>
          </div>

          {/* Nút hành động */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleRunAnalysis(Boolean(analysis))}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang phân tích số liệu...</span>
              </>
            ) : analysis ? (
              <>
                <RefreshCw size={16} />
                <span>Phân tích lại số liệu mới</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Bắt đầu phân tích AI</span>
              </>
            )}
          </button>
        </div>

        {/* Thanh chọn Phạm vi phân tích */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {[
            { id: "all", label: "Toàn diện Địa bàn (Tầng 1 & 2)", icon: Zap },
            { id: "level1", label: "Tầng 1: Đơn vị kinh doanh & CĐS", icon: Building2 },
            { id: "level2", label: "Tầng 2: Hệ sinh thái Nhóm A - E", icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedScope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedScope(tab.id as any)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#0d274c] text-[#00d2ff] border border-[#00d2ff]/50 shadow-md"
                    : "bg-slate-900/60 text-slate-400 border border-white/5 hover:text-white"
                }`}
              >
                <Icon size={14} className={isActive ? "text-[#00d2ff]" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* THÔNG BÁO LỖI */}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 flex items-center gap-2">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KHU VỰC HIỂN THỊ NỘI DUNG PHÂN TÍCH */}
      <div className="w-full">
        {loading ? (
          <div className="rounded-3xl border border-[#1d293d] bg-[#0c1830]/90 p-8 shadow-2xl space-y-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-cyan-500/30" />
              <div className="h-5 w-1/3 rounded bg-slate-800" />
            </div>
            <div className="h-4 w-full rounded bg-slate-800/60" />
            <div className="h-4 w-5/6 rounded bg-slate-800/40" />
            <div className="h-4 w-4/6 rounded bg-slate-800/60" />
            <div className="h-20 w-full rounded-2xl bg-slate-900/60 mt-4" />
          </div>
        ) : analysis ? (
          <div className="rounded-3xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 pb-4 border-b border-white/5 mb-6 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 size={16} />
              <span>Báo cáo chiến lược do AI trích xuất từ dữ liệu thời gian thực</span>
            </div>

            <div className="prose prose-invert max-w-none prose-headings:text-cyan-300 prose-headings:font-bold prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3 prose-strong:text-emerald-400 prose-p:text-slate-300 prose-p:leading-relaxed prose-li:text-slate-300 whitespace-pre-line text-sm sm:text-base">
              {analysis}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-700/70 bg-[#0a1124]/60 p-12 text-center flex flex-col items-center justify-center">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-cyan-500/10 text-cyan-400 mb-4 shadow-[0_0_25px_rgba(6,182,212,0.2)]">
              <Target size={32} />
            </span>
            <h3 className="text-lg font-bold text-slate-100">
              Sẵn sàng phân tích chiến lược cho {selectedScope === "all" ? "Toàn bộ Địa bàn" : selectedScope === "level1" ? "Tầng 1" : "Tầng 2"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-2">
              Hệ thống AI sẽ tự động đọc toàn bộ cơ sở dữ liệu thực tế, phát hiện điểm nghẽn chuyển đổi số và kiến nghị kế hoạch hành động cụ thể.
            </p>
            <button
              type="button"
              onClick={() => handleRunAnalysis(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:brightness-110"
            >
              <Sparkles size={15} />
              Bắt đầu phân tích ngay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AiAnalysisView;