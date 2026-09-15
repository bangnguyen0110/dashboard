"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Globe,
  Link2,
  Menu,
  Bot,
  Sparkles,
  RefreshCw,
  Clock,
  TrendingUp,
  Target,
  Zap,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Printer,
  Lightbulb,
  SearchCode,
  SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { getValidUrl } from "@/lib/card-link";
import { LevelMenu, LEVELS, useLevelParam } from "./level-menu";
import { LinkModal } from "./link-modal";
import { ImportPdfModal } from "./import-pdf-modal";
import { CommuneDashboardModal } from "./commune-dashboard-modal";
import { KpiFilterCompareModal } from "./kpi-filter-compare-modal";
import { CellQuantityModal } from "./blocks/cell-quantity-modal";
import { MetricIdModal } from "./blocks/metric-id-modal";
import { B1Section } from "./blocks/b1-section";
import { B2Section } from "./blocks/b2-section";
import { B3Section } from "./blocks/b3-section";
import { B4Section } from "./blocks/b4-section";
import { B5Section } from "./blocks/b5-section";
import { B6Section } from "./blocks/b6-section";
import { B7Section } from "./blocks/b7-section";
import { B8Section } from "./blocks/b8-section";
import { B9Section } from "./blocks/b9-section";
import { Level2View } from "./level-2-view";
import { Level3View } from "./level-3-view";
import { Level4View } from "./level-4-view";
import { Level5View } from "./level-5-view";
import { useAuth } from "@/context/AuthContext";

interface DashboardDetailProps {
  dashboardId: string;
  backHref: string;
}

type ResolvedState = "loading" | "missing" | "ready";

const B1_QTY_METRIC_FIELDS: Record<string, string[]> = {
  b1_sme_total: ["sme_total"],
  b1_hkd_total: ["hkd_total"],
  b1_htx_total: ["htx_total"],
  b1_sme_dx: ["sme_dx", "sme_cds"],
  b1_hkd_dx: ["hkd_dx", "hkd_cds"],
  b1_htx_dx: ["htx_dx", "htx_cds"],
};

const B2_QTY_METRIC_FIELDS: Record<string, string[]> = {
  b2_ocop_3: ["ocop_3star"],
  b2_ocop_4: ["ocop_4star"],
  b2_ocop_5: ["ocop_5star"],
  b2_sp_thuong: ["sp_thuong"],
  b2_dich_vu: ["dich_vu"],
};

const B1_QTY_LABELS: Record<string, string> = {
  b1_sme_total: "Tổng số Doanh nghiệp SME",
  b1_hkd_total: "Tổng số Hộ kinh doanh",
  b1_htx_total: "Tổng số Hợp tác xã",
  b1_sme_dx: "Doanh nghiệp SME CĐS",
  b1_hkd_dx: "Hộ kinh doanh CĐS",
  b1_htx_dx: "Hợp tác xã CĐS",
};

const B1_QTY_TOKENS: Record<string, string[]> = {
  b1_sme_total: ["doanh nghiệp SME", "sme"],
  b1_hkd_total: ["hộ kinh doanh", "hkd"],
  b1_htx_total: ["hợp tác xã", "htx"],
  b1_sme_dx: ["doanh nghiệp SME CĐS", "sme cds"],
  b1_hkd_dx: ["hộ kinh doanh CĐS", "hkd cds"],
  b1_htx_dx: ["hợp tác xã CĐS", "htx cds"],
};

interface MetricFieldMapInfo {
  section: string;
  rowFields: string[];
}

const B3_TO_B9_PREFIXES = ["b3", "b4", "b5", "b6", "b7", "b8", "b9"];
const LEVEL_PREFIXES = ["l2", "l3", "l4", "l5"];

function getMetricFieldMap(metricKey: string): MetricFieldMapInfo | null {
  const prefix = metricKey.split("_")[0];
  if (prefix === "b1") {
    const fields = B1_QTY_METRIC_FIELDS[metricKey];
    if (fields) return { section: "b1", rowFields: fields };
  }
  if (prefix === "b2") {
    const fields = B2_QTY_METRIC_FIELDS[metricKey];
    if (fields) return { section: "b2", rowFields: fields };
  }
  if (B3_TO_B9_PREFIXES.includes(prefix)) {
    return { section: prefix, rowFields: [metricKey.replace(`${prefix}_`, "")] };
  }
  if (LEVEL_PREFIXES.includes(prefix)) {
    return {
      section: prefix,
      rowFields: [metricKey.replace(`${prefix}_`, ""), metricKey],
    };
  }
  return null;
}

function extractNumeric(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "object") {
    const maybe = (raw as { value?: unknown })?.value;
    if (maybe !== undefined && maybe !== null) return extractNumeric(maybe);
  }
  return null;
}

function applyMetricValueToRow(
  row: KpiRow,
  info: MetricFieldMapInfo,
  rawValue: unknown,
  force = false
): KpiRow {
  const parsed = extractNumeric(rawValue);
  if (parsed === null) return row;
  const next = { ...row };
  for (const field of info.rowFields) {
    const existing = Number(next[field]);
    if (force || parsed > 0 || !existing) next[field] = parsed;
  }
  return next;
}

function cleanDashboardTitle(title: string): string {
  if (!title) return "";
  return title
    .replace(/KINH TẶM SỘ/g, "KINH TẾ SỐ")
    .replace(/KINH TẬM SỐ/g, "KINH TẾ SỐ")
    .replace(/TẶM SỘ/g, "TẾ SỐ")
    .replace(/TẬM SỐ/g, "TẾ SỐ");
}

function formatReportContent(text: string): string {
  if (!text) return "";
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  return lines
    .map((line) => {
      const upper = line.toUpperCase();
      if (
        (upper.startsWith("BÁO CÁO") || upper.startsWith("BÁO CÁO PHÂN TÍCH")) &&
        !line.includes(":") &&
        !line.includes("-")
      ) {
        return "";
      }
      if (line.toLowerCase().startsWith("kính gửi:")) {
        return `<div class="doc-recipient"><i>${line}</i></div>`;
      }
      if (/^(I{1,3}|IV|V|VI{0,3}|IX|X)\.\s+/i.test(line)) {
        return `<div class="heading-roman"><strong>${line}</strong></div>`;
      }
      if (/^\d+\.\s+/.test(line)) {
        return `<div class="heading-num"><strong>${line}</strong></div>`;
      }
      if (/^[a-z]\.\s+/i.test(line)) {
        return `<div class="heading-sub"><strong>${line.slice(0, 3)}</strong>${line.slice(3)}</div>`;
      }
      return `<div class="paragraph">${line}</div>`;
    })
    .filter(Boolean)
    .join("");
}

