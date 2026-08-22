"use client";

import React, { useState } from "react";
import {
  Cpu,
  Store,
  Building2,
  Sparkles,
  CreditCard,
  ShoppingCart,
  Cloud,
  Layers,
  Zap,
  Bot,
  Settings,
  ExternalLink,
  Link as LinkIcon,
  Edit3,
} from "lucide-react";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { MetricIdModal } from "./metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { cardLinkProps, getStoredMetricId } from "@/lib/card-link";

interface B9SectionProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function B9Section({
  dashboard,
  data = {},
  metricLinks,
  metricIds = {},
  onChanged,
  onOpenMetricId,
  onSaveMetricId,
  onSaveQuantity,
}: B9SectionProps) {
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

  // 1. HỘ KINH DOANH CÁ THỂ
  const hkdTong = Number(data["hkd_tong"] ?? 1120);
  const hkdTtSo = Number(data["hkd_tt_so"] ?? 850);
  const hkdEcom = Number(data["hkd_ecom"] ?? 240);
  const pctHkdTtSo = hkdTong > 0 ? ((hkdTtSo / hkdTong) * 100).toFixed(1) : "0.0";
  const pctHkdEcom = hkdTong > 0 ? ((hkdEcom / hkdTong) * 100).toFixed(1) : "0.0";

  // 2. DOANH NGHIỆP VỪA VÀ NHỎ
  const smeTong = Number(data["sme_tong"] ?? 1250);
  const smeCloud = Number(data["sme_cloud"] ?? 620);
  const smeQldn = Number(data["sme_qldn"] ?? 380);
  const pctSmeCloud = smeTong > 0 ? ((smeCloud / smeTong) * 100).toFixed(1) : "0.0";
  const pctSmeQldn = smeTong > 0 ? ((smeQldn / smeTong) * 100).toFixed(1) : "0.0";

  // 3. DN LỚN & TIÊN PHONG AI
  const largeTong = Number(data["large_tong"] ?? 45);
  const largeTuDongHoa = Number(data["large_tu_dong_hoa"] ?? 22);
  const largeAi = Number(data["large_ai"] ?? 15);
  const pctLargeTdh = largeTong > 0 ? ((largeTuDongHoa / largeTong) * 100).toFixed(1) : "0.0";
  const pctLargeAi = largeTong > 0 ? ((largeAi / largeTong) * 100).toFixed(1) : "0.0";

  return (
    <section className="mb-6 w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      {/* Header Khối B9 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_-4px_rgba(6,182,212,0.5)]">
            <Cpu size={22} />
          </span>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
              B9. CĐS DOANH NGHIỆP TOÀN DIỆN - {dashboard.unit?.name ?? "Địa phương"}
            </h3>
            <p className="text-xs text-slate-400">
              Phân loại 3 nhóm: Hộ cá thể · DN Vừa & Nhỏ (SME) · DN Lớn & Tiên phong AI
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowBlockId(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2 text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
          >
            <Settings size={14} /> Thiết lập ID
          </button>
        )}
      </div>

      {/* 3 CỘT TRẢI RỘNG FULL CHIỀU NGANG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ================= 1. HỘ KINH DOANH CÁ THỂ ================= */}
        <div className="flex flex-col justify-between rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl">
          <div>
            {/* Header Nhóm 1 */}
            <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <Store size={16} />
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-amber-400">
                  1. HỘ KINH DOANH CÁ THỂ
                </h4>
              </div>
              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Nhóm Hộ KD
              </span>
            </div>

            <div className="space-y-3.5">
              {/* 1.1 Tổng số hộ */}
              <div
                {...cardLinkProps(metricLinks["b9_hkd_tong"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_hkd_tong"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Store size={15} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Tổng số hộ
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-amber-400 tabular-nums">
                      {hkdTong.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">HỘ</span>

                    {metricLinks["b9_hkd_tong"] && (
                      <a
                        href={metricLinks["b9_hkd_tong"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_hkd_tong", "HKD - Tổng số hộ")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_hkd_tong",
                              field: "hkd_tong",
                              label: "HKD - Tổng số hộ",
                              current: hkdTong,
                              matchTokens: ["tổng số hộ", "hkd_tong"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 1.2 Thanh toán số */}
              <div
                {...cardLinkProps(metricLinks["b9_hkd_tt_so"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_hkd_tt_so"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CreditCard size={15} className="text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Thanh toán số
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-emerald-400 tabular-nums">
                      {hkdTtSo.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">HỘ</span>
                    <span className="text-[11px] font-bold text-emerald-300 font-mono">
                      ({pctHkdTtSo}%)
                    </span>

                    {metricLinks["b9_hkd_tt_so"] && (
                      <a
                        href={metricLinks["b9_hkd_tt_so"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_hkd_tt_so", "HKD - Thanh toán số")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_hkd_tt_so",
                              field: "hkd_tt_so",
                              label: "HKD - Thanh toán số",
                              current: hkdTtSo,
                              matchTokens: ["thanh toán số", "hkd_tt_so"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Number(pctHkdTtSo))}%` }}
                  />
                </div>
              </div>

              {/* 1.3 Bán hàng Ecom */}
              <div
                {...cardLinkProps(metricLinks["b9_hkd_ecom"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_hkd_ecom"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={15} className="text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Bán hàng Ecom
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-cyan-400 tabular-nums">
                      {hkdEcom.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">HỘ</span>
                    <span className="text-[11px] font-bold text-cyan-300 font-mono">
                      ({pctHkdEcom}%)
                    </span>

                    {metricLinks["b9_hkd_ecom"] && (
                      <a
                        href={metricLinks["b9_hkd_ecom"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_hkd_ecom", "HKD - Bán hàng Ecom")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_hkd_ecom",
                              field: "hkd_ecom",
                              label: "HKD - Bán hàng Ecom",
                              current: hkdEcom,
                              matchTokens: ["bán hàng ecom", "hkd_ecom"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Number(pctHkdEcom))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. DOANH NGHIỆP VỪA VÀ NHỎ ================= */}
        <div className="flex flex-col justify-between rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl">
          <div>
            {/* Header Nhóm 2 */}
            <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  <Building2 size={16} />
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-400">
                  2. DOANH NGHIỆP VỪA VÀ NHỎ
                </h4>
              </div>
              <span className="text-[11px] font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                Nhóm SME
              </span>
            </div>

            <div className="space-y-3.5">
              {/* 2.1 Tổng số DN */}
              <div
                {...cardLinkProps(metricLinks["b9_sme_tong"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_sme_tong"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Tổng số DN
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-blue-400 tabular-nums">
                      {smeTong.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">DN</span>

                    {metricLinks["b9_sme_tong"] && (
                      <a
                        href={metricLinks["b9_sme_tong"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_sme_tong", "SME - Tổng số DN")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_sme_tong",
                              field: "sme_tong",
                              label: "SME - Tổng số DN",
                              current: smeTong,
                              matchTokens: ["tổng số dn", "sme_tong"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2.2 Sử dụng Cloud */}
              <div
                {...cardLinkProps(metricLinks["b9_sme_cloud"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_sme_cloud"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cloud size={15} className="text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Sử dụng Cloud
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-indigo-400 tabular-nums">
                      {smeCloud.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">DN</span>
                    <span className="text-[11px] font-bold text-indigo-300 font-mono">
                      ({pctSmeCloud}%)
                    </span>

                    {metricLinks["b9_sme_cloud"] && (
                      <a
                        href={metricLinks["b9_sme_cloud"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_sme_cloud", "SME - Sử dụng Cloud")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_sme_cloud",
                              field: "sme_cloud",
                              label: "SME - Sử dụng Cloud",
                              current: smeCloud,
                              matchTokens: ["sử dụng cloud", "sme_cloud"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Number(pctSmeCloud))}%` }}
                  />
                </div>
              </div>

              {/* 2.3 Hệ thống QLDN (ERP/CRM) */}
              <div
                {...cardLinkProps(metricLinks["b9_sme_qldn"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_sme_qldn"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-teal-400" />
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                        Hệ thống QLDN
                      </span>
                      <span className="hidden sm:inline-block ml-1 text-[10px] text-slate-400">
                        (ERP/CRM)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-teal-400 tabular-nums">
                      {smeQldn.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">DN</span>
                    <span className="text-[11px] font-bold text-teal-300 font-mono">
                      ({pctSmeQldn}%)
                    </span>

                    {metricLinks["b9_sme_qldn"] && (
                      <a
                        href={metricLinks["b9_sme_qldn"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_sme_qldn", "SME - Hệ thống QLDN")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_sme_qldn",
                              field: "sme_qldn",
                              label: "SME - Hệ thống QLDN",
                              current: smeQldn,
                              matchTokens: ["hệ thống qldn", "sme_qldn"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Number(pctSmeQldn))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. DN LỚN & TIÊN PHONG AI ================= */}
        <div className="flex flex-col justify-between rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl">
          <div>
            {/* Header Nhóm 3 */}
            <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
                  <Sparkles size={16} />
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-purple-400">
                  3. DN LỚN & TIÊN PHONG AI
                </h4>
              </div>
              <span className="text-[11px] font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                Nhóm Đột phá
              </span>
            </div>

            <div className="space-y-3.5">
              {/* 3.1 Doanh nghiệp lớn */}
              <div
                {...cardLinkProps(metricLinks["b9_large_tong"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_large_tong"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-purple-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Doanh nghiệp lớn
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-purple-400 tabular-nums">
                      {largeTong.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">DN</span>

                    {metricLinks["b9_large_tong"] && (
                      <a
                        href={metricLinks["b9_large_tong"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_large_tong", "DN Lớn")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_large_tong",
                              field: "large_tong",
                              label: "DN Lớn",
                              current: largeTong,
                              matchTokens: ["doanh nghiệp lớn", "large_tong"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3.2 Tự động hóa */}
              <div
                {...cardLinkProps(metricLinks["b9_large_tu_dong_hoa"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_large_tu_dong_hoa"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Zap size={15} className="text-pink-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Tự động hóa
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-pink-400 tabular-nums">
                      {largeTuDongHoa.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">DN</span>
                    <span className="text-[11px] font-bold text-pink-300 font-mono">
                      ({pctLargeTdh}%)
                    </span>

                    {metricLinks["b9_large_tu_dong_hoa"] && (
                      <a
                        href={metricLinks["b9_large_tu_dong_hoa"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_large_tu_dong_hoa", "DN Lớn - Tự động hóa")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_large_tu_dong_hoa",
                              field: "large_tu_dong_hoa",
                              label: "DN Lớn - Tự động hóa",
                              current: largeTuDongHoa,
                              matchTokens: ["tự động hóa", "large_tu_dong_hoa"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Number(pctLargeTdh))}%` }}
                  />
                </div>
              </div>

              {/* 3.3 Ứng dụng AI */}
              <div
                {...cardLinkProps(metricLinks["b9_large_ai"])}
                className={`rounded-xl border border-white/5 bg-[#061121]/70 p-3.5 transition hover:border-white/10${metricLinks["b9_large_ai"] ? " cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot size={15} className="text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Ứng dụng AI
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-cyan-400 tabular-nums">
                      {largeAi.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">DN</span>
                    <span className="text-[11px] font-bold text-cyan-300 font-mono">
                      ({pctLargeAi}%)
                    </span>

                    {metricLinks["b9_large_ai"] && (
                      <a
                        href={metricLinks["b9_large_ai"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                        title="Xem link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenId("b9_large_ai", "DN Lớn - Ứng dụng AI")}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQtyTarget({
                              key: "b9_large_ai",
                              field: "large_ai",
                              label: "DN Lớn - Ứng dụng AI",
                              current: largeAi,
                              matchTokens: ["ứng dụng ai", "large_ai"],
                            })
                          }
                          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-1 text-cyan-400 transition hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Number(pctLargeAi))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER: TỔNG QUAN TỶ LỆ CĐS DOANH NGHIỆP */}
      <div className="mt-5 rounded-2xl border border-white/5 bg-[#0c1830]/90 p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-bold uppercase tracking-wide text-slate-300">
            TỔNG QUAN TỶ LỆ ÁP DỤNG CÔNG NGHỆ & CĐS DOANH NGHIỆP:
          </span>
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold">
            <span className="text-amber-400">HKD TT Số: {pctHkdTtSo}%</span>
            <span className="text-blue-400">SME Cloud: {pctSmeCloud}%</span>
            <span className="text-pink-400">DN Tự động hóa: {pctLargeTdh}%</span>
            <span className="text-cyan-400">Ứng dụng AI: {pctLargeAi}%</span>
          </div>
        </div>
      </div>

      {/* Modal Block ID (Bảo toàn kiểu dữ liệu an toàn) */}
      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="B9"
          currentId={
            (dashboard as any).b9_custom_id ??
            (dashboard as any)?.metadata?.b9_custom_id ??
            ""
          }
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {/* Modal chỉnh sửa số lượng */}
      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B9"
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

      {/* Modal thiết lập Metric ID */}
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
    </section>
  );
}

export default B9Section;