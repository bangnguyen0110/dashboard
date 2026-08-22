"use client";

import React, { useState } from "react";
import {
  FileText,
  MessageSquareText,
  Building2,
  Store,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  PieChart,
  BarChart3,
  TrendingUp,
  Settings,
  ExternalLink,
  Link as LinkIcon,
  Edit3,
} from "lucide-react";
import { CellQuantityModal } from "./blocks/cell-quantity-modal";
import { BlockIdModal } from "./blocks/block-id-modal";
import { MetricIdModal } from "./blocks/metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { getStoredMetricId } from "@/lib/card-link";

interface Level4ViewProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks?: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged?: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function Level4View({
  dashboard,
  data = {},
  metricLinks = {},
  metricIds = {},
  onChanged = () => {},
  onOpenMetricId,
  onSaveMetricId,
  onSaveQuantity,
}: Level4ViewProps) {
  const { isAdmin } = useAuth();
  const [showBlockId, setShowBlockId] = useState(false);

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
    if (onOpenMetricId) {
      onOpenMetricId(key, label);
      return;
    }
    const id = getStoredMetricId(metricIds, key, metricLinks[key]);
    setMetricIdTarget({ key, label, id });
  };

  // 1. DỮ LIỆU CHÍNH SÁCH HỖ TRỢ
  const csDoanhNghiep = Number(data["cs_doanh_nghiep"] ?? 0);
  const csHoKinhDoanh = Number(data["cs_ho_kinh_doanh"] ?? 0);
  const csHopTacXa = Number(data["cs_hop_tac_xa"] ?? 0);
  const totalChinhSach = csDoanhNghiep + csHoKinhDoanh + csHopTacXa;

  // Tính toán biểu đồ tròn cho Chính sách
  const csSegments = [
    { name: "Doanh nghiệp", value: csDoanhNghiep, color: "#3b82f6" }, // Xanh dương
    { name: "Hộ kinh doanh", value: csHoKinhDoanh, color: "#10b981" }, // Xanh lá
    { name: "Hợp tác xã", value: csHopTacXa, color: "#a855f7" }, // Tím
  ];

  const radius = 58;
  const circumference = 2 * Math.PI * radius; // ≈ 364.42
  let csOffset = 0;

  // 2. DỮ LIỆU GIẢI ĐÁP KIẾN NGHỊ
  const knDaGiaiDap = Number(data["kn_da_giai_dap"] ?? 0);
  const knChuaGiaiDap = Number(data["kn_chua_giai_dap"] ?? 0);
  const knXemXet = Number(data["kn_xem_xet"] ?? 0);
  const totalKienNghi = knDaGiaiDap + knChuaGiaiDap + knXemXet;

  const pctGiaiDapThanhCong =
    totalKienNghi > 0 ? ((knDaGiaiDap / totalKienNghi) * 100).toFixed(1) : "0.0";

  // Dữ liệu cột cho Biểu đồ giải đáp kiến nghị
  const maxKn = Math.max(knDaGiaiDap, knChuaGiaiDap, knXemXet, 1);
  const knBars = [
    {
      label: "ĐÃ GIẢI ĐÁP",
      value: knDaGiaiDap,
      rate: totalKienNghi > 0 ? ((knDaGiaiDap / totalKienNghi) * 100).toFixed(1) : "0.0",
      color: "text-emerald-400",
      gradient: "from-emerald-600 to-teal-400",
      icon: CheckCircle2,
    },
    {
      label: "CHƯA GIẢI ĐÁP",
      value: knChuaGiaiDap,
      rate: totalKienNghi > 0 ? ((knChuaGiaiDap / totalKienNghi) * 100).toFixed(1) : "0.0",
      color: "text-rose-400",
      gradient: "from-rose-600 to-pink-400",
      icon: AlertCircle,
    },
    {
      label: "XEM XÉT",
      value: knXemXet,
      rate: totalKienNghi > 0 ? ((knXemXet / totalKienNghi) * 100).toFixed(1) : "0.0",
      color: "text-amber-400",
      gradient: "from-amber-600 to-yellow-400",
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* ================= KHỐI 1: CHÍNH SÁCH HỖ TRỢ ================= */}
        <section className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 flex flex-col justify-between">
          <div>
            {/* Header Khối 1 */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)]">
                  <FileText size={18} />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-cyan-400">
                    1. CHÍNH SÁCH HỖ TRỢ
                  </h3>
                  <p className="text-xs text-slate-400">
                    Phân loại đối tượng thụ hưởng chính sách phát triển
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                  Tổng: {totalChinhSach} chính sách
                </span>
              </div>
            </div>

            {/* 3 THẺ CHỈ SỐ NHÓM 1 */}
            <div className="space-y-3 mb-5">
              {/* Thẻ 1: Doanh nghiệp */}
              <div className="rounded-xl border border-white/5 bg-[#0c1830]/90 p-3.5 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                      Doanh nghiệp
                    </h4>
                    <p className="text-[11px] text-slate-400">Chính sách hỗ trợ doanh nghiệp</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-black text-blue-400 tabular-nums">
                    {csDoanhNghiep.toLocaleString("vi-VN")}
                  </span>

                  {metricLinks["l4_cs_doanh_nghiep"] && (
                    <a
                      href={metricLinks["l4_cs_doanh_nghiep"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                      title="Xem web"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenId("l4_cs_doanh_nghiep", "Chính sách - Doanh nghiệp")}
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyTarget({
                            key: "l4_cs_doanh_nghiep",
                            field: "cs_doanh_nghiep",
                            label: "Chính sách - Doanh nghiệp",
                            current: csDoanhNghiep,
                            matchTokens: ["doanh nghiệp", "cs_doanh_nghiep"],
                          })
                        }
                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                        title="Setup số lượng"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Thẻ 2: Hộ kinh doanh */}
              <div className="rounded-xl border border-white/5 bg-[#0c1830]/90 p-3.5 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <Store size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                      Hộ kinh doanh
                    </h4>
                    <p className="text-[11px] text-slate-400">Chính sách ưu đãi hộ cá thể</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                    {csHoKinhDoanh.toLocaleString("vi-VN")}
                  </span>

                  {metricLinks["l4_cs_ho_kinh_doanh"] && (
                    <a
                      href={metricLinks["l4_cs_ho_kinh_doanh"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                      title="Xem web"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenId("l4_cs_ho_kinh_doanh", "Chính sách - Hộ kinh doanh")}
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyTarget({
                            key: "l4_cs_ho_kinh_doanh",
                            field: "cs_ho_kinh_doanh",
                            label: "Chính sách - Hộ kinh doanh",
                            current: csHoKinhDoanh,
                            matchTokens: ["hộ kinh doanh", "cs_ho_kinh_doanh"],
                          })
                        }
                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                        title="Setup số lượng"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Thẻ 3: Hợp tác xã */}
              <div className="rounded-xl border border-white/5 bg-[#0c1830]/90 p-3.5 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400">
                    <Users size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                      Hợp tác xã
                    </h4>
                    <p className="text-[11px] text-slate-400">Hỗ trợ phát triển kinh tế tập thể</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-black text-purple-400 tabular-nums">
                    {csHopTacXa.toLocaleString("vi-VN")}
                  </span>

                  {metricLinks["l4_cs_hop_tac_xa"] && (
                    <a
                      href={metricLinks["l4_cs_hop_tac_xa"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                      title="Xem web"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenId("l4_cs_hop_tac_xa", "Chính sách - Hợp tác xã")}
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyTarget({
                            key: "l4_cs_hop_tac_xa",
                            field: "cs_hop_tac_xa",
                            label: "Chính sách - Hợp tác xã",
                            current: csHopTacXa,
                            matchTokens: ["hợp tác xã", "cs_hop_tac_xa"],
                          })
                        }
                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                        title="Setup số lượng"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BIỂU ĐỒ TRÒN (DONUT CHART) CHÍNH SÁCH */}
            <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <PieChart size={15} className="text-blue-400" />
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
                    BIỂU ĐỒ PHÂN BỔ CHÍNH SÁCH
                  </h4>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                {/* SVG Donut Chart */}
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="20"
                    />

                    {totalChinhSach > 0 ? (
                      csSegments.map((seg) => {
                        const share = seg.value / totalChinhSach;
                        const strokeDasharray = `${share * circumference} ${circumference}`;
                        const strokeDashoffset = -csOffset * circumference;
                        csOffset += share;

                        return (
                          <circle
                            key={seg.name}
                            cx="80"
                            cy="80"
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="20"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-700 hover:opacity-85"
                          />
                        );
                      })
                    ) : (
                      <circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        stroke="#334155"
                        strokeWidth="20"
                        strokeDasharray="4 4"
                      />
                    )}
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-xl font-black text-slate-100 tabular-nums">
                      {totalChinhSach}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Chính sách
                    </span>
                  </div>
                </div>

                {/* Chú thích bên cạnh */}
                <div className="space-y-2 text-xs">
                  {csSegments.map((seg) => {
                    const percentage =
                      totalChinhSach > 0 ? ((seg.value / totalChinhSach) * 100).toFixed(1) : "0.0";

                    return (
                      <div key={seg.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                        <span className="text-slate-300 font-medium">{seg.name}:</span>
                        <strong style={{ color: seg.color }}>{seg.value}</strong>
                        <span className="text-slate-400 font-mono text-[11px]">({percentage}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= KHỐI 2: GIẢI ĐÁP KIẾN NGHỊ ================= */}
        <section className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 flex flex-col justify-between">
          <div>
            {/* Header Khối 2 */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]">
                  <MessageSquareText size={18} />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-cyan-400">
                    2. GIẢI ĐÁP KIẾN NGHỊ
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tình hình tiếp nhận & xử lý phản ánh, kiến nghị của nhân dân
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Đã giải quyết: {pctGiaiDapThanhCong}%
                </span>
              </div>
            </div>

            {/* 3 THẺ CHỈ SỐ NHÓM 2 */}
            <div className="space-y-3 mb-5">
              {/* Thẻ 1: Đã giải đáp */}
              <div className="rounded-xl border border-white/5 bg-[#0c1830]/90 p-3.5 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                      Đã giải đáp
                    </h4>
                    <p className="text-[11px] text-slate-400">Kiến nghị đã hoàn tất xử lý</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                    {knDaGiaiDap.toLocaleString("vi-VN")}
                  </span>

                  {metricLinks["l4_kn_da_giai_dap"] && (
                    <a
                      href={metricLinks["l4_kn_da_giai_dap"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                      title="Xem web"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenId("l4_kn_da_giai_dap", "Kiến nghị - Đã giải đáp")}
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyTarget({
                            key: "l4_kn_da_giai_dap",
                            field: "kn_da_giai_dap",
                            label: "Kiến nghị - Đã giải đáp",
                            current: knDaGiaiDap,
                            matchTokens: ["đã giải đáp", "kn_da_giai_dap"],
                          })
                        }
                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                        title="Setup số lượng"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Thẻ 2: Chưa giải đáp */}
              <div className="rounded-xl border border-white/5 bg-[#0c1830]/90 p-3.5 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400">
                    <AlertCircle size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                      Chưa giải đáp
                    </h4>
                    <p className="text-[11px] text-slate-400">Kiến nghị mới tiếp nhận tồn đọng</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-black text-rose-400 tabular-nums">
                    {knChuaGiaiDap.toLocaleString("vi-VN")}
                  </span>

                  {metricLinks["l4_kn_chua_giai_dap"] && (
                    <a
                      href={metricLinks["l4_kn_chua_giai_dap"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                      title="Xem web"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenId("l4_kn_chua_giai_dap", "Kiến nghị - Chưa giải đáp")}
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyTarget({
                            key: "l4_kn_chua_giai_dap",
                            field: "kn_chua_giai_dap",
                            label: "Kiến nghị - Chưa giải đáp",
                            current: knChuaGiaiDap,
                            matchTokens: ["chưa giải đáp", "kn_chua_giai_dap"],
                          })
                        }
                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                        title="Setup số lượng"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Thẻ 3: Xem xét */}
              <div className="rounded-xl border border-white/5 bg-[#0c1830]/90 p-3.5 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                      Xem xét
                    </h4>
                    <p className="text-[11px] text-slate-400">Đang trong quy trình thẩm tra, xác minh</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-black text-amber-400 tabular-nums">
                    {knXemXet.toLocaleString("vi-VN")}
                  </span>

                  {metricLinks["l4_kn_xem_xet"] && (
                    <a
                      href={metricLinks["l4_kn_xem_xet"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                      title="Xem web"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenId("l4_kn_xem_xet", "Kiến nghị - Xem xét")}
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyTarget({
                            key: "l4_kn_xem_xet",
                            field: "kn_xem_xet",
                            label: "Kiến nghị - Xem xét",
                            current: knXemXet,
                            matchTokens: ["xem xét", "kn_xem_xet"],
                          })
                        }
                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                        title="Setup số lượng"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BIỂU ĐỒ CỘT (BAR CHART) GIẢI ĐÁP KIẾN NGHỊ */}
            <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-emerald-400" />
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
                    TIẾN ĐỘ XỬ LÝ KIẾN NGHỊ
                  </h4>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                  <span>Tổng nhận: {totalKienNghi} KN</span>
                </div>
              </div>

              {/* Vùng vẽ 3 cột */}
              <div className="pt-2 pb-1">
                <div className="grid grid-cols-3 gap-3 items-end h-[140px] px-2">
                  {knBars.map((bar) => {
                    const heightPercent =
                      totalKienNghi > 0
                        ? Math.min(100, Math.max(12, (bar.value / maxKn) * 100))
                        : 8;

                    return (
                      <div key={bar.label} className="flex flex-col items-center h-full justify-end group">
                        {/* Con số & Tỷ lệ % */}
                        <div className="mb-1 text-center">
                          <span className={`text-xs sm:text-sm font-black tabular-nums ${bar.color}`}>
                            {bar.value}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-mono">
                            ({bar.rate}%)
                          </span>
                        </div>

                        {/* Cột */}
                        <div className="w-full max-w-[48px] h-[75px] bg-slate-900/80 rounded-t-xl border border-white/10 p-0.5 flex flex-col justify-end shadow-inner">
                          <div
                            className={`w-full rounded-t-lg bg-gradient-to-t ${bar.gradient} shadow-lg transition-all duration-700 group-hover:brightness-125`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>

                        {/* Nhãn chân cột */}
                        <div className="mt-2 text-center w-full">
                          <div className="text-[11px] font-bold text-slate-200 truncate">
                            {bar.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modal Block ID */}
      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="L4"
          currentId={(dashboard as any).l4_custom_id ?? (dashboard as any)?.metadata?.l4_custom_id ?? ""}
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {/* Modal Chỉnh sửa số lượng */}
      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="L4"
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

      {/* Modal Thiết lập Metric ID */}
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

export default Level4View;