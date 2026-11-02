"use client";

import React, { useState } from "react";
import {
  Server,
  Globe,
  Cpu,
  TrendingUp,
  FileText,
  ExternalLink,
  Link as LinkIcon,
  Edit3,
  Calendar,
  Layers,
  Building2,
  Package,
  HeartHandshake,
  Info,
} from "lucide-react";
import { CellQuantityModal } from "./blocks/cell-quantity-modal";
import { BlockIdModal } from "./blocks/block-id-modal";
import { MetricIdModal } from "./blocks/metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { cardLinkProps, getStoredMetricId } from "@/lib/card-link";

interface Level2ViewProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks?: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged?: () => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function Level2View({
  dashboard,
  data = {},
  metricLinks = {},
  metricIds = {},
  onChanged = () => {},
  onSaveMetricId,
  onSaveQuantity,
}: Level2ViewProps) {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "A" | "B" | "C" | "D" | "E">("all");
  const [showBlockId, setShowBlockId] = useState(false);

  const now = new Date();
  const currentMonthStr = `tháng ${now.getMonth() + 1}`;
  const currentYearStr = `năm ${now.getFullYear()}`;

  const [qtyTarget, setQtyTarget] = useState<{
    key: string;
    field: string;
    label: string;
    current: number;
    matchTokens: string[];
  } | null>(null);

  const [metricIdTarget, setMetricIdTarget] = useState<{
    key: string;
    label: string;
    id: string;
  } | null>(null);

  const baseDomain = (
    dashboard?.base_domain ||
    dashboard?.metadata?.base_domain ||
    dashboard?.domain_link ||
    ""
  ).trim().replace(/\/+$/, "");

  const handleOpenId = (key: string, label: string) => {
    const rawUrl = metricLinks[key] || "";
    const extractedId = rawUrl.split("/").filter(Boolean).pop() || "";
    const id = metricIds[key] || extractedId || getStoredMetricId(metricIds, key, rawUrl);
    setMetricIdTarget({ key, label, id });
  };

  type GroupTone = "cyan" | "blue" | "purple" | "emerald" | "amber";

  const GROUP_THEME_STYLES: Record<
    GroupTone,
    {
      container: string;
      header: string;
      title: string;
      btn: string;
      iconBox: string;
      value: string;
    }
  > = {
    cyan: {
      container:
        "bg-white dark:bg-[#1e293b] rounded-2xl border border-cyan-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors overflow-hidden",
      header:
        "flex justify-between items-center px-5 py-4 border-b border-cyan-100 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/20 transition-colors",
      title: "font-bold text-cyan-900 dark:text-cyan-400 uppercase tracking-wide text-sm",
      btn: "p-1.5 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-800/50 rounded-md border border-cyan-200 dark:border-cyan-700 bg-white dark:bg-transparent shadow-sm dark:shadow-none",
      iconBox:
        "p-2 bg-white dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 rounded-lg border border-cyan-100 dark:border-cyan-800 shadow-sm",
      value: "text-cyan-600 dark:text-cyan-400 font-black text-lg",
    },
    blue: {
      container:
        "bg-white dark:bg-[#1e293b] rounded-2xl border border-blue-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors overflow-hidden",
      header:
        "flex justify-between items-center px-5 py-4 border-b border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 transition-colors",
      title: "font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wide text-sm",
      btn: "p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-md border border-blue-200 dark:border-blue-700 bg-white dark:bg-transparent shadow-sm dark:shadow-none",
      iconBox:
        "p-2 bg-white dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800 shadow-sm",
      value: "text-blue-600 dark:text-blue-400 font-black text-lg",
    },
    purple: {
      container:
        "bg-white dark:bg-[#1e293b] rounded-2xl border border-purple-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors overflow-hidden",
      header:
        "flex justify-between items-center px-5 py-4 border-b border-purple-100 dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20 transition-colors",
      title: "font-bold text-purple-900 dark:text-purple-400 uppercase tracking-wide text-sm",
      btn: "p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/50 rounded-md border border-purple-200 dark:border-purple-700 bg-white dark:bg-transparent shadow-sm dark:shadow-none",
      iconBox:
        "p-2 bg-white dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800 shadow-sm",
      value: "text-purple-600 dark:text-purple-400 font-black text-lg",
    },
    emerald: {
      container:
        "bg-white dark:bg-[#1e293b] rounded-2xl border border-emerald-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors overflow-hidden",
      header:
        "flex justify-between items-center px-5 py-4 border-b border-emerald-100 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 transition-colors",
      title: "font-bold text-emerald-900 dark:text-emerald-400 uppercase tracking-wide text-sm",
      btn: "p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 rounded-md border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-transparent shadow-sm dark:shadow-none",
      iconBox:
        "p-2 bg-white dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-800 shadow-sm",
      value: "text-emerald-600 dark:text-emerald-400 font-black text-lg",
    },
    amber: {
      container:
        "bg-white dark:bg-[#1e293b] rounded-2xl border border-amber-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors overflow-hidden",
      header:
        "flex justify-between items-center px-5 py-4 border-b border-amber-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20 transition-colors",
      title: "font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wide text-sm",
      btn: "p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-md border border-amber-200 dark:border-amber-700 bg-white dark:bg-transparent shadow-sm dark:shadow-none",
      iconBox:
        "p-2 bg-white dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-800 shadow-sm",
      value: "text-amber-600 dark:text-amber-400 font-black text-lg",
    },
  };

  /** Render thẻ chi tiết (width: 100%) */
  const renderMetricCard = ({
    title,
    keyMonth,
    keyYear,
    unit = "",
    icon: Icon = Layers,
    color = "cyan",
  }: {
    title: string;
    keyMonth: string;
    keyYear: string;
    unit?: string;
    icon?: React.ElementType;
    color?: GroupTone;
    colorClass?: string;
  }) => {
    const valMonth = Number(data[keyMonth] ?? 0);
    const valYear = Number(data[keyYear] ?? 0);
    const theme = GROUP_THEME_STYLES[color];

    return (
      <div
        {...cardLinkProps(metricLinks[keyYear])}
        className={`w-full block group transition-all duration-300 ${theme.container} ${
          metricLinks[keyYear] ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
        }`}
      >
        <div className={theme.header}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={theme.iconBox}>
              <Icon size={18} />
            </span>
            <h4 className={`${theme.title} truncate`} title={title}>
              {title}
            </h4>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 z-10">
            {metricLinks[keyYear] && (
              <a
                href={metricLinks[keyYear]}
                target="_blank"
                rel="noopener noreferrer"
                className={theme.btn}
                title="Xem link"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={13} />
              </a>
            )}
            {isAdmin && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenId(keyYear, title);
                  }}
                  className={theme.btn}
                  title="Thiết lập ID"
                >
                  <LinkIcon size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setQtyTarget({
                      key: keyYear,
                      field: keyYear.replace("l2_", ""),
                      label: `${title} (Trong ${currentYearStr})`,
                      current: valYear,
                      matchTokens: [title.toLowerCase()],
                    });
                  }}
                  className={theme.btn}
                  title="Setup số lượng"
                >
                  <Edit3 size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3 bg-white dark:bg-transparent">
          <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl px-4 py-3 flex justify-between items-center border border-slate-100 dark:border-slate-700/50 transition-colors">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-medium">
              <Calendar size={14} className="text-emerald-500" />
              Trong {currentMonthStr}:
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums text-base">
                +{valMonth.toLocaleString("vi-VN")}
              </span>
              {unit && <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl px-4 py-3 flex justify-between items-center border border-slate-100 dark:border-slate-700/50 transition-colors">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-medium">
              <Calendar size={14} />
              Trong {currentYearStr}:
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`${theme.value} tabular-nums`}>
                {valYear.toLocaleString("vi-VN")}
              </span>
              {unit && <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{unit}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 🌟 Lấy danh sách Nhóm E trực tiếp từ dữ liệu động đã bóc tách từ website nguồn
  const rawDynamicE = (dashboard as any)?.metadata?.level2_e_items;
  const dynamicEItems = Array.isArray(rawDynamicE) && rawDynamicE.length > 0
    ? rawDynamicE
    : [];

  return (
    <div className="space-y-6 w-full block">
      {/* THANH ĐIỀU HƯỚNG TAB */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/5 pb-3 w-full">
        {[
          { id: "all", label: "Tổng quan Nhóm A-E", icon: Layers },
          { id: "A", label: "A - (Hạ tầng)", icon: Server },
          { id: "B", label: "B (Hiện diện số)", icon: Globe },
          { id: "C", label: "C (Vận hành)", icon: Cpu },
          { id: "D", label: "D (Thị trường)", icon: TrendingUp },
          { id: "E", label: "E (Thông tin)", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                isActive
                  ? "bg-blue-50 dark:bg-[#0d274c] text-blue-600 dark:text-[#00d2ff] border border-blue-200 dark:border-[#00d2ff]/40 shadow-sm"
                  : "bg-white dark:glass border border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Icon size={15} className={isActive ? "text-blue-600 dark:text-[#00d2ff]" : "text-slate-400"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= 1. TAB TỔNG QUAN NHÓM A-E ================= */}
      {activeTab === "all" && (
        <div className="space-y-5 w-full block">
          
          {/* HÀNG TRÊN: A, B, C */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 w-full">
            
            {/* THẺ A (Tone Cyan) */}
            <div className="w-full bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors group overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-cyan-100 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/20 transition-colors">
                <span className="p-2 bg-white dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 rounded-lg border border-cyan-100 dark:border-cyan-800 shadow-sm">
                  <Server size={18} />
                </span>
                <h4 className="font-black text-cyan-900 dark:text-cyan-400 uppercase tracking-wide text-sm truncate">
                  A. HẠ TẦNG & SẴN SÀNG
                </h4>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-3 text-xs w-full">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">DN CĐS:</span>
                    <strong className="text-cyan-600 dark:text-cyan-400 font-mono text-sm">
                      {Number(data["l2_a_dn_cds_year"] ?? data["l2_a_dn_cds"] ?? 211).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Lên Cloud:</span>
                    <strong className="text-cyan-600 dark:text-cyan-400 font-mono text-sm">
                      {Number(data["l2_a_cloud_year"] ?? data["l2_a_cloud"] ?? 180).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">NetID:</span>
                    <strong className="text-cyan-600 dark:text-cyan-400 font-mono text-sm">
                      {Number(data["l2_a_netid_year"] ?? data["l2_a_netid"] ?? 320).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("A")}
                  className="mt-5 w-full rounded-xl bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-600 dark:text-cyan-300 transition hover:bg-cyan-500/20"
                >
                  Xem chi tiết Nhóm A ➜
                </button>
              </div>
            </div>

            {/* THẺ B (Tone Blue) */}
            <div className="w-full bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors group overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 transition-colors">
                <span className="p-2 bg-white dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800 shadow-sm">
                  <Globe size={18} />
                </span>
                <h4 className="font-black text-blue-900 dark:text-blue-400 uppercase tracking-wide text-sm truncate">
                  B. HIỆN DIỆN SỐ & TM
                </h4>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-3 text-xs w-full">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Web/E-com:</span>
                    <strong className="text-blue-600 dark:text-blue-400 font-mono text-sm">
                      {Number(data["l2_b_web_year"] ?? data["l2_b_web_ecom"] ?? 145).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Đơn hàng:</span>
                    <strong className="text-blue-600 dark:text-blue-400 font-mono text-sm">
                      {Number(data["l2_b_don_hang_year"] ?? data["l2_b_don_hang"] ?? 1250).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Tăng trưởng:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      +{Number(data["l2_b_tang_truong_year"] ?? 18.5)}%
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("B")}
                  className="mt-5 w-full rounded-xl bg-blue-500/10 py-2.5 text-xs font-bold text-blue-600 dark:text-blue-300 transition hover:bg-blue-500/20"
                >
                  Xem chi tiết Nhóm B ➜
                </button>
              </div>
            </div>

            {/* THẺ C (Tone Purple) */}
            <div className="w-full bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors group overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-purple-100 dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20 transition-colors">
                <span className="p-2 bg-white dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800 shadow-sm">
                  <Cpu size={18} />
                </span>
                <h4 className="font-black text-purple-900 dark:text-purple-400 uppercase tracking-wide text-sm truncate">
                  C. VẬN HÀNH & NGUỒN LỰC
                </h4>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-3 text-xs w-full">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Hệ thống QLDN:</span>
                    <strong className="text-purple-600 dark:text-purple-400 font-mono text-sm">
                      {Number(data["l2_c_erp_year"] ?? data["l2_c_erp"] ?? 86).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Tổng nhân sự:</span>
                    <strong className="text-purple-600 dark:text-purple-400 font-mono text-sm">
                      {Number(data["l2_c_nhan_su_year"] ?? data["l2_c_nhan_su"] ?? 4850).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Khóa đào tạo:</span>
                    <strong className="text-purple-600 dark:text-purple-400 font-mono text-sm">
                      {Number(data["l2_c_dao_tao_year"] ?? data["l2_c_dao_tao"] ?? 24).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("C")}
                  className="mt-5 w-full rounded-xl bg-purple-500/10 py-2.5 text-xs font-bold text-purple-600 dark:text-purple-300 transition hover:bg-purple-500/20"
                >
                  Xem chi tiết Nhóm C ➜
                </button>
              </div>
            </div>
          </div>

          {/* HÀNG DƯỚI: D & E */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 w-full">
            
            {/* THẺ D (Tone Emerald) */}
            <div className="w-full bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors group overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-emerald-100 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 transition-colors">
                <span className="p-2 bg-white dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-800 shadow-sm">
                  <TrendingUp size={18} />
                </span>
                <h4 className="font-black text-emerald-900 dark:text-emerald-400 uppercase tracking-wide text-sm truncate">
                  D. TƯƠNG TÁC & THỊ TRƯỜNG
                </h4>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-3 text-xs w-full">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Tổng tương tác:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {Number(data["l2_d_trang_xem_year"] ?? data["l2_d_trang_xem"] ?? 45200).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Google SEO:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {Number(data["l2_d_seo_year"] ?? data["l2_d_seo"] ?? 10282).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 w-full">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Tổng doanh thu:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {Number(data["l2_d_doanh_thu_year"] ?? 14800).toLocaleString("vi-VN")} TR
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("D")}
                  className="mt-5 w-full rounded-xl bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  Xem chi tiết Nhóm D ➜
                </button>
              </div>
            </div>

            {/* THẺ E (Tone Amber - HIỂN THỊ ĐỘNG CÁC MỤC THỰC TẾ TỪ WEBSITE NGUỒN) */}
            <div className="w-full lg:col-span-2 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors group overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-amber-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20 transition-colors">
                <span className="p-2 bg-white dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-800 shadow-sm">
                  <FileText size={18} />
                </span>
                <h4 className="font-black text-amber-900 dark:text-amber-400 uppercase tracking-wide text-sm truncate">
                  E. QUẢN LÝ THÔNG TIN ({dynamicEItems.length} mục)
                </h4>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                {dynamicEItems.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs w-full">
                    {dynamicEItems.slice(0, 6).map((item: any) => (
                      <div key={item.key} className="w-full bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-white/5 flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-300 font-medium truncate pr-2" title={item.title}>{item.title}:</span>
                        <strong className="text-amber-600 dark:text-cyan-300 font-mono text-base shrink-0">
                          {Number(data[item.key] ?? item.value ?? 0).toLocaleString("vi-VN")}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic py-2">Chưa có dữ liệu Nhóm E. Vui lòng bấm "Thiết lập ID Tầng 2" để đồng bộ từ website nguồn.</p>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab("E")}
                  className="mt-5 w-full rounded-xl bg-amber-500/10 py-2.5 text-xs font-bold text-amber-600 dark:text-amber-300 transition hover:bg-amber-500/20"
                >
                  Xem chi tiết Nhóm E ➜
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. TAB A CHI TIẾT ================= */}
      {activeTab === "A" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full">
          {renderMetricCard({
            title: "Tổng DN số hóa thông tin",
            keyMonth: "l2_a_dn_cds_month",
            keyYear: "l2_a_dn_cds_year",
            unit: "DN",
            icon: Server,
            color: "cyan",
          })}
          {renderMetricCard({
            title: "Tổng DN lên Cloud",
            keyMonth: "l2_a_cloud_month",
            keyYear: "l2_a_cloud_year",
            unit: "DN",
            icon: Server,
            color: "cyan",
          })}
          {renderMetricCard({
            title: "DN số hóa toàn diện",
            keyMonth: "l2_a_toan_dien_month",
            keyYear: "l2_a_toan_dien_year",
            unit: "DN",
            icon: Server,
            color: "cyan",
          })}
          {renderMetricCard({
            title: "Card điện tử NetID",
            keyMonth: "l2_a_netid_month",
            keyYear: "l2_a_netid_year",
            unit: "Card",
            icon: Server,
            color: "cyan",
          })}
        </div>
      )}

      {/* ================= 3. TAB B CHI TIẾT ================= */}
      {activeTab === "B" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full">
          {renderMetricCard({
            title: "Website & E-commerce",
            keyMonth: "l2_b_web_month",
            keyYear: "l2_b_web_year",
            unit: "Website",
            icon: Globe,
            color: "blue",
          })}
          {renderMetricCard({
            title: "Sản phẩm / Dịch vụ CĐS",
            keyMonth: "l2_b_sp_cds_month",
            keyYear: "l2_b_sp_cds_year",
            unit: "SP",
            icon: Globe,
            color: "blue",
          })}
          {renderMetricCard({
            title: "Tổng đơn hàng",
            keyMonth: "l2_b_don_hang_month",
            keyYear: "l2_b_don_hang_year",
            unit: "Đơn",
            icon: Globe,
            color: "blue",
          })}
          {renderMetricCard({
            title: "Tốc độ tăng trưởng",
            keyMonth: "l2_b_tang_truong_month",
            keyYear: "l2_b_tang_truong_year",
            unit: "%",
            icon: Globe,
            color: "blue",
          })}
        </div>
      )}

      {/* ================= 4. TAB C CHI TIẾT ================= */}
      {activeTab === "C" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 w-full">
          {renderMetricCard({
            title: "Hệ thống quản lý ERP",
            keyMonth: "l2_c_erp_month",
            keyYear: "l2_c_erp_year",
            unit: "hệ thống",
            icon: Cpu,
            color: "purple",
          })}
          {renderMetricCard({
            title: "Tổng nhân sự toàn hệ thống",
            keyMonth: "l2_c_nhan_su_month",
            keyYear: "l2_c_nhan_su_year",
            unit: "Nhân sự",
            icon: Cpu,
            color: "purple",
          })}
          {renderMetricCard({
            title: "Khóa đào tạo",
            keyMonth: "l2_c_dao_tao_month",
            keyYear: "l2_c_dao_tao_year",
            unit: "Khóa",
            icon: Cpu,
            color: "purple",
          })}
        </div>
      )}

      {/* ================= 5. TAB D CHI TIẾT ================= */}
      {activeTab === "D" && (
        <div className="space-y-5 w-full">
          <div className="rounded-2xl border border-emerald-200 dark:border-slate-700 bg-white dark:bg-[#1e293b] p-5 shadow-sm transition-colors overflow-hidden w-full">
            <div className="flex items-center gap-3 w-full">
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
                <TrendingUp size={20} />
              </span>
              <div>
                <span className="rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                  Tab: D (Thị trường)
                </span>
                <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-800 dark:text-slate-100 mt-1">
                  Chỉ số Tương tác & Thị trường (Nhóm D)
                </h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {renderMetricCard({
              title: "Tổng tương tác Trang xem",
              keyMonth: "l2_d_trang_xem_month",
              keyYear: "l2_d_trang_xem_year",
              unit: "Lượt",
              icon: TrendingUp,
              color: "emerald",
            })}
            {renderMetricCard({
              title: "Tổng số người xem",
              keyMonth: "l2_d_nguoi_xem_month",
              keyYear: "l2_d_nguoi_xem_year",
              unit: "Người",
              icon: TrendingUp,
              color: "emerald",
            })}
            {renderMetricCard({
              title: "Tổng số Google SEO hàng tháng",
              keyMonth: "l2_d_seo_month",
              keyYear: "l2_d_seo_year",
              unit: "Lượt",
              icon: TrendingUp,
              color: "emerald",
            })}
            {renderMetricCard({
              title: "Khách hàng",
              keyMonth: "l2_d_khach_hang_month",
              keyYear: "l2_d_khach_hang_year",
              unit: "Khách",
              icon: TrendingUp,
              color: "emerald",
            })}
            {renderMetricCard({
              title: "Tổng doanh thu",
              keyMonth: "l2_d_doanh_thu_month",
              keyYear: "l2_d_doanh_thu_year",
              unit: "TR VNĐ",
              icon: TrendingUp,
              color: "emerald",
            })}
          </div>
        </div>
      )}

      {/* ================= 6. TAB E CHI TIẾT (HIỂN THỊ ĐỘNG 100% CÁC MỤC THỰC TẾ) ================= */}
      {activeTab === "E" && (
        <div className="space-y-5 w-full">
          <div className="rounded-2xl border border-amber-200 dark:border-slate-700 bg-white dark:bg-[#1e293b] p-5 shadow-sm transition-colors overflow-hidden w-full">
            <div className="flex items-center gap-3 w-full">
              <span className="p-2.5 bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm">
                <Info size={20} />
              </span>
              <div>
                <span className="rounded-lg bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                  Tab: E (Thông tin)
                </span>
                <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-800 dark:text-slate-100 mt-1">
                  Chỉ số theo dõi Hệ sinh thái (Nhóm E - {dynamicEItems.length} mục thực tế)
                </h3>
              </div>
            </div>
          </div>

          {dynamicEItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {dynamicEItems.map((item: any) => {
                const val = Number(
                  data[item.key] ??
                    (dashboard as any)?.metadata?.level2_metrics?.[item.key] ??
                    item.value ??
                    0
                );
                const targetUrl = metricLinks[item.key] || item.url || "";
                const hasLink = Boolean(targetUrl);
                const theme = GROUP_THEME_STYLES.amber;

                return (
                  <div
                    key={item.key}
                    {...cardLinkProps(targetUrl)}
                    className={`w-full block group relative transition-all duration-300 ${theme.container} ${
                      hasLink ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
                    }`}
                  >
                    <div className={theme.header}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-emerald-500 text-sm font-bold shrink-0">✅</span>
                        <h4 className={`${theme.title} truncate`} title={item.title}>
                          {item.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 z-10">
                        {hasLink && (
                          <a
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={theme.btn}
                            title="Xem link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenId(item.key, item.title);
                              }}
                              className={theme.btn}
                              title="Thiết lập ID"
                            >
                              <LinkIcon size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQtyTarget({
                                  key: item.key,
                                  field: item.key.replace("l2_", ""),
                                  label: item.title,
                                  current: val,
                                  matchTokens: [item.title.toLowerCase()],
                                });
                              }}
                              className={theme.btn}
                              title="Setup số lượng"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-5 flex flex-col gap-3 bg-white dark:bg-transparent">
                      <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl px-4 py-3 flex justify-between items-center border border-slate-100 dark:border-slate-700/50 transition-colors">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-medium">
                          Số lượng thực tế:
                        </span>
                        <span className="text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
                          {val.toLocaleString("vi-VN")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800 w-full">
                        {hasLink ? (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                            Bấm để mở link
                            <ExternalLink size={11} />
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">Chưa cài link</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl p-8 text-center text-slate-500 dark:text-slate-400 text-xs bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700">
              Chưa có dữ liệu Nhóm E. Vui lòng bấm vào nút <strong className="text-amber-600 dark:text-amber-400">"Thiết lập ID Tầng 2"</strong> ở góc trên để hệ thống tự động bóc tách từ website nguồn.
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="L2"
          currentId={(dashboard as any).l2_custom_id ?? (dashboard as any)?.metadata?.l2_custom_id ?? ""}
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="L2"
          field={qtyTarget.field}
          label={qtyTarget.label}
          currentValue={qtyTarget.current}
          matchTokens={qtyTarget.matchTokens}
          saveHandler={async (_f, v) => {
            if (onSaveQuantity) await onSaveQuantity(qtyTarget.key, v);
          }}
          onClose={() => setQtyTarget(null)}
          onSaved={onChanged}
        />
      )}

      {metricIdTarget && (
        <MetricIdModal
          dashboard={dashboard}
          metricKey={metricIdTarget.key}
          metricLabel={metricIdTarget.label}
          label={metricIdTarget.label}
          baseDomain={baseDomain}
          currentId={metricIdTarget.id}
          initialId={metricIdTarget.id}
          onClose={() => setMetricIdTarget(null)}
          onSave={async (k, id) => {
            if (onSaveMetricId) await onSaveMetricId(k, id);
            onChanged();
          }}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

export default Level2View;