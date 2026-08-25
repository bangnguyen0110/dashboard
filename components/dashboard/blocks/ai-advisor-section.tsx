"use client";

import React, { useState, useEffect, useRef } from "react";
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

  // State cho tính năng chat/hỏi đáp tùy chỉnh với AI trong Popup
  const [userQuery, setUserQuery] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [aiChatResponse, setAiChatResponse] = useState<{ question: string; answer: string } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

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
    setAiChatResponse(null);
    setUserQuery("");
  }, [dashboard, selectedScope, open]);

  useEffect(() => {
    if (aiChatResponse && !chatLoading) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [aiChatResponse, chatLoading]);

  if (!open) return null;

  const handleRunAnalysis = async (force = false) => {
    setLoading(true);
    setError(null);
    setAiChatResponse(null);
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

  // 🌟 Hàm gửi câu hỏi tùy chỉnh hoặc từ gợi ý nhanh đến API AI
  const handleAskCustomQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;
    setChatLoading(true);
    setError(null);

    const prompt = `Dựa trên số liệu thực tế chuyển đổi số và kinh tế của địa bàn ${dashboard.title}, hãy trả lời câu hỏi sau một cách chi tiết, sắc sảo và sát thực tế:\n\n"${questionText}"`;

    try {
      const res = await fetch("/api/v1/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: dashboard.id,
          customPrompt: prompt,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAiChatResponse({ question: questionText, answer: json.data });
        setUserQuery("");
      } else {
        throw new Error(json.error);
      }
    } catch (err: any) {
      setError(err.message || "Không thể phản hồi câu hỏi");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-[#071326] border border-[#1e3a5f] rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header Modal */}
        <div className="relative shrink-0 px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/60 via-[#0a1c38] to-[#071326] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-blue-600/30 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Bot size={20} />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
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
                    {new Date(updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-white truncate mt-0.5">
                Phân Tích Dữ Liệu & Lời Khuyên Chiến Lược
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar phạm vi phân tích */}
        <div className="shrink-0 px-6 py-2.5 bg-[#0a1830]/70 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "Toàn diện", icon: Zap },
              { id: "level1", label: "Tầng 1", icon: Building2 },
              { id: "level2", label: "Tầng 2", icon: TrendingUp },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedScope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedScope(tab.id as any)}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#0d274c] text-[#00d2ff] border border-[#00d2ff]/50"
                      : "bg-slate-900/60 text-slate-400 border border-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={12} className={isActive ? "text-[#00d2ff]" : "text-slate-400"} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleRunAnalysis(Boolean(analysis))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span>{analysis ? "Phân tích lại" : "Bắt đầu phân tích"}</span>
          </button>
        </div>

        {error && (
          <div className="m-4 mb-0 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Khu vực hiển thị nội dung phân tích */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="h-4 w-1/3 rounded bg-slate-800" />
              <div className="h-3 w-full rounded bg-slate-800/60" />
              <div className="h-3 w-5/6 rounded bg-slate-800/40" />
              <div className="h-20 w-full rounded-2xl bg-slate-900/60 mt-4" />
            </div>
          ) : analysis ? (
            <div className="rounded-2xl border border-white/5 bg-[#050e1c]/80 p-5 text-slate-200">
              <div className="flex items-center gap-2 pb-2.5 border-b border-white/10 mb-3 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 size={14} />
                <span>Báo cáo chiến lược do AI trích xuất từ dữ liệu thực tế</span>
              </div>
              <div className="prose prose-invert max-w-none prose-headings:text-cyan-300 prose-headings:font-bold prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2 prose-strong:text-emerald-400 prose-p:text-slate-300 prose-p:leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                {analysis}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#050e1c]/40 p-8 text-center flex flex-col items-center justify-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-400 mb-3 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Target size={24} />
              </span>
              <h4 className="text-sm font-bold text-slate-100">
                Sẵn sàng phân tích chiến lược cho {dashboard.title}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Bấm nút "Bắt đầu phân tích" ở trên hoặc chọn các câu hỏi gợi ý bên dưới để AI hỗ trợ ngay.
              </p>
            </div>
          )}

          {/* Hiển thị phản hồi khi user hỏi đáp riêng */}
          {aiChatResponse && (
            <div className="rounded-2xl border border-cyan-500/40 bg-[#061225] p-5 shadow-2xl relative animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                <h5 className="text-xs font-extrabold uppercase tracking-wide text-cyan-300 flex items-center gap-2">
                  <Sparkles size={14} /> Hỏi đáp: &ldquo;{aiChatResponse.question}&rdquo;
                </h5>
                <button type="button" onClick={() => setAiChatResponse(null)} className="text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-200 whitespace-pre-line font-sans">
                {aiChatResponse.answer}
              </p>
            </div>
          )}

          {chatLoading && (
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/30 text-xs text-cyan-300 flex items-center gap-3 animate-pulse">
              <RefreshCw size={15} className="animate-spin text-cyan-400 shrink-0" />
              <span>Trợ lý AI đang tra cứu và trả lời câu hỏi của bạn...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 🌟 PHẦN Ô NHẬP CÂU HỎI & GỢI Ý NHANH NẰM Ở ĐÁY POPUP */}
        <div className="shrink-0 p-4 bg-[#050e1c] border-t border-white/10 space-y-2.5">
          {/* Gợi ý câu hỏi nhanh */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Sparkles size={12} className="text-cyan-400" /> Gợi ý nhanh:
            </span>
            {[
              "Đánh giá điểm yếu lớn nhất của địa bàn?",
              "Đề xuất 3 giải pháp thúc đẩy CĐS hộ kinh doanh?",
              "Phân tích hiệu quả sản phẩm OCOP địa phương?",
              "Chỉ số nào cần ưu tiên cải thiện trong 30 ngày tới?",
            ].map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                disabled={chatLoading}
                onClick={() => handleAskCustomQuestion(suggestion)}
                className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Ô nhập câu hỏi tự do */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !chatLoading) {
                  handleAskCustomQuestion(userQuery);
                }
              }}
              placeholder="Nhập nội dung cần hỏi trợ lý AI về số liệu địa phương..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            />
            <button
              type="button"
              disabled={chatLoading || !userQuery.trim()}
              onClick={() => handleAskCustomQuestion(userQuery)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition"
            >
              {chatLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>Gửi</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AiAdvisorModal;