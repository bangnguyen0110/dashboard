"use client";

import React, { useState } from "react";
import {
  Building2,
  Server,
  Globe,
  Cpu,
  TrendingUp,
  FileText,
  HeartHandshake,
  Users,
  Briefcase,
  Calendar,
  Layers,
  Sparkles,
  CreditCard,
  ShoppingCart,
  Cloud,
  ExternalLink,
  Link as LinkIcon,
  Edit3,
  Eye,
  Search,
  BookOpen,
  Compass,
} from "lucide-react";
import { CellQuantityModal } from "./blocks/cell-quantity-modal";
import { MetricIdModal } from "./blocks/metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";

interface Level2ViewProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks?: Record<string, string>;
  onChanged?: () => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

type TabKey = "all" | "A" | "B" | "C" | "D" | "E";

const TABS: { id: TabKey; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "Tổng quan Nhóm A-E", icon: Layers },
  { id: "A", label: "A - (Hạ tầng)", icon: Server },
  { id: "B", label: "B (Hiện diện số)", icon: Globe },
  { id: "C", label: "C (Vận hành)", icon: Cpu },
  { id: "D", label: "D (Thị trường)", icon: TrendingUp },
  { id: "E", label: "E (Thông tin)", icon: FileText },
];

export function Level2View({
  dashboard,
  data = {},
  metricLinks = {},
  onChanged = () => {},
  onSaveMetricId,
  onSaveQuantity,
}: Level2ViewProps) {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("all");

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
    const url = metricLinks[key] || "";
    const id = url.split("/").filter(Boolean).pop() || "";
    setMetricIdTarget({ key, label, id });
  };

  // Helper render thẻ chỉ số lớn
  const renderCard = ({
    itemKey,
    field,
    label,
    value,
    unit = "",
    deltaText = "+0 trong tháng",
    icon: Icon,
    color = "text-cyan-400",
    badgeBg = "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  }: {
    itemKey: string;
    field: string;
    label: string;
    value: number;
    unit?: string;
    deltaText?: string;
    icon: React.ElementType;
    color?: string;
    badgeBg?: string;
  }) => {
    const targetUrl = metricLinks[itemKey] || "";

    return (
      <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl transition hover:border-white/15 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${badgeBg}`}>
              <Icon size={18} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-200">
                {label}
              </h4>
              <span className="text-[11px] font-medium text-emerald-400">{deltaText}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {targetUrl && (
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 transition hover:text-white"
                title="Xem web"
              >
                <ExternalLink size={13} />
              </a>
            )}
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenId(itemKey, label)}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-400 transition hover:bg-amber-500/20"
                  title="Thiết lập ID"
                >
                  <LinkIcon size={13} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setQtyTarget({
                      key: itemKey,
                      field,
                      label,
                      current: value,
                      matchTokens: [label.toLowerCase()],
                    })
                  }
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-1.5 text-cyan-400 transition hover:bg-cyan-500/20"
                  title="Setup số lượng"
                >
                  <Edit3 size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between pt-3 border-t border-white/5">
          <span className="text-xs font-semibold text-slate-400">Số lượng hiện tại</span>
          <div>
            <span className={`text-2xl sm:text-3xl font-black tabular-nums ${color}`}>
              {value.toLocaleString("vi-VN")}
            </span>
            {unit && <span className="ml-1.5 text-xs font-bold text-slate-400">{unit}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER TAB NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-2 shadow-xl backdrop-blur-xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all duration-300 ${
                isActive
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_-3px_rgba(6,182,212,0.4)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: TỔNG QUAN NHÓM A - E ================= */}
      {activeTab === "all" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Nhóm A: Hạ tầng */}
          <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Server size={16} />
                </span>
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-cyan-400">
                  A. HẠ TẦNG & SẴN SÀNG
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-300 font-medium">DN CĐS:</span>
                  <strong className="text-cyan-400 font-mono text-sm">
                    {Number(data["l2_a_dn_cds"] ?? 211).toLocaleString("vi-VN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-300 font-medium">Lên Cloud:</span>
                  <strong className="text-cyan-400 font-mono text-sm">
                    {Number(data["l2_a_cloud"] ?? 180).toLocaleString("vi-VN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-300 font-medium">NetID:</span>
                  <strong className="text-cyan-400 font-mono text-sm">
                    {Number(data["l2_a_netid"] ?? 320).toLocaleString("vi-VN")}
                  </strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("A")}
              className="mt-4 w-full rounded-xl bg-cyan-500/10 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              Xem chi tiết Nhóm A ➜
            </button>
          </div>

          {/* Nhóm B: Hiện diện số */}
          <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <Globe size={16} />
                </span>
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-blue-400">
                  B. HIỆN DIỆN SỐ & TM
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-300 font-medium">Web/E-com:</span>
                  <strong className="text-blue-400 font-mono text-sm">
                    {Number(data["l2_b_web_ecom"] ?? 145).toLocaleString("vi-VN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-300 font-medium">Đơn hàng:</span>
                  <strong className="text-blue-400 font-mono text-sm">
                    {Number(data["l2_b_don_hang"] ?? 1250).toLocaleString("vi-VN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-300 font-medium">Tăng trưởng:</span>
                  <strong className="text-emerald-400 font-mono text-sm">+18.5%</strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("B")}
              className="mt-4 w-full rounded-xl bg-blue-500/10 py-2 text-xs font-bold text-blue-300 transition hover:bg-blue-500/20"
            >
              Xem chi tiết Nhóm B ➜
            </button>
          </div>

          {/* Nhóm C: Vận hành */}
          <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  <Cpu size={16} />
                </span>
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-purple-400">
                  C. VẬN HÀNH & NGUỒN LỰC
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-300 font-medium">Hệ thống QLDN:</span>
                  <strong className="text-purple-400 font-mono text-sm">
                    {Number(data["l2_c_erp"] ?? 86).toLocaleString("vi-VN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-300 font-medium">Tổng nhân sự:</span>
                  <strong className="text-purple-400 font-mono text-sm">
                    {Number(data["l2_c_nhan_su"] ?? 4850).toLocaleString("vi-VN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-300 font-medium">Khóa đào tạo:</span>
                  <strong className="text-purple-400 font-mono text-sm">
                    {Number(data["l2_c_dao_tao"] ?? 24).toLocaleString("vi-VN")}
                  </strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("C")}
              className="mt-4 w-full rounded-xl bg-purple-500/10 py-2 text-xs font-bold text-purple-300 transition hover:bg-purple-500/20"
            >
              Xem chi tiết Nhóm C ➜
            </button>
          </div>

          {/* Nhóm D: Thị trường */}
          <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <TrendingUp size={16} />
                </span>
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-emerald-400">
                  D. TƯƠNG TÁC & THỊ TRƯỜNG
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-300 font-medium">Trang xem:</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {Number(data["l2_d_trang_xem"] ?? 45200).toLocaleString("vi-VN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-300 font-medium">Google SEO:</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {Number(data["l2_d_seo"] ?? 10282).toLocaleString("vi-VN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-300 font-medium">Doanh thu:</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {Number(data["l2_d_doanh_thu"] ?? 14800).toLocaleString("vi-VN")} TR
                  </strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("D")}
              className="mt-4 w-full rounded-xl bg-emerald-500/10 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
            >
              Xem chi tiết Nhóm D ➜
            </button>
          </div>

          {/* Nhóm E: Thông tin */}
          <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl flex flex-col justify-between md:col-span-2 lg:col-span-2">
            <div>
              <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <FileText size={16} />
                </span>
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-amber-400">
                  E. QUẢN LÝ THÔNG TIN
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Thiện nguyện:</span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {Number(data["l2_e_thien_nguyen"] ?? 6)}
                  </strong>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Kêu gọi ĐT:</span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {Number(data["l2_e_dau_tu"] ?? 8)}
                  </strong>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Dự án:</span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {Number(data["l2_e_du_an"] ?? 6)}
                  </strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("E")}
              className="mt-4 w-full rounded-xl bg-amber-500/10 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
            >
              Xem chi tiết Nhóm E ➜
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 2: A - HẠ TẦNG (4 THẺ - 50% MỖI THẺ) ================= */}
      {activeTab === "A" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {renderCard({
            itemKey: "l2_a_so_hoa_info",
            field: "a_so_hoa_info",
            label: "Tổng DN số hóa thông tin",
            value: Number(data["a_so_hoa_info"] ?? 211),
            unit: "DN",
            deltaText: "+0 trong tháng",
            icon: Server,
            color: "text-cyan-400",
            badgeBg: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
          })}
          {renderCard({
            itemKey: "l2_a_cloud",
            field: "a_cloud",
            label: "Tổng DN lên Cloud",
            value: Number(data["a_cloud"] ?? 180),
            unit: "DN",
            deltaText: "+0 trong tháng",
            icon: Cloud,
            color: "text-blue-400",
            badgeBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
          })}
          {renderCard({
            itemKey: "l2_a_dn_toan_dien",
            field: "a_dn_toan_dien",
            label: "DN số hóa toàn diện",
            value: Number(data["a_dn_toan_dien"] ?? 45),
            unit: "DN",
            deltaText: "+2 trong tháng",
            icon: Cpu,
            color: "text-emerald-400",
            badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          })}
          {renderCard({
            itemKey: "l2_a_netid",
            field: "a_netid",
            label: "Card điện tử NetID",
            value: Number(data["a_netid"] ?? 320),
            unit: "CARD",
            deltaText: "+0 trong tháng",
            icon: CreditCard,
            color: "text-purple-400",
            badgeBg: "bg-purple-500/15 text-purple-400 border-purple-500/30",
          })}
        </div>
      )}

      {/* ================= TAB 3: B - HIỆN DIỆN SỐ (4 THẺ - 50% MỖI THẺ) ================= */}
      {activeTab === "B" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {renderCard({
            itemKey: "l2_b_web_ecom",
            field: "b_web_ecom",
            label: "Website & E-commerce",
            value: Number(data["b_web_ecom"] ?? 145),
            unit: "WEB",
            deltaText: "+0 phát sinh tháng",
            icon: Globe,
            color: "text-blue-400",
            badgeBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
          })}
          {renderCard({
            itemKey: "l2_b_sp_cds",
            field: "b_sp_cds",
            label: "Sản phẩm / Dịch vụ CĐS",
            value: Number(data["b_sp_cds"] ?? 820),
            unit: "SP/DV",
            deltaText: "+0 phát sinh tháng",
            icon: ShoppingCart,
            color: "text-emerald-400",
            badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          })}
          {renderCard({
            itemKey: "l2_b_don_hang",
            field: "b_don_hang",
            label: "Tổng đơn hàng",
            value: Number(data["b_don_hang"] ?? 1250),
            unit: "ĐƠN",
            deltaText: "+0 phát sinh tháng",
            icon: TrendingUp,
            color: "text-amber-400",
            badgeBg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          })}
          {renderCard({
            itemKey: "l2_b_tang_truong",
            field: "b_tang_truong",
            label: "Tốc độ tăng trưởng",
            value: Number(data["b_tang_truong"] ?? 18.5),
            unit: "%",
            deltaText: "+0 phát sinh tháng",
            icon: Sparkles,
            color: "text-pink-400",
            badgeBg: "bg-pink-500/15 text-pink-400 border-pink-500/30",
          })}
        </div>
      )}

      {/* ================= TAB 4: C - VẬN HÀNH (3 THẺ / 1 HÀNG) ================= */}
      {activeTab === "C" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {renderCard({
            itemKey: "l2_c_erp",
            field: "c_erp",
            label: "Hệ thống quản lý ERP",
            value: Number(data["c_erp"] ?? 86),
            unit: "HT",
            deltaText: "+0 phát sinh tháng",
            icon: Cpu,
            color: "text-purple-400",
            badgeBg: "bg-purple-500/15 text-purple-400 border-purple-500/30",
          })}
          {renderCard({
            itemKey: "l2_c_nhan_su",
            field: "c_nhan_su",
            label: "Tổng nhân sự toàn hệ thống",
            value: Number(data["c_nhan_su"] ?? 4850),
            unit: "NGƯỜI",
            deltaText: "+0 phát sinh tháng",
            icon: Users,
            color: "text-blue-400",
            badgeBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
          })}
          {renderCard({
            itemKey: "l2_c_dao_tao",
            field: "c_dao_tao",
            label: "Khóa đào tạo",
            value: Number(data["c_dao_tao"] ?? 24),
            unit: "KHÓA",
            deltaText: "+0 phát sinh tháng",
            icon: BookOpen,
            color: "text-emerald-400",
            badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          })}
        </div>
      )}

      {/* ================= TAB 5: D - THỊ TRƯỜNG (HÀNG 1: 3 THẺ, HÀNG 2: 2 THẺ) ================= */}
      {activeTab === "D" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {renderCard({
              itemKey: "l2_d_trang_xem",
              field: "d_trang_xem",
              label: "Tương tác trang xem",
              value: Number(data["d_trang_xem"] ?? 45200),
              unit: "LƯỢT",
              deltaText: "+252 / tháng",
              icon: Eye,
              color: "text-cyan-400",
              badgeBg: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
            })}
            {renderCard({
              itemKey: "l2_d_nguoi_xem",
              field: "d_nguoi_xem",
              label: "Tổng số người xem",
              value: Number(data["d_nguoi_xem"] ?? 12450),
              unit: "NGƯỜI",
              deltaText: "+55 / tháng",
              icon: Users,
              color: "text-blue-400",
              badgeBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
            })}
            {renderCard({
              itemKey: "l2_d_seo",
              field: "d_seo",
              label: "Google SEO hàng tháng",
              value: Number(data["d_seo"] ?? 10282),
              unit: "LƯỢT",
              deltaText: "+10282 / tháng",
              icon: Search,
              color: "text-emerald-400",
              badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {renderCard({
              itemKey: "l2_d_khach_hang",
              field: "d_khach_hang",
              label: "Khách hàng",
              value: Number(data["d_khach_hang"] ?? 1450),
              unit: "KH",
              deltaText: "+55 / tháng",
              icon: Users,
              color: "text-amber-400",
              badgeBg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
            })}
            {renderCard({
              itemKey: "l2_d_tang_truong_tien",
              field: "d_tang_truong_tien",
              label: "Tốc độ tăng trưởng",
              value: Number(data["d_tang_truong_tien"] ?? 0),
              unit: "TR / THÁNG",
              deltaText: "+0 Tr / tháng",
              icon: TrendingUp,
              color: "text-pink-400",
              badgeBg: "bg-pink-500/15 text-pink-400 border-pink-500/30",
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 6: E - THÔNG TIN (TIÊU ĐỀ + LƯỚI 9 CHỈ TIÊU 3x3) ================= */}
      {activeTab === "E" && (
        <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <FileText size={16} />
              </span>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
                Chỉ số theo dõi Hệ sinh thái (Nhóm E) - Trong Tháng & Năm
              </h4>
            </div>
            <span className="text-xs font-semibold text-slate-400">9 chỉ tiêu tổng hợp</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { key: "l2_e_dn", label: "Doanh nghiệp", val: Number(data["e_dn"] ?? 211), delta: "+0 Tháng", icon: Building2, color: "text-blue-400" },
              { key: "l2_e_thien_nguyen", label: "Công tác thiện nguyện", val: Number(data["e_thien_nguyen"] ?? 6), delta: "+0 Tháng", icon: HeartHandshake, color: "text-rose-400" },
              { key: "l2_e_bang_tin", label: "Bảng tin", val: Number(data["e_bang_tin"] ?? 76), delta: "+0 Tháng", icon: FileText, color: "text-cyan-400" },
              { key: "l2_e_du_an", label: "Dự án", val: Number(data["e_du_an"] ?? 6), delta: "+0 Tháng", icon: Briefcase, color: "text-emerald-400" },
              { key: "l2_e_dau_tu", label: "Kêu gọi đầu tư", val: Number(data["e_dau_tu"] ?? 8), delta: "+0 Tháng", icon: TrendingUp, color: "text-amber-400" },
              { key: "l2_e_du_lich", label: "Du lịch", val: Number(data["e_du_lich"] ?? 6), delta: "+0 Tháng", icon: Compass, color: "text-pink-400" },
              { key: "l2_e_su_kien", label: "Sự kiện nổi bật", val: Number(data["e_su_kien"] ?? 7), delta: "+0 Tháng", icon: Calendar, color: "text-purple-400" },
              { key: "l2_e_cds", label: "Chuyển đổi số", val: Number(data["e_cds"] ?? 2), delta: "+0 Tháng", icon: Cpu, color: "text-teal-400" },
              { key: "l2_e_thu_vien", label: "Thư viện", val: Number(data["e_thu_vien"] ?? 4), delta: "+0 Tháng", icon: BookOpen, color: "text-indigo-400" },
            ].map((item) => {
              const Icon = item.icon;
              const targetUrl = metricLinks[item.key] || "";

              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-white/5 bg-[#061121]/70 p-4 transition hover:border-white/15 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800/60 border border-white/5">
                      <Icon size={16} className={item.color} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{item.label}</div>
                      <div className="text-[11px] font-semibold text-emerald-400">{item.delta}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-black tabular-nums ${item.color}`}>
                      {item.val}
                    </span>
                    {targetUrl && (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem web"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleOpenId(item.key, item.label)}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: item.key,
                              field: item.key.replace("l2_", ""),
                              label: item.label,
                              current: item.val,
                              matchTokens: [item.label.toLowerCase()],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa số lượng */}
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

      {/* Modal Thiết lập ID */}
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