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

  /** Render thẻ chi tiết cho các Tab A, B, C, D (width: 100%) */
  const renderMetricCard = ({
    title,
    keyMonth,
    keyYear,
    unit = "",
    icon: Icon = Layers,
    colorClass = "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  }: {
    title: string;
    keyMonth: string;
    keyYear: string;
    unit?: string;
    icon?: React.ElementType;
    colorClass?: string;
  }) => {
    const valMonth = Number(data[keyMonth] ?? 0);
    const valYear = Number(data[keyYear] ?? 0);

    return (
      <div
        {...cardLinkProps(metricLinks[keyYear])}
        className={`w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl flex flex-col justify-between transition-all hover:border-white/20${metricLinks[keyYear] ? " cursor-pointer" : ""}`}
      >
        <div className="w-full">
          <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-3 w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${colorClass}`}>
                <Icon size={18} />
              </span>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-100 truncate">
                {title}
              </h4>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {metricLinks[keyYear] && (
                <a
                  href={metricLinks[keyYear]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 transition hover:text-white"
                  title="Xem link"
                >
                  <ExternalLink size={13} />
                </a>
              )}
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenId(keyYear, title);
                    }}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-400 transition hover:bg-amber-500/20"
                    title="Thiết lập ID"
                  >
                    <LinkIcon size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQtyTarget({
                        key: keyYear,
                        field: keyYear.replace("l2_", ""),
                        label: `${title} (Trong ${currentYearStr})`,
                        current: valYear,
                        matchTokens: [title.toLowerCase()],
                      });
                    }}
                    className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-1.5 text-cyan-400 transition hover:bg-cyan-500/20"
                    title="Setup số lượng"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3.5 space-y-2.5 text-xs w-full">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 p-2.5 border border-white/5 w-full">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Calendar size={13} className="text-emerald-400" />
                Trong {currentMonthStr}:
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-extrabold text-emerald-400 tabular-nums text-sm">
                  +{valMonth.toLocaleString("vi-VN")}
                </span>
                {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 p-2.5 border border-white/5 w-full">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Calendar size={13} className="text-cyan-400" />
                Trong {currentYearStr}:
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-black text-cyan-300 tabular-nums text-base">
                  {valYear.toLocaleString("vi-VN")}
                </span>
                {unit && <span className="text-[11px] text-slate-400 font-semibold">{unit}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TAB_E_ITEMS = [
    { key: "l2_e_doanh_nghiep", title: "Doanh nghiệp", unit: "DN", defaultValue: 201, icon: Building2, color: "#60a5fa" },
    { key: "l2_e_thong_tin_dn", title: "Thông tin doanh nghiệp", unit: "Hồ sơ", defaultValue: 177, icon: FileText, color: "#22d3ee" },
    { key: "l2_e_san_pham_dv", title: "Sản phẩm & Dịch vụ", unit: "SP/DV", defaultValue: 27, icon: Package, color: "#34d399" },
    { key: "l2_e_tai_lieu_cds", title: "Tài liệu CĐS cấp phường/xã", unit: "Tài liệu", defaultValue: 0, icon: FileText, color: "#a78bfa" },
    { key: "l2_e_quy_hoach", title: "Thông tin quy hoạch", unit: "Mục", defaultValue: 0, icon: Globe, color: "#38bdf8" },
    { key: "l2_e_du_lich_le_hoi", title: "Du lịch - Ẩm thực - Lễ hội", unit: "Mục", defaultValue: 1, icon: Calendar, color: "#f472b6" },
    { key: "l2_e_keu_goi_dau_tu", title: "Dự án kêu gọi đầu tư", unit: "Dự án", defaultValue: 0, icon: TrendingUp, color: "#fbbf24" },
    { key: "l2_e_tieu_chi_kts", title: "Tiêu chí nền tảng kinh tế số", unit: "Tiêu chí", defaultValue: 0, icon: Cpu, color: "#2dd4bf" },
    { key: "l2_e_doanh_thu", title: "Doanh thu", unit: "TR", defaultValue: 0, icon: TrendingUp, color: "#4ade80" },
    { key: "l2_e_thong_ke_bao_cao", title: "Thống kê báo cáo", unit: "Báo cáo", defaultValue: 0, icon: Layers, color: "#818cf8" },
    { key: "l2_e_lien_minh", title: "Liên minh", unit: "Liên minh", defaultValue: 20, icon: HeartHandshake, color: "#fb923c" },
    { key: "l2_e_chinh_sach_ht", title: "Chính sách hỗ trợ doanh nghiệp", unit: "Chính sách", defaultValue: 2, icon: FileText, color: "#a3e635" },
    { key: "l2_e_giai_dap_kn", title: "Giải đáp kiến nghị doanh nghiệp", unit: "Kiến nghị", defaultValue: 0, icon: Info, color: "#e879f9" },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* THANH ĐIỀU HƯỚNG TAB */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-3 w-full">
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
                  ? "bg-[#0d274c] text-[#00d2ff] border border-[#00d2ff]/40 shadow-sm"
                  : "glass opacity-70 hover:opacity-100 text-slate-300"
              }`}
            >
              <Icon size={15} className={isActive ? "text-[#00d2ff]" : "text-slate-400"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= 1. TAB TỔNG QUAN NHÓM A-E (100% width trên mobile bằng grid-cols-1 md:grid-cols-3 w-full) ================= */}
      {activeTab === "all" && (
        <div className="space-y-5 w-full">
          {/* HÀNG TRÊN: A, B, C */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full">
            
            {/* THẺ A */}
            <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="w-full">
                <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4 w-full">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <Server size={18} />
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-cyan-400 truncate">
                    A. HẠ TẦNG & SẴN SÀNG
                  </h4>
                </div>
                <div className="space-y-3 text-xs w-full">
                  <div className="flex justify-between items-center py-1 border-b border-white/5 w-full">
                    <span className="text-slate-300 font-medium">DN CĐS:</span>
                    <strong className="text-cyan-400 font-mono text-sm">
                      {Number(data["l2_a_dn_cds_year"] ?? data["l2_a_dn_cds"] ?? 211).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5 w-full">
                    <span className="text-slate-300 font-medium">Lên Cloud:</span>
                    <strong className="text-cyan-400 font-mono text-sm">
                      {Number(data["l2_a_cloud_year"] ?? data["l2_a_cloud"] ?? 180).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 w-full">
                    <span className="text-slate-300 font-medium">NetID:</span>
                    <strong className="text-cyan-400 font-mono text-sm">
                      {Number(data["l2_a_netid_year"] ?? data["l2_a_netid"] ?? 320).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("A")}
                className="mt-5 w-full rounded-xl bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                Xem chi tiết Nhóm A ➜
              </button>
            </div>

            {/* THẺ B */}
            <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="w-full">
                <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4 w-full">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    <Globe size={18} />
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-blue-400 truncate">
                    B. HIỆN DIỆN SỐ & TM
                  </h4>
                </div>
                <div className="space-y-3 text-xs w-full">
                  <div className="flex justify-between items-center py-1 border-b border-white/5 w-full">
                    <span className="text-slate-300 font-medium">Web/E-com:</span>
                    <strong className="text-blue-400 font-mono text-sm">
                      {Number(data["l2_b_web_year"] ?? data["l2_b_web_ecom"] ?? 145).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5 w-full">
                    <span className="text-slate-300 font-medium">Đơn hàng:</span>
                    <strong className="text-blue-400 font-mono text-sm">
                      {Number(data["l2_b_don_hang_year"] ?? data["l2_b_don_hang"] ?? 1250).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 w-full">
                    <span className="text-slate-300 font-medium">Tăng trưởng:</span>
                    <strong className="text-emerald-400 font-mono text-sm">
                      +{Number(data["l2_b_tang_truong_year"] ?? 18.5)}%
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("B")}
                className="mt-5 w-full rounded-xl bg-blue-500/10 py-2.5 text-xs font-bold text-blue-300 transition hover:bg-blue-500/20"
              >
                Xem chi tiết Nhóm B ➜
              </button>
            </div>

            {/* THẺ C */}
            <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="w-full">
                <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4 w-full">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    <Cpu size={18} />
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-purple-400 truncate">
                    C. VẬN HÀNH & NGUỒN LỰC
                  </h4>
                </div>
                <div className="space-y-3 text-xs w-full">
                  <div className="flex justify-between items-center py-1 border-b border-white/5 w-full">
                    <span className="text-slate-300 font-medium">Hệ thống QLDN:</span>
                    <strong className="text-purple-400 font-mono text-sm">
                      {Number(data["l2_c_erp_year"] ?? data["l2_c_erp"] ?? 86).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5 w-full">
                    <span className="text-slate-300 font-medium">Tổng nhân sự:</span>
                    <strong className="text-purple-400 font-mono text-sm">
                      {Number(data["l2_c_nhan_su_year"] ?? data["l2_c_nhan_su"] ?? 4850).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 w-full">
                    <span className="text-slate-300 font-medium">Khóa đào tạo:</span>
                    <strong className="text-purple-400 font-mono text-sm">
                      {Number(data["l2_c_dao_tao_year"] ?? data["l2_c_dao_tao"] ?? 24).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("C")}
                className="mt-5 w-full rounded-xl bg-purple-500/10 py-2.5 text-xs font-bold text-purple-300 transition hover:bg-purple-500/20"
              >
                Xem chi tiết Nhóm C ➜
              </button>
            </div>
          </div>

          {/* HÀNG DƯỚI: D & E */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full">
            
            {/* THẺ D */}
            <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="w-full">
                <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4 w-full">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <TrendingUp size={18} />
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-emerald-400 truncate">
                    D. TƯƠNG TÁC & THỊ TRƯỜNG
                  </h4>
                </div>
                <div className="space-y-3 text-xs w-full">
                  <div className="flex justify-between items-center py-1 border-b border-white/5 w-full">
                    <span className="text-slate-300 font-medium">Trang xem:</span>
                    <strong className="text-emerald-400 font-mono text-sm">
                      {Number(data["l2_d_trang_xem_year"] ?? data["l2_d_trang_xem"] ?? 45200).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5 w-full">
                    <span className="text-slate-300 font-medium">Google SEO:</span>
                    <strong className="text-emerald-400 font-mono text-sm">
                      {Number(data["l2_d_seo_year"] ?? data["l2_d_seo"] ?? 10282).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 w-full">
                    <span className="text-slate-300 font-medium">Doanh thu:</span>
                    <strong className="text-emerald-400 font-mono text-sm">
                      {Number(data["l2_d_doanh_thu_year"] ?? 14800).toLocaleString("vi-VN")} TR
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("D")}
                className="mt-5 w-full rounded-xl bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Xem chi tiết Nhóm D ➜
              </button>
            </div>

            {/* THẺ E */}
            <div className="w-full md:col-span-2 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="w-full">
                <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4 w-full">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <FileText size={18} />
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-amber-400 truncate">
                    E. QUẢN LÝ THÔNG TIN
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs w-full">
                  <div className="w-full bg-slate-900/60 p-3.5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Doanh nghiệp:</span>
                    <strong className="text-blue-400 font-mono text-base">
                      {Number(data["l2_e_doanh_nghiep"] ?? 200).toLocaleString("vi-VN")} DN
                    </strong>
                  </div>
                  <div className="w-full bg-slate-900/60 p-3.5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Thông tin DN:</span>
                    <strong className="text-cyan-400 font-mono text-base">
                      {Number(data["l2_e_thong_tin_dn"] ?? 177).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                  <div className="w-full bg-slate-900/60 p-3.5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Sản phẩm:</span>
                    <strong className="text-emerald-400 font-mono text-base">
                      {Number(data["l2_e_san_pham"] ?? 145).toLocaleString("vi-VN")} SP
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("E")}
                className="mt-5 w-full rounded-xl bg-amber-500/10 py-2.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
              >
                Xem chi tiết Nhóm E ➜
              </button>
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
            colorClass: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
          })}
          {renderMetricCard({
            title: "Tổng DN lên Cloud",
            keyMonth: "l2_a_cloud_month",
            keyYear: "l2_a_cloud_year",
            unit: "DN",
            icon: Server,
            colorClass: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
          })}
          {renderMetricCard({
            title: "DN số hóa toàn diện",
            keyMonth: "l2_a_toan_dien_month",
            keyYear: "l2_a_toan_dien_year",
            unit: "DN",
            icon: Server,
            colorClass: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
          })}
          {renderMetricCard({
            title: "Card điện tử NetID",
            keyMonth: "l2_a_netid_month",
            keyYear: "l2_a_netid_year",
            unit: "Card",
            icon: Server,
            colorClass: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
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
            colorClass: "text-blue-400 border-blue-500/30 bg-blue-500/10",
          })}
          {renderMetricCard({
            title: "Sản phẩm / Dịch vụ CĐS",
            keyMonth: "l2_b_sp_cds_month",
            keyYear: "l2_b_sp_cds_year",
            unit: "SP",
            icon: Globe,
            colorClass: "text-blue-400 border-blue-500/30 bg-blue-500/10",
          })}
          {renderMetricCard({
            title: "Tổng đơn hàng",
            keyMonth: "l2_b_don_hang_month",
            keyYear: "l2_b_don_hang_year",
            unit: "Đơn",
            icon: Globe,
            colorClass: "text-blue-400 border-blue-500/30 bg-blue-500/10",
          })}
          {renderMetricCard({
            title: "Tốc độ tăng trưởng",
            keyMonth: "l2_b_tang_truong_month",
            keyYear: "l2_b_tang_truong_year",
            unit: "%",
            icon: Globe,
            colorClass: "text-blue-400 border-blue-500/30 bg-blue-500/10",
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
            colorClass: "text-purple-400 border-purple-500/30 bg-purple-500/10",
          })}
          {renderMetricCard({
            title: "Tổng nhân sự toàn hệ thống",
            keyMonth: "l2_c_nhan_su_month",
            keyYear: "l2_c_nhan_su_year",
            unit: "Nhân sự",
            icon: Cpu,
            colorClass: "text-purple-400 border-purple-500/30 bg-purple-500/10",
          })}
          {renderMetricCard({
            title: "Khóa đào tạo",
            keyMonth: "l2_c_dao_tao_month",
            keyYear: "l2_c_dao_tao_year",
            unit: "Khóa",
            icon: Cpu,
            colorClass: "text-purple-400 border-purple-500/30 bg-purple-500/10",
          })}
        </div>
      )}

      {/* ================= 5. TAB D CHI TIẾT ================= */}
      {activeTab === "D" && (
        <div className="space-y-5 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 w-full">
            {renderMetricCard({
              title: "Tương tác trang xem",
              keyMonth: "l2_d_trang_xem_month",
              keyYear: "l2_d_trang_xem_year",
              unit: "Lượt",
              icon: TrendingUp,
              colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
            })}
            {renderMetricCard({
              title: "Tổng số người xem",
              keyMonth: "l2_d_nguoi_xem_month",
              keyYear: "l2_d_nguoi_xem_year",
              unit: "Người",
              icon: TrendingUp,
              colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
            })}
            {renderMetricCard({
              title: "Google SEO hàng tháng",
              keyMonth: "l2_d_seo_month",
              keyYear: "l2_d_seo_year",
              unit: "Lượt",
              icon: TrendingUp,
              colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full">
            {renderMetricCard({
              title: "Khách hàng",
              keyMonth: "l2_d_khach_hang_month",
              keyYear: "l2_d_khach_hang_year",
              unit: "Khách",
              icon: TrendingUp,
              colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
            })}
            {renderMetricCard({
              title: "Tốc độ tăng trưởng",
              keyMonth: "l2_d_tang_truong_month",
              keyYear: "l2_d_tang_truong_year",
              unit: "%",
              icon: TrendingUp,
              colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
            })}
          </div>
        </div>
      )}

      {/* ================= 6. TAB E CHI TIẾT ================= */}
      {activeTab === "E" && (
        <div className="space-y-5 w-full">
          <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl w-full">
            <div className="flex items-center gap-3 w-full">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                <Info size={20} />
              </span>
              <div>
                <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[11px] font-bold text-cyan-300 border border-cyan-500/30">
                  Tab: E (Thông tin)
                </span>
                <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-100 mt-1">
                  Chỉ số theo dõi Hệ sinh thái (Nhóm E)
                </h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {TAB_E_ITEMS.map((item) => {
              const val = Number(
                data[item.key] ??
                  (dashboard as any)?.metadata?.level2_metrics?.[item.key] ??
                  (dashboard as any)?.metadata?.[item.key] ??
                  item.defaultValue
              );
              const targetUrl = metricLinks[item.key] || "";
              const hasLink = Boolean(targetUrl);

              return (
                <div
                  key={item.key}
                  {...cardLinkProps(targetUrl)}
                  className={`w-full group relative overflow-hidden rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl transition-all duration-300 ${
                    hasLink ? "cursor-pointer hover:border-cyan-500/40 hover:-translate-y-0.5 hover:bg-[#0f1f3d]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-3 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-emerald-400 text-sm font-bold shrink-0">✅</span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-200 truncate group-hover:text-cyan-300 transition">
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 z-10">
                      {hasLink && (
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 transition hover:text-white"
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
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-400 transition hover:bg-amber-500/20"
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
                            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-1.5 text-cyan-400 transition hover:bg-cyan-500/20"
                            title="Setup số lượng"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-baseline gap-1.5 w-full">
                    <span
                      className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight"
                      style={{ color: item.color }}
                    >
                      {val.toLocaleString("vi-VN")}
                    </span>
                    {item.unit && (
                      <span className="text-xs font-semibold text-slate-400 font-sans">{item.unit}</span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] border-t border-white/5 pt-2 w-full">
                    {hasLink ? (
                      <span className="flex items-center gap-1 text-cyan-400 font-medium">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                        Bấm để mở link
                        <ExternalLink size={11} />
                      </span>
                    ) : (
                      <span className="text-slate-500">Chưa cài link</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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