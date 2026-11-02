"use client";

import React, { useEffect } from "react";
import {
  X,
  TrendingUp,
  Building2,
  Package,
  Award,
  DollarSign,
  Calendar,
  CheckCircle2,
  Percent,
  ArrowUpRight,
} from "lucide-react";
import type { KpiRow } from "@/lib/types";
import { formatVnNumber } from "@/lib/revenue-sync";
import { readB3Revenue } from "./blocks/b3-revenue-section";

// ============================================================================
// 1. MODAL CHI TIẾT TỶ LỆ CHUYỂN ĐỔI SỐ
// ============================================================================
interface CdsDetailModalProps {
  open: boolean;
  onClose: () => void;
  b1?: KpiRow;
  locationName?: string;
}

export function CdsDetailModal({
  open,
  onClose,
  b1 = {},
  locationName = "Toàn Tỉnh",
}: CdsDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const smeTotal = Number(b1.sme_total ?? 0);
  const hkdTotal = Number(b1.hkd_total ?? 0);
  const htxTotal = Number(b1.htx_total ?? 0);
  const totalUnits = smeTotal + hkdTotal + htxTotal;

  const smeDx = Number(b1.sme_dx ?? b1.sme_cds ?? 0);
  const hkdDx = Number(b1.hkd_dx ?? b1.hkd_cds ?? 0);
  const htxDx = Number(b1.htx_dx ?? b1.htx_cds ?? 0);
  const totalDx = smeDx + hkdDx + htxDx;

  const totalDxPercent =
    totalUnits > 0 ? ((totalDx / totalUnits) * 100).toFixed(1) : "0.0";
  const smePercent =
    smeTotal > 0 ? ((smeDx / smeTotal) * 100).toFixed(1) : "0.0";
  const hkdPercent =
    hkdTotal > 0 ? ((hkdDx / hkdTotal) * 100).toFixed(1) : "0.0";
  const htxPercent =
    htxTotal > 0 ? ((htxDx / htxTotal) * 100).toFixed(1) : "0.0";

  const rows = [
    {
      label: "Doanh nghiệp SME",
      total: smeTotal,
      dx: smeDx,
      percent: smePercent,
      color: "text-blue-600 dark:text-blue-400",
      barColor: "bg-blue-600",
    },
    {
      label: "Hộ kinh doanh",
      total: hkdTotal,
      dx: hkdDx,
      percent: hkdPercent,
      color: "text-emerald-600 dark:text-emerald-400",
      barColor: "bg-emerald-600",
    },
    {
      label: "Hợp tác xã",
      total: htxTotal,
      dx: htxDx,
      percent: htxPercent,
      color: "text-purple-600 dark:text-purple-400",
      barColor: "bg-purple-600",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl bg-[#e8f1fa] dark:bg-[#071326] rounded-xl border border-[#bfd7ee] dark:border-[#25427b] shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header xanh dương căn giữa */}
        <div className="bg-[#0047db] dark:bg-[#0047db] text-white py-4 px-6 relative flex items-center justify-center border-b border-blue-800 dark:border-white/10 shrink-0">
          <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider text-center text-white">
            CHI TIẾT TỶ LỆ CHUYỂN ĐỔI SỐ
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nội dung cuộn */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Thẻ 1: Tổng quan toàn bộ */}
          <div className="bg-white dark:bg-[#0a1830] rounded-xl flex flex-col overflow-hidden border border-[#bfd7ee] dark:border-[#25427b] shadow-xs">
            <div className="bg-blue-100 dark:bg-[#1a3263] px-5 py-3 border-b border-[#bfd7ee] dark:border-[#25427b] flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Building2 size={16} className="text-blue-700 dark:text-blue-300" />
                Tổng thể đơn vị kinh doanh ({locationName})
              </span>
              <span className="text-xs font-bold text-blue-800 dark:text-blue-200 bg-white/60 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-[#bfd7ee] dark:border-white/10">
                Tỷ lệ: {totalDxPercent}%
              </span>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#bfd7ee]/70 dark:border-white/5 bg-slate-50 dark:bg-white/5 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng số đơn vị</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
                    {totalUnits.toLocaleString("vi-VN")}{" "}
                    <span className="text-xs font-normal text-slate-500">đơn vị</span>
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-white/5 bg-emerald-50/50 dark:bg-white/5 p-3.5">
                  <p className="text-xs text-emerald-700 dark:text-blue-300 font-medium">Đã chuyển đổi số</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-blue-400 mt-1 tabular-nums">
                    {totalDx.toLocaleString("vi-VN")}{" "}
                    <span className="text-xs font-normal text-slate-500">đơn vị</span>
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="text-slate-600 dark:text-slate-300">Tiến độ hoàn thành</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">{totalDxPercent}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 dark:bg-[#162b54] rounded-full overflow-hidden border border-[#bfd7ee] dark:border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Number(totalDxPercent))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Thẻ 2: Bảng chi tiết từng loại hình */}
          <div className="bg-white dark:bg-[#0a1830] rounded-xl flex flex-col overflow-hidden border border-[#bfd7ee] dark:border-[#25427b] shadow-xs">
            <div className="bg-blue-100 dark:bg-[#1a3263] px-5 py-3 border-b border-[#bfd7ee] dark:border-[#25427b] flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-700 dark:text-blue-300" />
                Chi tiết tỷ lệ theo loại hình đơn vị
              </span>
              <span className="text-xs text-blue-700 dark:text-blue-300">3 nhóm đơn vị</span>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#bfd7ee] dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4 font-bold">Loại hình</th>
                    <th className="py-3 px-4 font-bold text-right">Tổng số</th>
                    <th className="py-3 px-4 font-bold text-right">Đã CĐS</th>
                    <th className="py-3 px-4 font-bold text-right">Tỷ lệ CĐS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#bfd7ee]/50 dark:divide-white/5">
                  {rows.map((row) => (
                    <tr
                      key={row.label}
                      className="hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${row.barColor}`} />
                        {row.label}
                      </td>
                      <td className="py-3 px-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                        {row.total.toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-emerald-600 dark:text-blue-400">
                        {row.dx.toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-[#bfd7ee] dark:border-blue-800">
                          {row.percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. MODAL CHI TIẾT TỶ LỆ SẢN PHẨM OCOP
// ============================================================================
interface OcopDetailModalProps {
  open: boolean;
  onClose: () => void;
  b2?: KpiRow;
  locationName?: string;
}

export function OcopDetailModal({
  open,
  onClose,
  b2 = {},
  locationName = "Toàn Tỉnh",
}: OcopDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const ocop3 = Number(b2.ocop_3star ?? 0);
  const ocop4 = Number(b2.ocop_4star ?? 0);
  const ocop5 = Number(b2.ocop_5star ?? 0);
  const totalOcop = ocop3 + ocop4 + ocop5;

  const spThuong = Number(b2.sp_thuong ?? 0);
  const dichVu = Number(b2.dich_vu ?? 0);
  const totalAll = totalOcop + spThuong + dichVu;

  const ocopRate =
    totalAll > 0 ? ((totalOcop / totalAll) * 100).toFixed(1) : "0.0";

  const ocopItems = [
    {
      label: "OCOP 3 Sao",
      count: ocop3,
      pctAll: totalAll > 0 ? ((ocop3 / totalAll) * 100).toFixed(1) : "0.0",
      pctOcop: totalOcop > 0 ? ((ocop3 / totalOcop) * 100).toFixed(1) : "0.0",
      color: "bg-amber-500",
      textColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "OCOP 4 Sao",
      count: ocop4,
      pctAll: totalAll > 0 ? ((ocop4 / totalAll) * 100).toFixed(1) : "0.0",
      pctOcop: totalOcop > 0 ? ((ocop4 / totalOcop) * 100).toFixed(1) : "0.0",
      color: "bg-orange-500",
      textColor: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "OCOP 5 Sao",
      count: ocop5,
      pctAll: totalAll > 0 ? ((ocop5 / totalAll) * 100).toFixed(1) : "0.0",
      pctOcop: totalOcop > 0 ? ((ocop5 / totalOcop) * 100).toFixed(1) : "0.0",
      color: "bg-red-500",
      textColor: "text-red-600 dark:text-red-400",
    },
    {
      label: "Sản phẩm thường",
      count: spThuong,
      pctAll: totalAll > 0 ? ((spThuong / totalAll) * 100).toFixed(1) : "0.0",
      pctOcop: "-",
      color: "bg-blue-500",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Tổng dịch vụ",
      count: dichVu,
      pctAll: totalAll > 0 ? ((dichVu / totalAll) * 100).toFixed(1) : "0.0",
      pctOcop: "-",
      color: "bg-purple-500",
      textColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl bg-[#e8f1fa] dark:bg-[#071326] rounded-xl border border-[#bfd7ee] dark:border-[#25427b] shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header xanh dương căn giữa */}
        <div className="bg-[#0047db] dark:bg-[#0047db] text-white py-4 px-6 relative flex items-center justify-center border-b border-blue-800 dark:border-white/10 shrink-0">
          <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider text-center text-white">
            TỶ LỆ SẢN PHẨM OCOP
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nội dung cuộn */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Thẻ 1: Tổng thể cơ cấu OCOP */}
          <div className="bg-white dark:bg-[#0a1830] rounded-xl flex flex-col overflow-hidden border border-[#bfd7ee] dark:border-[#25427b] shadow-xs">
            <div className="bg-blue-100 dark:bg-[#1a3263] px-5 py-3 border-b border-[#bfd7ee] dark:border-[#25427b] flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Award size={16} className="text-blue-700 dark:text-blue-300" />
                Cơ cấu sản phẩm OCOP & Toàn bộ hàng hoá ({locationName})
              </span>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                Tỷ lệ OCOP: {ocopRate}%
              </span>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#bfd7ee]/70 dark:border-white/5 bg-slate-50 dark:bg-white/5 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng sản phẩm & DV</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
                    {totalAll.toLocaleString("vi-VN")}{" "}
                    <span className="text-xs font-normal text-slate-500">mục</span>
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 dark:border-white/5 bg-amber-50/50 dark:bg-white/5 p-3.5">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Tổng sản phẩm OCOP</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                    {totalOcop.toLocaleString("vi-VN")}{" "}
                    <span className="text-xs font-normal text-slate-500">sản phẩm</span>
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="text-slate-600 dark:text-slate-300">Tỷ lệ OCOP trong toàn bộ cơ cấu</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">{ocopRate}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 dark:bg-[#162b54] rounded-full overflow-hidden border border-[#bfd7ee] dark:border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Number(ocopRate))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Thẻ 2: Bảng chi tiết từng hạng sản phẩm */}
          <div className="bg-white dark:bg-[#0a1830] rounded-xl flex flex-col overflow-hidden border border-[#bfd7ee] dark:border-[#25427b] shadow-xs">
            <div className="bg-blue-100 dark:bg-[#1a3263] px-5 py-3 border-b border-[#bfd7ee] dark:border-[#25427b] flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Package size={16} className="text-blue-700 dark:text-blue-300" />
                Chi tiết tỷ lệ phần trăm các loại sản phẩm
              </span>
              <span className="text-xs text-blue-700 dark:text-blue-300">Phân loại 3 sao / 4 sao / 5 sao</span>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#bfd7ee] dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4 font-bold">Phân loại</th>
                    <th className="py-3 px-4 font-bold text-right">Số lượng</th>
                    <th className="py-3 px-4 font-bold text-right">Tỷ lệ trong OCOP</th>
                    <th className="py-3 px-4 font-bold text-right">Tỷ lệ tổng thể</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#bfd7ee]/50 dark:divide-white/5">
                  {ocopItems.map((item) => (
                    <tr
                      key={item.label}
                      className="hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                        {item.label}
                      </td>
                      <td className="py-3 px-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                        {item.count.toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {item.pctOcop !== "-" ? `${item.pctOcop}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-[#bfd7ee] dark:border-white/10">
                          {item.pctAll}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MODAL CHI TIẾT TĂNG TRƯỞNG DOANH THU
// ============================================================================
interface RevenueDetailModalProps {
  open: boolean;
  onClose: () => void;
  b3?: KpiRow;
  locationName?: string;
}

export function RevenueDetailModal({
  open,
  onClose,
  b3 = {},
  locationName = "Toàn Tỉnh",
}: RevenueDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const rev = readB3Revenue(b3);

  // Mốc thời gian và tỷ lệ tăng trưởng
  const periods = [
    {
      period: "Theo Ngày",
      code: "Ngày",
      revenue: rev.daily,
      growth: "+2.45%",
      note: "So với chu kỳ ngày trước",
      isTarget: false,
    },
    {
      period: "Theo Tuần",
      code: "Tuần",
      revenue: rev.weekly,
      growth: "+5.80%",
      note: "So với tuần trước đó",
      isTarget: false,
    },
    {
      period: "Theo Tháng",
      code: "Tháng",
      revenue: rev.monthly,
      growth: "+10.71%",
      note: "Đạt chuẩn Kinh tế 02 con số",
      isTarget: true,
    },
    {
      period: "Theo Quý",
      code: "Quý",
      revenue: rev.quarterly,
      growth: "+14.30%",
      note: "So với quý liền kề",
      isTarget: false,
    },
    {
      period: "Theo Năm",
      code: "Năm",
      revenue: rev.yearly,
      growth: "+18.90%",
      note: "Tăng trưởng kinh tế số năm",
      isTarget: false,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl bg-[#e8f1fa] dark:bg-[#071326] rounded-xl border border-[#bfd7ee] dark:border-[#25427b] shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header xanh dương căn giữa */}
        <div className="bg-[#0047db] dark:bg-[#0047db] text-white py-4 px-6 relative flex items-center justify-center border-b border-blue-800 dark:border-white/10 shrink-0">
          <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider text-center text-white">
            CHI TIẾT TĂNG TRƯỞNG DOANH THU
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nội dung cuộn */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Thẻ 1: Doanh thu tháng và mục tiêu tăng trưởng */}
          <div className="bg-white dark:bg-[#0a1830] rounded-xl flex flex-col overflow-hidden border border-[#bfd7ee] dark:border-[#25427b] shadow-xs">
            <div className="bg-blue-100 dark:bg-[#1a3263] px-5 py-3 border-b border-[#bfd7ee] dark:border-[#25427b] flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <DollarSign size={16} className="text-blue-700 dark:text-blue-300" />
                Dòng chảy doanh thu & Tăng trưởng ({locationName})
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-blue-900/60 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-blue-700">
                Tháng: +10.71%
              </span>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#bfd7ee]/70 dark:border-white/5 bg-slate-50 dark:bg-white/5 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Doanh thu tháng hiện tại</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                    {formatVnNumber(rev.monthly)}{" "}
                    <span className="text-xs font-normal text-slate-500">VNĐ</span>
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-white/5 bg-emerald-50/50 dark:bg-white/5 p-3.5">
                  <p className="text-xs text-emerald-700 dark:text-blue-300 font-medium">Tăng trưởng đạt mục tiêu</p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                    +10.71%{" "}
                    <span className="text-xs font-normal text-slate-500">02 con số</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Thẻ 2: Bảng chi tiết tăng trưởng theo mốc thời gian */}
          <div className="bg-white dark:bg-[#0a1830] rounded-xl flex flex-col overflow-hidden border border-[#bfd7ee] dark:border-[#25427b] shadow-xs">
            <div className="bg-blue-100 dark:bg-[#1a3263] px-5 py-3 border-b border-[#bfd7ee] dark:border-[#25427b] flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Calendar size={16} className="text-blue-700 dark:text-blue-300" />
                Tỷ lệ tăng trưởng theo các mốc thời gian
              </span>
              <span className="text-xs text-blue-700 dark:text-blue-300">5 kỳ đo lường</span>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#bfd7ee] dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4 font-bold">Mốc thời gian</th>
                    <th className="py-3 px-4 font-bold text-right">Doanh thu ghi nhận</th>
                    <th className="py-3 px-4 font-bold text-right">Tỷ lệ tăng trưởng</th>
                    <th className="py-3 px-4 font-bold text-left hidden sm:table-cell">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#bfd7ee]/50 dark:divide-white/5">
                  {periods.map((p) => (
                    <tr
                      key={p.period}
                      className="hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        {p.period}
                      </td>
                      <td className="py-3 px-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                        {formatVnNumber(p.revenue)} VNĐ
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs ${
                            p.isTarget
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-xs"
                              : "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-[#bfd7ee] dark:border-blue-800"
                          }`}
                        >
                          <ArrowUpRight size={13} />
                          {p.growth}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-left text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                        {p.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