const reportStyles = `
  @page { size: A4 portrait; margin: 20mm 15mm 20mm 25mm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.35; color: #000; background: #fff; margin: 0; padding: 0; }
  .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .header-table td { vertical-align: top; text-align: center; font-size: 12pt; line-height: 1.25; }
  .line-bold { font-weight: bold; }
  .line-normal { font-weight: normal; font-size: 11pt; }
  .line-divider { width: 45%; border-top: 1px solid #000; margin: 4px auto 0; }
  .doc-date { text-align: right; font-style: italic; font-size: 12pt; margin-bottom: 20px; }
  .main-title-box { text-align: center; margin: 15px 0 20px 0; }
  .main-title { font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; }
  .doc-recipient { font-size: 13pt; text-align: left; margin-bottom: 12px; font-style: italic; }
  .heading-roman { font-size: 13pt; font-weight: bold; text-align: left; margin-top: 14px; margin-bottom: 4px; text-transform: uppercase; }
  .heading-num { font-size: 13pt; font-weight: bold; text-align: left; margin-top: 8px; margin-bottom: 3px; padding-left: 12px; }
  .heading-sub { font-size: 13pt; text-align: justify; margin-bottom: 3px; padding-left: 24px; line-height: 1.35; }
  .paragraph { font-size: 13pt; text-align: justify; margin-bottom: 4px; padding-left: 24px; line-height: 1.35; }
`;

