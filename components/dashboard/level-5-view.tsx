"use client";

import React, { useState } from "react";
import {
  Store,
  Network,
  Activity,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Settings,
  ExternalLink,
  Link as LinkIcon,
  Edit3,
  CheckCircle2,
  MapPin,
  Percent,
} from "lucide-react";
import { CellQuantityModal } from "./blocks/cell-quantity-modal";
import { BlockIdModal } from "./blocks/block-id-modal";
import { MetricIdModal } from "./blocks/metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { cardLinkProps, getStoredMetricId } from "@/lib/card-link";

interface Level5ViewProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks?: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged?: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function Level5View({
  dashboard,
  data = {},
  metricLinks = {},
  metricIds = {},
  onChanged = () => {},
  onOpenMetricId,
  onSaveMetricId,
  onSaveQuantity,
}: Level5ViewProps) {
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

  // Cột trái (35%)
  const diemBanXanh = Number(data["diem_ban_xanh"] ?? data["l5_diem_ban_xanh"] ?? 0);
  const hubXanh = Number(data["hub_xanh"] ?? data["l5_hub_xanh"] ?? 0);

  // Cột phải (65%) - O2O
  const doPhu = Number(data["do_phu"] ?? data["l5_do_phu"] ?? 0);
  const donHangHub = Number(data["don_hang_hub"] ?? data["l5_don_hang_hub"] ?? 0);
  const doanhThuO2o = Number(data["doanh_thu_o2o"] ?? data["l5_doanh_thu_o2o"] ?? 0);

  return (
    <div className="w-full">
      {/* BỐ CỤC: TRÁI 35% - PHẢI 65% */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full">
        {/* ================= CỘT TRÁI (35%): THẺ 1 & THẺ 2 ================= */}
        <div className="w-full lg:w-[35%] flex flex-col justify-between gap-5">
          {/* THẺ 1: TỔNG ĐIỂM BÁN XANH */}
          <div
            {...cardLinkProps(metricLinks["l5_diem_ban_xanh"])}
            className={`flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e293b] p-5 shadow-sm transition-colors overflow-hidden flex flex-col justify-between${metricLinks["l5_diem_ban_xanh"] ? " cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-700/50 shadow-sm">
                    <Store size={20} />
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-slate-800 dark:text-white">
                      1. TỔNG ĐIỂM BÁN XANH
                    </h4>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                      <CheckCircle2 size={11} /> Đang hoạt động
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {metricLinks["l5_diem_ban_xanh"] && (
                    <a
                      href={metricLinks["l5_diem_ban_xanh"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-50 dark:bg-[#0f172a] text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                      title="Xem link"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenId("l5_diem_ban_xanh", "Tổng Điểm bán Xanh")}
                        className="p-1.5 bg-slate-50 dark:bg-[#0f172a] text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyTarget({
                            key: "l5_diem_ban_xanh",
                            field: "diem_ban_xanh",
                            label: "Tổng Điểm bán Xanh",
                            current: diemBanXanh,
                            matchTokens: ["điểm bán xanh", "diem_ban_xanh"],
                          })
                        }
                        className="p-1.5 bg-slate-50 dark:bg-[#0f172a] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                        title="Setup số lượng"
                      >
                        <Edit3 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Quy mô điểm bán</span>
              <div>
                <span className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                  {diemBanXanh.toLocaleString("vi-VN")}
                </span>
                <span className="ml-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">ĐIỂM</span>
              </div>
            </div>
          </div>

          {/* THẺ 2: HUB XANH (CẤP XÃ/PHƯỜNG) */}
          <div
            {...cardLinkProps(metricLinks["l5_hub_xanh"])}
            className={`flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e293b] p-5 shadow-sm transition-colors overflow-hidden flex flex-col justify-between${metricLinks["l5_hub_xanh"] ? " cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 rounded-xl border border-cyan-200 dark:border-cyan-700/50 shadow-sm">
                    <Network size={20} />
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-slate-800 dark:text-white">
                      2. HUB XANH (XÃ/PHƯỜNG)
                    </h4>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
                      <MapPin size={11} /> Phủ sóng Xã/Phường
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {metricLinks["l5_hub_xanh"] && (
                    <a
                      href={metricLinks["l5_hub_xanh"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-50 dark:bg-[#0f172a] text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                      title="Xem link"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenId("l5_hub_xanh", "Hub Xanh (Cấp Xã/Phường)")}
                        className="p-1.5 bg-slate-50 dark:bg-[#0f172a] text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyTarget({
                            key: "l5_hub_xanh",
                            field: "hub_xanh",
                            label: "Hub Xanh (Cấp Xã/Phường)",
                            current: hubXanh,
                            matchTokens: ["hub xanh", "hub_xanh"],
                          })
                        }
                        className="p-1.5 bg-slate-50 dark:bg-[#0f172a] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                        title="Setup số lượng"
                      >
                        <Edit3 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Đơn vị hành chính</span>
              <div>
                <span className="text-2xl sm:text-3xl font-black tabular-nums text-cyan-600 dark:text-cyan-400">
                  {hubXanh.toLocaleString("vi-VN")}
                </span>
                <span className="ml-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">XÃ</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI (65%): THẺ 3 - HIỆU QUẢ THƯƠNG MẠI O2O ================= */}
        <div className="w-full lg:w-[65%] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e293b] p-5 sm:p-6 shadow-sm transition-colors overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header Thẻ 3 */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/50 pb-3">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-700/50 shadow-sm">
                  <Activity size={20} />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-800 dark:text-white">
                    3. CHỈ SỐ HIỆU QUẢ THƯƠNG MẠI O2O
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mô hình kết nối Online-to-Offline thúc đẩy tiêu thụ & luân chuyển hàng hóa
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/20">
                  Mô hình O2O Hub
                </span>
              </div>
            </div>

            {/* DANH SÁCH 3 TIÊU CHÍ O2O */}
            <div className="space-y-4">
              {/* 3.1 Độ Phủ Mạng Lưới */}
              <div
                {...cardLinkProps(metricLinks["l5_do_phu"])}
                className={`rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-[#0f172a] p-4 shadow-sm transition-colors${metricLinks["l5_do_phu"] ? " cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-white dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 shadow-xs">
                      <Percent size={15} />
                    </span>
                    <div>
                      <h5 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                        Độ Phủ Mạng Lưới
                      </h5>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Tỷ lệ bao phủ điểm bán & hub</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                      {doPhu}%
                    </span>

                    {metricLinks["l5_do_phu"] && (
                      <a
                        href={metricLinks["l5_do_phu"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white dark:bg-[#1e293b] text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("l5_do_phu", "Độ Phủ Mạng Lưới")}
                          className="p-1.5 bg-white dark:bg-[#1e293b] text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "l5_do_phu",
                              field: "do_phu",
                              label: "Độ Phủ Mạng Lưới (%)",
                              current: doPhu,
                              matchTokens: ["độ phủ", "do_phu"],
                            })
                          }
                          className="p-1.5 bg-white dark:bg-[#1e293b] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                          title="Setup số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar độ phủ */}
                <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700 shadow-md"
                    style={{ width: `${Math.min(100, Math.max(0, doPhu))}%` }}
                  />
                </div>
              </div>

              {/* 3.2 Đơn Hàng Xử Lý (Hub) */}
              <div
                {...cardLinkProps(metricLinks["l5_don_hang_hub"])}
                className={`rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-[#0f172a] p-4 shadow-sm transition-colors${metricLinks["l5_don_hang_hub"] ? " cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-white dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 shadow-xs">
                      <ShoppingBag size={15} />
                    </span>
                    <div>
                      <h5 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                        Đơn Hàng Xử Lý (Hub)
                      </h5>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Lưu lượng giao dịch điều phối qua hub</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                      {donHangHub.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">ĐƠN</span>

                    {metricLinks["l5_don_hang_hub"] && (
                      <a
                        href={metricLinks["l5_don_hang_hub"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white dark:bg-[#1e293b] text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("l5_don_hang_hub", "Đơn Hàng Xử Lý (Hub)")}
                          className="p-1.5 bg-white dark:bg-[#1e293b] text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "l5_don_hang_hub",
                              field: "don_hang_hub",
                              label: "Đơn Hàng Xử Lý (Hub)",
                              current: donHangHub,
                              matchTokens: ["đơn hàng hub", "don_hang_hub"],
                            })
                          }
                          className="p-1.5 bg-white dark:bg-[#1e293b] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                          title="Setup số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3.3 Doanh Thu Giao Dịch */}
              <div
                {...cardLinkProps(metricLinks["l5_doanh_thu_o2o"])}
                className={`rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-[#0f172a] p-4 shadow-sm transition-colors${metricLinks["l5_doanh_thu_o2o"] ? " cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-white dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-700/50 shadow-xs">
                      <DollarSign size={15} />
                    </span>
                    <div>
                      <h5 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                        Doanh Thu Giao Dịch
                      </h5>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Tổng giá trị thanh toán luân chuyển</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-black text-pink-600 dark:text-pink-400 tabular-nums">
                      {doanhThuO2o.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">TỶ VNĐ</span>

                    {metricLinks["l5_doanh_thu_o2o"] && (
                      <a
                        href={metricLinks["l5_doanh_thu_o2o"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white dark:bg-[#1e293b] text-slate-600 hover:text-pink-600 dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("l5_doanh_thu_o2o", "Doanh Thu Giao Dịch O2O")}
                          className="p-1.5 bg-white dark:bg-[#1e293b] text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "l5_doanh_thu_o2o",
                              field: "doanh_thu_o2o",
                              label: "Doanh Thu Giao Dịch O2O (Tỷ VNĐ)",
                              current: doanhThuO2o,
                              matchTokens: ["doanh thu o2o", "doanh_thu_o2o"],
                            })
                          }
                          className="p-1.5 bg-white dark:bg-[#1e293b] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
                          title="Setup số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Block ID */}
      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="L5"
          currentId={(dashboard as any).l5_custom_id ?? (dashboard as any)?.metadata?.l5_custom_id ?? ""}
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {/* Modal Chỉnh sửa số lượng */}
      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="L5"
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

export default Level5View;