/** ================= POPUP MODAL PHÂN TÍCH AI ================= */
function AiAdvisorModal({
  dashboard,
  open,
  onClose,
}: {
  dashboard: DashboardRow;
  open: boolean;
  onClose: () => void;
}) {
  const [selectedScope, setSelectedScope] = useState<"all" | "level1" | "level2">("all");
  const [analysis, setAnalysis] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [userQuery, setUserQuery] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const [selectedText, setSelectedText] = useState("");
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [subLoading, setSubLoading] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);

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
    setMessages([]);
    setUserQuery("");
  }, [dashboard, selectedScope, open]);

  useEffect(() => {
    let timer: any;
    if (loading || chatLoading || subLoading) {
      setProgress(10);
      timer = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + Math.floor(Math.random() * 15) + 5));
      }, 350);
    } else {
      setProgress(100);
    }
    return () => clearInterval(timer);
  }, [loading, chatLoading, subLoading]);

  useEffect(() => {
    if ((messages.length > 0 || chatLoading || subLoading) && open) {
      setTimeout(() => {
        resultEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [messages, chatLoading, subLoading, open]);

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

  const handleAskCustomQuestion = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || chatLoading) return;

    setUserQuery("");
    setChatLoading(true);
    setError(null);

    const nextMessages = [...messages, { role: "user" as const, content: q }];
    setMessages(nextMessages);

    const cleanTitle = cleanDashboardTitle(dashboard.title);
    const prompt = `Dựa trên số liệu thực tế chuyển đổi số và kinh tế của địa bàn ${cleanTitle}, hãy trả lời câu hỏi sau một cách chi tiết, sắc sảo và sát thực tế:\n\n"${q}"`;

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
        setMessages([...nextMessages, { role: "assistant" as const, content: json.data }]);
      } else {
        throw new Error(json.error);
      }
    } catch (err: any) {
      setMessages([...nextMessages, { role: "assistant" as const, content: `Lỗi xử lý: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setTimeout(() => setSelectedText(""), 200);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 3) {
      const container = contentRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const relativeX = e.clientX - containerRect.left;
      const relativeY = e.clientY - containerRect.top + container.scrollTop;

      setSelectedText(text);
      setTooltipPos({
        x: relativeX,
        y: relativeY - 45,
      });
    }
  };

  const handleSubAiAction = async (actionType: "explain" | "deep_analyze") => {
    if (!selectedText) return;
    setSubLoading(true);
    setTooltipPos(null);

    const cleanTitle = cleanDashboardTitle(dashboard.title);
    const actionLabel = actionType === "explain" ? "Giải thích đoạn văn bản" : "Phân tích chiều sâu đoạn văn bản";
    const userQueryLabel = `${actionLabel}: "${selectedText}"`;

    const nextMessages = [...messages, { role: "user" as const, content: userQueryLabel }];
    setMessages(nextMessages);
    setSelectedText("");

    const prompt =
      actionType === "explain"
        ? `Hãy giải thích ngắn gọn, súc tích và dễ hiểu về đoạn văn bản sau dựa theo ngữ cảnh chuyển đổi số của địa bàn ${cleanTitle}:\n\n"${selectedText}"`
        : `Hãy phân tích chuyên sâu, chỉ ra nguyên nhân, tác động và gợi ý giải pháp thực tế đối với đoạn văn bản sau tại địa bàn ${cleanTitle}:\n\n"${selectedText}"`;

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
        setMessages([...nextMessages, { role: "assistant" as const, content: json.data }]);
      } else {
        throw new Error(json.error);
      }
    } catch (err: any) {
      setMessages([...nextMessages, { role: "assistant" as const, content: `Lỗi xử lý: ${err.message}` }]);
    } finally {
      setSubLoading(false);
    }
  };

  const handleDownloadWord = () => {
    if (!analysis) return;
    const unitTitle = cleanDashboardTitle(dashboard.title || "Địa phương");
    const fileName = `Bao_cao_Chien_luoc_${unitTitle.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, "_")}.doc`;
    const dateObj = new Date();
    const dateStr = `ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`;
    const formattedContent = formatReportContent(analysis);

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><style>${reportStyles}</style></head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 42%;">
              <div class="line-bold">UBND ${unitTitle.toUpperCase()}</div>
              <div class="line-normal">HỆ THỐNG ĐIỀU HÀNH SỐ</div>
              <div class="line-divider"></div>
            </td>
            <td style="width: 58%;">
              <div class="line-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div class="line-bold" style="text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</div>
            </td>
          </tr>
        </table>
        <div class="doc-date">${dashboard.unit?.name ?? unitTitle}, ${dateStr}</div>
        <div class="main-title-box">
          <div class="main-title">BÁO CÁO PHÂN TÍCH HIỆN TRẠNG VÀ TƯ VẤN HÀNH ĐỘNG ĐIỀU HÀNH</div>
          <div class="main-title">CHUYỂN ĐỔI SỐ VÀ PHÁT TRIỂN KINH TẾ ĐỊA PHƯƠNG</div>
        </div>
        ${formattedContent}
      </body>
      </html>
    `;
    const blob = new Blob(["\ufeff", htmlContent], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!analysis) return;
    const unitTitle = cleanDashboardTitle(dashboard.title || "Địa phương");
    const dateObj = new Date();
    const dateStr = `ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`;
    const printWindow = window.open("", "_blank", "width=950,height=900");
    if (!printWindow) return;

    const formattedContent = formatReportContent(analysis);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>${reportStyles} @media print { body { padding: 0; } }</style></head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 42%;">
              <div class="line-bold">UBND ${unitTitle.toUpperCase()}</div>
              <div class="line-normal">HỆ THỐNG ĐIỀU HÀNH SỐ</div>
              <div class="line-divider"></div>
            </td>
            <td style="width: 58%;">
              <div class="line-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div class="line-bold" style="text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</div>
            </td>
          </tr>
        </table>
        <div class="doc-date">${dashboard.unit?.name ?? unitTitle}, ${dateStr}</div>
        <div class="main-title-box">
          <div class="main-title">BÁO CÁO PHÂN TÍCH HIỆN TRẠNG VÀ TƯ VẤN HÀNH ĐỘNG ĐIỀU HÀNH</div>
          <div class="main-title">CHUYỂN ĐỔI SỐ VÀ PHÁT TRIỂN KINH TẾ ĐỊA PHƯƠNG</div>
        </div>
        ${formattedContent}
        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 400); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-[#071326] border border-[#1e3a5f] rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header Modal */}
        <div className="relative shrink-0 px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/60 via-[#0a1c38] to-[#071326] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-blue-600/30 text-cyan-300">
              <Bot size={20} />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-white">
                Trợ lý AI Phân tích & Tương tác Báo cáo
              </h3>
              <p className="text-[11px] text-slate-400">
                Địa bàn: <strong className="text-cyan-300">{cleanDashboardTitle(dashboard.title)}</strong>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-slate-800 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
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
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    isActive ? "bg-[#0d274c] text-[#00d2ff] border border-[#00d2ff]/40" : "bg-slate-900 text-slate-400"
                  }`}
                >
                  <Icon size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {analysis && (
              <>
                <button type="button" onClick={handleDownloadWord} className="inline-flex items-center gap-1 rounded-lg bg-blue-600/20 border border-blue-400/40 px-2.5 py-1 text-xs font-bold text-blue-300 hover:bg-blue-600/30">
                  <FileText size={12} /> Word (.doc)
                </button>
                <button type="button" onClick={handleDownloadPdf} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-400/40 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30">
                  <Printer size={12} /> PDF (.pdf)
                </button>
              </>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRunAnalysis(Boolean(analysis))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>{analysis ? "Phân tích lại" : "Bắt đầu phân tích"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 mb-0 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle size={15} /> <span>{error}</span>
          </div>
        )}

        {/* Vùng nội dung chính */}
        <div ref={contentRef} onMouseUp={handleMouseUp} className="relative flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative grid h-16 w-16 place-items-center rounded-full bg-cyan-500/10 text-cyan-400 animate-pulse shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                <Bot size={30} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-slate-200">AI đang phân tích dữ liệu. Bạn vui lòng chờ một chút!</p>
                <p className="text-xs text-slate-400 font-mono">Đang tổng hợp chỉ số chuyên sâu...</p>
              </div>
              <div className="w-full max-w-md bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-mono text-cyan-400 font-bold">{progress}% hoàn thành</span>
            </div>
          )}

          {!loading && analysis && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#050e1c] p-6 text-slate-200 shadow-xl">
                <div className="text-[11px] text-cyan-400 italic mb-3 flex items-center gap-1.5 bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                  <Sparkles size={13} /> Bạn có thể chỉnh sửa trực tiếp văn bản hoặc <strong>bôi đen bất kỳ đoạn văn nào</strong> để xuất hiện Tooltip <strong>Giải thích</strong> và <strong>Phân tích sâu</strong>.
                </div>

                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => setAnalysis(e.currentTarget.innerText)}
                  className="outline-none focus:ring-1 focus:ring-cyan-500/40 rounded-lg p-2 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-sans select-text min-h-[200px]"
                >
                  {analysis}
                </div>
              </div>
            </div>
          )}

          {!loading && !analysis && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Target size={32} className="text-cyan-400 mb-2" />
              <p className="text-sm font-bold text-slate-200">Chưa có kết quả phân tích tổng thể cho phạm vi này.</p>
              <p className="text-xs text-slate-400 mt-1">Bấm nút "Bắt đầu phân tích" ở trên hoặc chọn gợi ý bên dưới để đặt câu hỏi cho AI.</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`flex w-full my-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" ? (
                <div className="flex items-start gap-3 max-w-[90%] sm:max-w-[85%]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Bot size={16} />
                  </span>
                  <div className="rounded-2xl rounded-tl-sm bg-[#061225] border border-cyan-500/30 p-4 text-xs sm:text-sm text-slate-200 shadow-xl whitespace-pre-line font-sans leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex items-end max-w-[85%] sm:max-w-[75%]">
                  <div className="rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-xs sm:text-sm text-white shadow-md whitespace-pre-line font-sans leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))}

          {subLoading && (
            <div className="flex items-center gap-3 my-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">
                <Bot size={16} />
              </span>
              <div className="p-4 rounded-2xl rounded-tl-sm border border-cyan-500/30 bg-cyan-950/30 text-xs text-cyan-300 flex items-center gap-3 animate-pulse shadow-md">
                <RefreshCw size={15} className="animate-spin text-cyan-400" />
                <span>AI đang phân tích đoạn văn bản bạn vừa bôi đen...</span>
              </div>
            </div>
          )}

          {chatLoading && (
            <div className="flex items-center gap-3 my-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">
                <Bot size={16} />
              </span>
              <div className="p-4 rounded-2xl rounded-tl-sm border border-cyan-500/30 bg-cyan-950/30 text-xs text-cyan-300 flex items-center gap-3 animate-pulse shadow-md">
                <RefreshCw size={15} className="animate-spin text-cyan-400" />
                <span>Trợ lý AI đang tra cứu cơ sở dữ liệu và trả lời câu hỏi của bạn...</span>
              </div>
            </div>
          )}

          {selectedText && tooltipPos && (
            <div
              className="absolute z-50 flex items-center gap-1 rounded-xl border border-cyan-500/50 bg-[#071326] p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
              style={{ top: `${tooltipPos.y - 48}px`, left: `${tooltipPos.x}px`, transform: "translateX(-50%)" }}
            >
              <button
                type="button"
                onClick={() => handleSubAiAction("explain")}
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 px-3 py-1.5 text-xs font-bold text-cyan-300 border border-cyan-500/40 transition"
              >
                <Lightbulb size={13} className="text-amber-300" /> Giải thích
              </button>
              <button
                type="button"
                onClick={() => handleSubAiAction("deep_analyze")}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1.5 text-xs font-bold text-blue-300 border border-blue-500/40 transition"
              >
                <SearchCode size={13} className="text-cyan-300" /> Phân tích sâu
              </button>
            </div>
          )}

          <div ref={resultEndRef} />
        </div>

        {/* Ô nhập câu hỏi & gợi ý nhanh ở đáy modal */}
        <div className="shrink-0 p-4 bg-[#050e1c] border-t border-white/10 space-y-2.5">
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
                disabled={chatLoading || subLoading}
                onClick={() => handleAskCustomQuestion(suggestion)}
                className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !chatLoading && !subLoading) {
                  handleAskCustomQuestion(userQuery);
                }
              }}
              placeholder="Nhập nội dung cần hỏi trợ lý AI về số liệu địa phương..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            />
            <button
              type="button"
              disabled={chatLoading || subLoading || !userQuery.trim()}
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

export function DashboardDetail({ dashboardId, backHref }: DashboardDetailProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const loadStartTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    loadStartTimeRef.current = performance.now();
  }, [dashboardId]);

  const [state, setState] = useState<ResolvedState>("loading");
  const [dashboard, setDashboard] = useState<DashboardRow | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dữ liệu Tầng 1
  const [b1, setB1] = useState<KpiRow>({});
  const [b2, setB2] = useState<KpiRow>({});
  const [b3, setB3] = useState<KpiRow>({});
  const [b4, setB4] = useState<KpiRow>({});
  const [b5, setB5] = useState<KpiRow>({});
  const [b6, setB6] = useState<KpiRow>({});
  const [b7, setB7] = useState<KpiRow>({});
  const [b8, setB8] = useState<KpiRow>({});
  const [b9, setB9] = useState<KpiRow>({});

  // Dữ liệu Tầng 2, 3, 4, 5
  const [level2Data, setLevel2Data] = useState<KpiRow>({});
  const [level3Data, setLevel3Data] = useState<KpiRow>({});
  const [level4Data, setLevel4Data] = useState<KpiRow>({});
  const [level5Data, setLevel5Data] = useState<KpiRow>({});

  const [metricLinks, setMetricLinks] = useState<Record<string, string>>({});
  const [metricIds, setMetricIds] = useState<Record<string, string>>({});
  const [communes, setCommunes] = useState<DashboardRow[]>([]);
  const [communeKpi, setCommuneKpi] = useState<Record<string, { b1?: KpiRow; b2?: KpiRow }>>({});
  const [parentProvince, setParentProvince] = useState<DashboardRow | null>(null);

  const [level, setLevel] = useLevelParam(1);
  const currentLevel = Number(level) || 1;

  const [showLink, setShowLink] = useState(false);
  const [showImportPdf, setShowImportPdf] = useState(false);
  const [showLevel2IdModal, setShowLevel2IdModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const [b1QtyTarget, setB1QtyTarget] = useState<{
    metricKey: string;
    fields: string[];
    label: string;
    current: number;
    matchTokens: string[];
  } | null>(null);

  const [showCommuneList, setShowCommuneList] = useState(false);
  const [showFilterCompare, setShowFilterCompare] = useState(false);
  const [communeLinkTarget, setCommuneLinkTarget] = useState<DashboardRow | null>(null);
  const [communeQuantityTarget, setCommuneQuantityTarget] = useState<{
    dashboard: DashboardRow;
    field: string;
    label: string;
    current: number;
    matchTokens: string[];
  } | null>(null);

  const loadCommunes = async (provinceUnitId: string): Promise<void> => {
    const { data: childUnits } = await supabase
      .from("administrative_units")
      .select("id")
      .eq("parent_id", provinceUnitId);

    const ids = childUnits?.map((u) => u.id) ?? [];
    if (ids.length === 0) {
      setCommunes([]);
      return;
    }

    const { data: communesData } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .in("unit_id", ids)
      .order("title", { ascending: true });
    const communeRows = (communesData ?? []) as DashboardRow[];
    setCommunes(communeRows);

    const communeIds = communeRows.map((c) => c.id);
    if (communeIds.length > 0) {
      const [{ data: b1Data }, { data: b2Data }, { data: mlData }] = await Promise.all([
        supabase.from("kpi_business_units").select("*").in("dashboard_id", communeIds),
        supabase.from("kpi_products").select("*").in("dashboard_id", communeIds),
        supabase
          .from("metric_links")
          .select("dashboard_id, metric_key, current_value")
          .in("dashboard_id", communeIds),
      ]);

      const b1Map = new Map<string, KpiRow>();
      for (const row of (b1Data ?? []) as KpiRow[]) {
        const id = String(row.dashboard_id);
        if (!b1Map.has(id)) b1Map.set(id, row);
      }
      const b2Map = new Map<string, KpiRow>();
      for (const row of (b2Data ?? []) as KpiRow[]) {
        const id = String(row.dashboard_id);
        if (!b2Map.has(id)) b2Map.set(id, row);
      }

      const valueByCommune = new Map<string, Record<string, number>>();
      for (const link of (mlData ?? []) as {
        dashboard_id: string;
        metric_key: string;
        current_value: unknown;
      }[]) {
        if (link.current_value === null || link.current_value === undefined) continue;
        if (!getMetricFieldMap(link.metric_key)) continue;
        const parsed = extractNumeric(link.current_value);
        if (parsed === null) continue;
        const map = valueByCommune.get(link.dashboard_id) ?? {};
        map[link.metric_key] = parsed;
        valueByCommune.set(link.dashboard_id, map);
      }

      const kpiById: Record<string, { b1?: KpiRow; b2?: KpiRow }> = {};
      for (const id of communeIds) {
        let b1 = b1Map.get(id) ?? {};
        let b2 = b2Map.get(id) ?? {};
        const values = valueByCommune.get(id);
        if (values) {
          for (const [metricKey, value] of Object.entries(values)) {
            const info = getMetricFieldMap(metricKey);
            if (!info) continue;
            if (info.section === "b1") b1 = applyMetricValueToRow(b1, info, value);
            if (info.section === "b2") b2 = applyMetricValueToRow(b2, info, value);
          }
        }
        kpiById[id] = { b1, b2 };
      }
      setCommuneKpi(kpiById);
    }
  };

  const loadParentProvince = async (communeUnitId: string): Promise<void> => {
    const { data: parentUnit } = await supabase
      .from("administrative_units")
      .select("parent_id")
      .eq("id", communeUnitId)
      .maybeSingle();

    if (parentUnit?.parent_id) {
      const { data: parentDash } = await supabase
        .from("dashboards")
        .select("id, title, unit:administrative_units(*)")
        .eq("unit_id", parentUnit.parent_id)
        .maybeSingle();
      setParentProvince(parentDash as DashboardRow | null);
    }
  };

  const fetchAll = useCallback(async () => {
    const { data: dash, error } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .eq("id", dashboardId)
      .maybeSingle();

    if (error || !dash) {
      setState("missing");
      return;
    }
    setDashboard(dash as DashboardRow);

    const row = dash as DashboardRow;
    const unitType = row.unit?.type;

    const [b1res, b2res, linkRes] = await Promise.all([
      supabase
        .from("kpi_business_units")
        .select("*")
        .eq("dashboard_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("kpi_products")
        .select("*")
        .eq("dashboard_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("metric_links")
        .select("metric_key, target_url")
        .eq("dashboard_id", row.id),
    ]);

    const linkMap: Record<string, string> = {};
    const idMap: Record<string, string> = {};
    const valueMap: Record<string, unknown> = {};

    (linkRes.data ?? []).forEach((link: any) => {
      const rawUrl = (link.target_url || "").trim();
      if (!rawUrl) return;

      const validUrl = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
        ? rawUrl
        : `https://${rawUrl}`;

      linkMap[link.metric_key] = validUrl;
      idMap[link.metric_key] = rawUrl.split("/").filter(Boolean).pop() || "";
    });

    setMetricLinks(linkMap);
    setMetricIds(idMap);

    const metadataAny = (row as any).metadata ?? {};
    const metaValueMap: Record<string, unknown> = {};

    for (const coll of ["metrics", "level2_metrics"]) {
      const source = metadataAny?.[coll];
      if (source && typeof source === "object") {
        Object.entries(source).forEach(([key, raw]) => {
          if (raw !== null && raw !== undefined && getMetricFieldMap(key)) {
            metaValueMap[key] = raw;
          }
        });
      }
    }

    Object.entries(metadataAny).forEach(([key, raw]) => {
      if (raw === null || raw === undefined) return;
      if (key === "metrics" || key === "level2_metrics") return;
      if (getMetricFieldMap(key)) metaValueMap[key] = raw;
    });

    Object.entries(metaValueMap).forEach(([key, raw]) => {
      if (valueMap[key] === undefined) valueMap[key] = raw;
    });

    const sectionRows: Record<string, KpiRow> = {
      b1: b1res.data ?? {},
      b2: b2res.data ?? {},
      b3: (row as any).b3 ?? {},
      b4: (row as any).b4 ?? {},
      b5: (row as any).b5 ?? {},
      b6: (row as any).b6 ?? {},
      b7: (row as any).b7 ?? {},
      b8: (row as any).b8 ?? {},
      b9: (row as any).b9 ?? {},
      l2: (row as any).level2 ?? (row as any).metadata?.level2 ?? (row as any).l2 ?? {},
      l3: (row as any).level3 ?? (row as any).metadata?.level3 ?? (row as any).l3 ?? {},
      l4: (row as any).level4 ?? (row as any).metadata?.level4 ?? (row as any).l4 ?? {},
      l5: (row as any).level5 ?? (row as any).metadata?.level5 ?? (row as any).l5 ?? {},
    };

    Object.entries(valueMap).forEach(([metricKey, currentValue]) => {
      const info = getMetricFieldMap(metricKey);
      if (!info) return;
      const targetRow = sectionRows[info.section];
      if (!targetRow) return;
      sectionRows[info.section] = applyMetricValueToRow(targetRow, info, currentValue);
    });

    setB1(sectionRows.b1);
    setB2(sectionRows.b2);
    setB3(sectionRows.b3);
    setB4(sectionRows.b4);
    setB5(sectionRows.b5);
    setB6(sectionRows.b6);
    setB7(sectionRows.b7);
    setB8(sectionRows.b8);
    setB9(sectionRows.b9);

    setLevel2Data(sectionRows.l2);
    setLevel3Data(sectionRows.l3);
    setLevel4Data(sectionRows.l4);
    setLevel5Data(sectionRows.l5);

    if (unitType === "PROVINCE") {
      // ⚡ Chỉ ĐỌC danh sách xã/phường từ Database — TUYỆT ĐỐI KHÔNG tự gọi cào dữ liệu (sync-live)
      // khi vừa mở trang hoặc chuyển đổi giữa các dashboard để tránh treo/chậm.
      void loadCommunes(row.unit_id);
    }

    setState("ready");

    const durationSec = ((performance.now() - loadStartTimeRef.current) / 1000).toFixed(2);
    fetch("/api/v1/metrics/log-perf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboardId, durationSec }),
    }).catch(() => {});

  }, [dashboardId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const refetchAfterSave = useCallback(() => void fetchAll(), [fetchAll]);

  // 🌟 NÚT LÀM MỚI DỮ LIỆU SIÊU TỐC VỚI THANH TIẾN TRÌNH (PROCESS BAR)
  const handleLiveSync = useCallback(
    async (silent = false) => {
      if (!dashboard?.id) return;
      if (!silent) setIsSyncing(true);

      try {
        const res = await fetch("/api/v1/metrics/refresh-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dashboardId: dashboard.id }),
          // Giới hạn thời gian chờ → vòng quay/modal không bị treo vô hạn
          signal: AbortSignal.timeout(60_000),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && (data?.success || data)) {
          await refetchAfterSave();
          if (!silent) {
            alert(data?.message || "Đã cào mới và cập nhật thành công số liệu mới nhất!");
          }
        } else if (!silent) {
          alert(data?.error || "Không thể đồng bộ số liệu");
        }
      } catch (e) {
        console.error("Lỗi Live Sync:", e);
        if (!silent) alert("Lỗi kết nối khi đồng bộ dữ liệu");
      } finally {
        if (!silent) setIsSyncing(false);
      }
    },
    [dashboard, refetchAfterSave]
  );

  const handleSaveLevel2SyncId = useCallback(
    async (customId: string) => {
      if (!dashboard?.id) return;
      try {
        const res = await fetch("/api/v1/metrics/sync-level2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dashboardId: dashboard.id,
            customId,
          }),
        });

        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          await refetchAfterSave();
          alert(`✅ ${data.message || "Đã bóc tách thành công toàn bộ chỉ số Tầng 2!"}`);
        } else {
          alert(`❌ Lỗi: ${data?.error || "Không thể bóc tách số liệu Tầng 2"}`);
        }
      } catch (err: any) {
        alert(`❌ Lỗi kết nối: ${err.message}`);
      }
    },
    [dashboard?.id, refetchAfterSave]
  );

  const handleSaveQuantity = useCallback(
    async (metricKey: string, newValue: number) => {
      const currentDashId = dashboard?.id;
      if (!currentDashId) return;

      const val = Number(newValue) || 0;
      const isB1 = metricKey.startsWith("b1_");
      const isB2 = metricKey.startsWith("b2_");
      const prefix = metricKey.split("_")[0];

      if (prefix === "l2" || prefix === "l3" || prefix === "l4" || prefix === "l5") {
        const levelField =
          prefix === "l2" ? "level2" : prefix === "l3" ? "level3" : prefix === "l4" ? "level4" : "level5";
        const fieldName = metricKey.replace(`${prefix}_`, "");

        if (prefix === "l2") setLevel2Data((prev) => ({ ...prev, [fieldName]: val, [metricKey]: val }));
        if (prefix === "l3") setLevel3Data((prev) => ({ ...prev, [fieldName]: val, [metricKey]: val }));
        if (prefix === "l4") setLevel4Data((prev) => ({ ...prev, [fieldName]: val, [metricKey]: val }));
        if (prefix === "l5") setLevel5Data((prev) => ({ ...prev, [fieldName]: val, [metricKey]: val }));

        const currentSectionData = {
          ...((dashboard as any)[levelField] || (dashboard as any)?.metadata?.[levelField] || {}),
        };
        currentSectionData[fieldName] = val;
        currentSectionData[metricKey] = val;

        const { error: colErr } = await supabase
          .from("dashboards")
          .update({ [levelField]: currentSectionData })
          .eq("id", currentDashId);

        if (colErr) {
          const meta = { ...(dashboard?.metadata || {}) };
          meta[levelField] = currentSectionData;
          await supabase.from("dashboards").update({ metadata: meta }).eq("id", currentDashId);
        }
        return;
      }

      if (["b3", "b4", "b5", "b6", "b7", "b8", "b9"].includes(prefix)) {
        const fieldName = metricKey.replace(`${prefix}_`, "");
        const setters: Record<string, any> = {
          b3: setB3, b4: setB4, b5: setB5, b6: setB6, b7: setB7, b8: setB8, b9: setB9,
        };

        if (setters[prefix]) {
          setters[prefix]((prev: any) => ({ ...prev, [fieldName]: val }));
        }

        const currentSectionData = { ...((dashboard as any)[prefix] || {}) };
        currentSectionData[fieldName] = val;

        const { error } = await supabase
          .from("dashboards")
          .update({ [prefix]: currentSectionData })
          .eq("id", currentDashId);

        if (error) throw error;
        return;
      }

      let fields: string[] = [];
      if (isB1) fields = B1_QTY_METRIC_FIELDS[metricKey] ?? [];
      else if (isB2) fields = B2_QTY_METRIC_FIELDS[metricKey] ?? [];
      if (fields.length === 0) return;

      try {
        if (isB1) {
          setB1((prev) => {
            const next = { ...prev };
            for (const f of fields) next[f] = val;
            return next;
          });
        } else if (isB2) {
          setB2((prev) => {
            const next = { ...prev };
            for (const f of fields) next[f] = val;
            return next;
          });
        }

        const res = await fetch("/api/v1/metrics/update-value", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dashboardId: currentDashId,
            section: isB1 ? "B1" : "B2",
            field: fields[0],
            fields,
            value: val,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
      } catch (error: any) {
        alert(`Không thể lưu số liệu: ${error?.message || "Lỗi kết nối DB"}`);
        throw error;
      }

      fetch("/api/v1/metrics/sync-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardId: currentDashId }),
      }).catch(() => {});
    },
    [dashboard]
  );

  const handleSaveBaseDomain = useCallback(
    async (newDomain: string, slug?: string): Promise<void> => {
      if (!dashboard?.id) return;
      const cleanDomain = (newDomain ?? "").trim().replace(/\/+$/, "");

      try {
        const res = await fetch(`/api/v1/dashboards/${dashboard.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domainLink: cleanDomain,
            base_domain: cleanDomain,
            metadata: {
              ...(dashboard.metadata ?? {}),
              ...(slug ? { slug } : {}),
              base_domain: cleanDomain,
            },
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                base_domain: cleanDomain,
                domain_link: cleanDomain,
                metadata: {
                  ...(prev.metadata ?? {}),
                  ...(slug ? { slug } : {}),
                  base_domain: cleanDomain,
                },
              }
            : prev
        );

        alert("Đã lưu liên kết Header thành công!");
      } catch (error: any) {
        alert(`Lỗi lưu liên kết: ${error?.message || "Lỗi cập nhật Dashboard"}`);
      }
    },
    [dashboard]
  );

  const handleSaveMetricId = useCallback(
    async (metricKey: string, metricId: string): Promise<void> => {
      const currentId = dashboard?.id;
      if (!currentId) throw new Error("Không tìm thấy dashboard");

      const cleanId = (metricId ?? "").trim();

      let base = (
        dashboard?.base_domain ||
        dashboard?.metadata?.base_domain ||
        dashboard?.domain_link ||
        parentProvince?.base_domain ||
        parentProvince?.metadata?.base_domain ||
        parentProvince?.domain_link ||
        ""
      ).trim().replace(/\/+$/, "");

      if (base && !base.startsWith("http://") && !base.startsWith("https://")) {
        base = `https://${base}`;
      }

      const fullUrl = base ? `${base}/${cleanId}` : (cleanId.startsWith("http") ? cleanId : `https://${cleanId}`);

      const linkRes = await fetch("/api/v1/metrics/set-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: currentId,
          metricKey,
          targetUrl: fullUrl,
          metricId: cleanId,
        }),
      });

      const linkData = await linkRes.json().catch(() => null);
      if (!linkRes.ok) throw new Error(linkData?.error || "Lỗi lưu ID");

      setMetricLinks((prev) => ({ ...prev, [metricKey]: fullUrl }));
      setMetricIds((prev) => ({ ...prev, [metricKey]: cleanId }));

      if (linkData?.value !== undefined && linkData?.value !== null) {
        const parsedVal = Number(linkData.value);
        const info = getMetricFieldMap(metricKey);
        if (info) {
          const sectionSetters: Record<string, any> = {
            b1: setB1, b2: setB2, b3: setB3, b4: setB4, b5: setB5,
            b6: setB6, b7: setB7, b8: setB8, b9: setB9,
            l2: setLevel2Data, l3: setLevel3Data, l4: setLevel4Data, l5: setLevel5Data,
          };
          sectionSetters[info.section]?.((prev: KpiRow) => applyMetricValueToRow(prev, info, parsedVal, true));
        }
      }

      await fetchAll();

      if (linkData?.value !== undefined && linkData?.value !== null) {
        alert(`Đã đồng bộ số liệu thành công: ${linkData.value}`);
      } else {
        alert("Đã lưu link thành công!");
      }
    },
    [dashboard, parentProvince, fetchAll]
  );

  const handleOpenB1Qty = (metricKey: string): void => {
    const fields = B1_QTY_METRIC_FIELDS[metricKey];
    if (!fields) return;
    setB1QtyTarget({
      metricKey,
      fields,
      label: B1_QTY_LABELS[metricKey] ?? metricKey,
      current: Number(b1[fields[0]] ?? 0),
      matchTokens: B1_QTY_TOKENS[metricKey] ?? [],
    });
  };

  const isProvince = dashboard?.unit?.type === "PROVINCE";
  const activeLevel = LEVELS.find((item) => item.level === currentLevel) ?? LEVELS[0];

  if (state === "loading") {
    return (
      <div className="relative min-h-screen">
        <div className="dashboard-bg" />
        <main className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
          <div className="glass h-40 animate-pulse rounded-3xl" />
        </main>
      </div>
    );
  }

  if (state === "missing" || !dashboard) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="dashboard-bg" />
        <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-xl font-bold">Không tìm thấy Dashboard</h1>
          <p className="mt-2 text-sm opacity-60">Dashboard không tồn tại hoặc đã bị xóa.</p>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            <ArrowLeft size={15} /> Quay lại
          </button>
        </div>
      </div>
    );
  }

  const headerLink = dashboard?.base_domain ?? dashboard?.metadata?.base_domain ?? dashboard?.domain_link ?? "";

  const rawSyncTime = dashboard?.metadata?.last_sync_at || dashboard?.updated_at || dashboard?.metadata?.synced_at;
  const syncTimeFormatted = rawSyncTime
    ? new Date(rawSyncTime).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="relative min-h-screen">
      <div className="dashboard-bg" />

      {/* ICON 3 GẠCH CỐ ĐỊNH Ở GÓC TRÊN PHẢI MÀN HÌNH MOBILE */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="fixed top-3.5 right-4 z-50 grid h-10 w-10 place-items-center rounded-xl border border-cyan-500/40 bg-[#071326]/90 text-cyan-400 shadow-xl backdrop-blur-md transition active:scale-95 md:hidden"
        title="Mở menu điều hành"
      >
        <Menu size={22} />
      </button>

      {/* SIDEBAR DRAWER */}
      <LevelMenu
        value={currentLevel}
        onChange={setLevel}
        variant="sidebar"
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        dashboard={dashboard}
        onChanged={refetchAfterSave}
        onSyncLive={() => handleLiveSync(false)}
        isSyncing={isSyncing}
        onOpenImportPdf={() => setShowImportPdf(true)}
      />

      {/* KHUNG NỘI DUNG CHÍNH */}
      <div className="min-h-screen transition-all duration-300 md:pl-[295px]">
        {/* HEADER TOP BAR */}
        <header className="glass-strong sticky top-0 z-40 border-b border-white/5">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  router.push(backHref);
                }}
                aria-label="Quay lại"
                className="glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-foreground transition hover:text-accent"
                title="Quay lại danh sách"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="min-w-0 pr-12 md:pr-0">
                <h1 className="truncate text-sm sm:text-base font-bold font-sans tracking-wide text-foreground">
                  {cleanDashboardTitle(dashboard.title)}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="truncate text-[11px] sm:text-xs opacity-60 font-sans">
                    {dashboard.unit?.name ?? ""}, Việt Nam
                  </p>

                  {syncTimeFormatted && (
                    <>
                      <span className="text-[10px] opacity-30">•</span>
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-cyan-400 font-mono font-medium bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                        <Clock size={11} className="shrink-0" />
                        <span>Dữ liệu đồng bộ lúc: {syncTimeFormatted}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {headerLink && (
                <a
                  href={headerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-foreground/70 transition hover:text-accent"
                >
                  <Globe size={14} />
                  {headerLink.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          {/* ================= TẦNG 1 ================= */}
          {currentLevel === 1 ? (
            <div className="space-y-6">
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-5 sm:p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-lg sm:text-2xl font-bold">Tầng 1: Bộ tiêu chí kinh tế số {isProvince ? "UBND Tỉnh" : "UBDN xã/phường"}</h2>
                    <p className="mt-1 text-xs opacity-60">{isProvince ? "Dashboard Tỉnh" : "Dashboard Xã/Phường"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowLink(true)}
                        className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                      >
                        <Link2 size={14} /> Thiết lập Link
                      </button>
                    )}
                    {/* Nút Bộ lọc — đặt NGAY BÊN TRÁI nút "Danh sách xã/phường" */}
                    <button
                      type="button"
                      onClick={() => setShowFilterCompare(true)}
                      className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                      title="Bộ lọc và so sánh thông tin"
                    >
                      <SlidersHorizontal size={14} /> Bộ lọc
                    </button>
                    {isProvince && (
                      <button
                        type="button"
                        onClick={() => setShowCommuneList(true)}
                        className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                      >
                        <Building2 size={14} /> Danh sách xã/phường ({communes.length})
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* LƯỚI TẦNG 1 (B1 - B9) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                <div className="w-full xl:col-span-2">
                  <B1Section
                    dashboard={dashboard}
                    b1={b1}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onOpenQtyModal={handleOpenB1Qty}
                    onSaveMetricId={handleSaveMetricId}
                  />
                </div>

                <div className="w-full xl:col-span-2">
                  <B2Section
                    dashboard={dashboard}
                    b2={b2}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                  />
                </div>
              <div className="andata">
                <div className="w-full flex flex-col">
                  <B3Section
                    dashboard={dashboard}
                    data={b3}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>
                <div className="w-full flex flex-col">
                  <B4Section
                    dashboard={dashboard}
                    data={b4}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>

                <div className="w-full flex flex-col">
                  <B5Section
                    dashboard={dashboard}
                    data={b5}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>
                <div className="w-full flex flex-col">
                  <B6Section
                    dashboard={dashboard}
                    data={b6}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>

                <div className="w-full flex flex-col">
                  <B7Section
                    dashboard={dashboard}
                    data={b7}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>
                <div className="w-full flex flex-col">
                  <B8Section
                    dashboard={dashboard}
                    data={b8}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>

                <div className="w-full xl:col-span-2">
                  <B9Section
                    dashboard={dashboard}
                    data={b9}
                    metricLinks={metricLinks}
                    metricIds={metricIds}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>
              </div>
              </div>
            </div>
          ) : currentLevel === 2 ? (
            /* ================= TẦNG 2 ================= */
            <div className="space-y-6">
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-5 sm:p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-lg sm:text-2xl font-bold">{activeLevel.title}</h2>
                    <p className="mt-1 text-xs opacity-60">Bộ tiêu chí Hệ sinh thái địa phương (Nhóm A - E)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowLevel2IdModal(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20 shadow-lg"
                          title="Nhập ID để tự động bóc tách toàn bộ chỉ số Nhóm A-E"
                        >
                          <Link2 size={14} /> Thiết lập ID Tầng 2
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowLink(true)}
                          className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                        >
                          <Link2 size={14} /> Thiết lập Link
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>

              <Level2View
                dashboard={dashboard}
                data={level2Data}
                metricLinks={metricLinks}
                metricIds={metricIds}
                onChanged={refetchAfterSave}
                onSaveMetricId={handleSaveMetricId}
                onSaveQuantity={handleSaveQuantity}
              />
            </div>
          ) : currentLevel === 3 ? (
            /* ================= TẦNG 3 ================= */
            <div className="space-y-6">
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-5 sm:p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-lg sm:text-2xl font-bold">{activeLevel.title}</h2>
                    <p className="mt-1 text-xs opacity-60">Dự án kêu gọi đầu tư & Thông tin quy hoạch địa phương</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowLink(true)}
                        className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                      >
                        <Link2 size={14} /> Thiết lập Link
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <Level3View
                dashboard={dashboard}
                data={level3Data}
                metricLinks={metricLinks}
                metricIds={metricIds}
                onChanged={refetchAfterSave}
                onSaveMetricId={handleSaveMetricId}
                onSaveQuantity={handleSaveQuantity}
              />
            </div>
          ) : currentLevel === 4 ? (
            /* ================= TẦNG 4 ================= */
            <div className="space-y-6">
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-5 sm:p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-lg sm:text-2xl font-bold">{activeLevel.title}</h2>
                    <p className="mt-1 text-xs opacity-60">Chính sách hỗ trợ & Tình hình giải đáp kiến nghị</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowLink(true)}
                        className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                      >
                        <Link2 size={14} /> Thiết lập Link
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <Level4View
                dashboard={dashboard}
                data={level4Data}
                metricLinks={metricLinks}
                metricIds={metricIds}
                onChanged={refetchAfterSave}
                onSaveMetricId={handleSaveMetricId}
                onSaveQuantity={handleSaveQuantity}
              />
            </div>
          ) : currentLevel === 5 ? (
            /* ================= TẦNG 5 ================= */
            <div className="space-y-6">
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-5 sm:p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-lg sm:text-2xl font-bold">{activeLevel.title}</h2>
                    <p className="mt-1 text-xs opacity-60">Điểm trưng bày / Hội quán & Hiệu quả thương mại O2O</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowLink(true)}
                        className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                      >
                        <Link2 size={14} /> Thiết lập Link
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <Level5View
                dashboard={dashboard}
                data={level5Data}
                metricLinks={metricLinks}
                metricIds={metricIds}
                onChanged={refetchAfterSave}
                onSaveMetricId={handleSaveMetricId}
                onSaveQuantity={handleSaveQuantity}
              />
            </div>
          ) : (
            <section className="glass flex flex-col items-center justify-center gap-3 rounded-3xl p-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
                <activeLevel.icon size={28} />
              </span>
              <h3 className="text-xl font-bold">{activeLevel.title}</h3>
              <p className="max-w-md text-sm opacity-60">
                Nội dung tầng này đang được xây dựng.
              </p>
            </section>
          )}
        </main>
      </div>

      {/* 👉 NÚT AI FLOATING CỐ ĐỊNH Ở GÓC DƯỚI PHẢI MÀN HÌNH */}
      {dashboard && (
        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-cyan-400/60 bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-white shadow-[0_0_25px_rgba(6,182,212,0.5)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:brightness-110 active:scale-95 group"
          title="Trợ lý AI Phân tích Dữ liệu & Lời khuyên"
        >
          <div className="relative flex items-center justify-center">
            <Bot size={22} className="text-white group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
            </span>
          </div>
          <span className="hidden sm:inline text-xs font-extrabold tracking-wide uppercase">
            Phân tích AI
          </span>
          <Sparkles size={14} className="hidden sm:inline text-cyan-200 animate-pulse" />
        </button>
      )}

      {/* 👉 POPUP MODAL PHÂN TÍCH AI */}
      {dashboard && (
        <AiAdvisorModal
          dashboard={dashboard}
          open={showAiModal}
          onClose={() => setShowAiModal(false)}
        />
      )}

      {/* 🌟 MODAL TIẾN TRÌNH KHI ĐANG CÀO DỮ LIỆU VÀ ĐỒNG BỘ */}
      {isSyncing && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex flex-col items-center justify-center w-full max-w-md bg-[#071326] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="relative grid h-16 w-16 place-items-center rounded-full bg-cyan-500/10 text-cyan-400 animate-pulse shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <RefreshCw size={30} className="animate-spin text-cyan-400" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white uppercase tracking-wide">Đang quét & Cào dữ liệu nguồn</h3>
              <p className="text-xs text-slate-400 font-mono">Hệ thống đang đồng bộ thông tin mới từ website các xã/phường...</p>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 animate-pulse rounded-full w-4/5" />
            </div>

            <span className="text-[11px] font-mono text-cyan-400 font-bold tracking-wider">Vui lòng chờ trong giây lát, không tắt trang...</span>
          </div>
        </div>
      )}

      {/* MODALS QUẢN TRỊ */}
      {showLink && (
        <LinkModal
          dashboard={dashboard}
          onClose={() => setShowLink(false)}
          onSaved={refetchAfterSave}
          onSave={(domain, slug) => handleSaveBaseDomain(domain, slug)}
        />
      )}

      {showImportPdf && (
        <ImportPdfModal
          dashboard={dashboard}
          onClose={() => setShowImportPdf(false)}
          onSaved={refetchAfterSave}
        />
      )}

      {/* MODAL THIẾT LẬP ID TẦNG 2 */}
      {showLevel2IdModal && dashboard && (
        <MetricIdModal
          dashboard={dashboard}
          metricKey="level2_sync_all"
          metricLabel="Tầng 2 (Báo cáo Hệ sinh thái Nhóm A - E)"
          label="ID / URL Báo Cáo Hệ Sinh Thái KTS"
          baseDomain={dashboard.base_domain || dashboard.metadata?.base_domain || dashboard.domain_link || ""}
          currentId={(dashboard.metadata as any)?.level2_custom_id || ""}
          initialId={(dashboard.metadata as any)?.level2_custom_id || ""}
          onClose={() => setShowLevel2IdModal(false)}
          onSave={async (_key, id) => {
            await handleSaveLevel2SyncId(id);
          }}
          onSaved={refetchAfterSave}
        />
      )}

      {showCommuneList && dashboard && (
        <CommuneDashboardModal
          open={showCommuneList}
          provinceName={dashboard.unit?.name ?? "Tỉnh"}
          communes={communes}
          communeKpi={communeKpi}
          onEditLink={(c) => {
            setCommuneLinkTarget(c);
            setShowCommuneList(false);
          }}
          onEditQuantity={(c) => {
            const kpi = communeKpi[c.id]?.b1 ?? {};
            setCommuneQuantityTarget({
              dashboard: c,
              field: "sme_total",
              label: "Tổng số Doanh nghiệp SME",
              current: Number(kpi.sme_total ?? 0),
              matchTokens: ["sme", "doanh nghiệp"],
            });
            setShowCommuneList(false);
          }}
          onViewDashboard={(c) => router.push(`/${dashboard.id}/${c.id}`)}
          onClose={() => setShowCommuneList(false)}
        />
      )}

      {/* MODAL BỘ LỌC VÀ SO SÁNH THÔNG TIN (chỉ đọc dữ liệu KPI) */}
      {showFilterCompare && dashboard && (
        <KpiFilterCompareModal
          key={dashboard.id}
          open={showFilterCompare}
          dashboard={dashboard}
          onClose={() => setShowFilterCompare(false)}
        />
      )}

      {communeLinkTarget && (
        <LinkModal
          dashboard={communeLinkTarget}
          onClose={() => setCommuneLinkTarget(null)}
          onSaved={refetchAfterSave}
        />
      )}

      {communeQuantityTarget && (
        <CellQuantityModal
          dashboard={communeQuantityTarget.dashboard}
          section="B1"
          field={communeQuantityTarget.field}
          label={communeQuantityTarget.label}
          currentValue={communeQuantityTarget.current}
          matchTokens={communeQuantityTarget.matchTokens}
          onClose={() => setCommuneQuantityTarget(null)}
          onSaved={refetchAfterSave}
        />
      )}

      {b1QtyTarget && dashboard && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B1"
          field={b1QtyTarget.fields[0]}
          fields={b1QtyTarget.fields}
          label={b1QtyTarget.label}
          currentValue={b1QtyTarget.current}
          matchTokens={b1QtyTarget.matchTokens}
          saveHandler={async (_fields, value) => {
            await handleSaveQuantity(b1QtyTarget.metricKey, value);
          }}
          onClose={() => setB1QtyTarget(null)}
          onSaved={refetchAfterSave}
        />
      )}
    </div>
  );
}

export default DashboardDetail;