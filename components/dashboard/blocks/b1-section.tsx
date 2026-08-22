"use client";

import React, { useState } from "react";
import { Building2, Settings, Link as LinkIcon, Edit3, BarChart3, TrendingUp } from "lucide-react";
import { StatCell } from "./stat-cell";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { MetricIdModal } from "./metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { getStoredMetricId } from "@/lib/card-link";

interface B1SectionProps {
  dashboard: DashboardRow;
  b1: KpiRow;
  metricLinks: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged: () => void;
  onOpenLinkModal?: (key: string) => void;
  onOpenQtyModal?: (key: string) => void;
  onOpenSetupId?: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
}

const num = (kpi: KpiRow, key: string): number => Number(kpi[key] ?? 0);

export function B1Section({
  dashboard,
  b1,
  metricLinks,
  metricIds = {},
  onChanged,
  onOpenQtyModal,
  onOpenMetricId,
  onSaveMetricId,
}: B1SectionProps) {
  const { isAdmin } = useAuth();
  const [showBlockId, setShowBlockId] = useState(false);
  const [quantityState, setQuantityState] = useState<{
    field: string;
    fields?: string[];
    label: string;
    current: number;
    matchTokens: string[];
  } | null>(null);
  const [metricIdState, setMetricIdState] = useState<{
    metricKey: string;
    label: string;
    metricId: string;
  } | null>(null);

  const smeTotal = num(b1, "sme_total");
  const hkdTotal = num(b1, "hkd_total");
  const htxTotal = num(b1, "htx_total");
  const totalUnits = smeTotal + hkdTotal + htxTotal;

  const smeDx = num(b1, "sme_dx") || num(b1, "sme_cds");
  const hkdDx = num(b1, "hkd_dx") || num(b1, "hkd_cds");
  const htxDx = num(b1, "htx_dx") || num(b1, "htx_cds");
  const totalDx = smeDx + hkdDx + htxDx;

  const dxPercent = totalUnits > 0 ? ((totalDx / totalUnits) * 100).toFixed(1) : "0.0";

  const handleOpenMetricId = (key: string, label: string): void => {
    if (onOpenMetricId) {
      onOpenMetricId(key, label);
      return;
    }
    // 👉 Tự động lấy ID từ metricIds hoặc tách từ link hiện có
    const rawUrl = metricLinks[key] || "";
    const extractedId = rawUrl.split("/").filter(Boolean).pop() || "";
    const existingId = metricIds[key] || extractedId || "";
    
    setMetricIdState({ metricKey: key, label, metricId: existingId });
  };

  const baseDomain = (
    dashboard?.base_domain ||
    dashboard?.metadata?.base_domain ||
    dashboard?.domain_link ||
    ""
  ).trim().replace(/\/+$/, "");

  const banner1Link = metricLinks["b1_total_units"] || "";
  const banner2Link = metricLinks["b1_total_dx"] || "";
  const BannerTag1: "a" | "div" = banner1Link ? "a" : "div";
  const BannerTag2: "a" | "div" = banner2Link ? "a" : "div";
  const bannerProps1 = banner1Link ? { href: banner1Link, target: "_blank", rel: "noopener noreferrer" } : {};
  const bannerProps2 = banner2Link ? { href: banner2Link, target: "_blank", rel: "noopener noreferrer" } : {};

  // DỮ LIỆU VẼ BIỂU ĐỒ CỘT ĐỐI CHIẾU 3 NHÓM
  const maxVal = Math.max(smeTotal, hkdTotal, htxTotal, 1);
  const barGroups = [
    {
      label: "DN SME",
      total: smeTotal,
      dx: smeDx,
      rate: smeTotal > 0 ? ((smeDx / smeTotal) * 100).toFixed(1) : "0.0",
      totalColor: "from-blue-600 to-blue-400",
      dxColor: "from-cyan-500 to-teal-400",
    },
    {
      label: "HỘ KINH DOANH",
      total: hkdTotal,
      dx: hkdDx,
      rate: hkdTotal > 0 ? ((hkdDx / hkdTotal) * 100).toFixed(1) : "0.0",
      totalColor: "from-indigo-600 to-indigo-400",
      dxColor: "from-emerald-500 to-green-400",
    },
    {
      label: "HỢP TÁC XÃ",
      total: htxTotal,
      dx: htxDx,
      rate: htxTotal > 0 ? ((htxDx / htxTotal) * 100).toFixed(1) : "0.0",
      totalColor: "from-purple-600 to-purple-400",
      dxColor: "from-pink-500 to-rose-400",
    },
  ];

  return (
    <section className="mb-6 w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      {/* Header Khối B1 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_-4px_rgba(6,182,212,0.5)]">
            <Building2 size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
              B1: Đơn vị kinh doanh trên địa bàn - {dashboard.unit?.name ?? "Địa phương"}
            </h3>
            <p className="text-xs text-slate-400">
              Doanh nghiệp SME · Hộ kinh doanh · Hợp tác xã
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

      {/* GRID 5 CỘT: CỤM TRÁI 60% (3/5) - BIỂU ĐỒ CỘT PHẢI 40% (2/5) */}
      <div className="grid w-full grid-cols-1 lg:grid-cols-5 gap-5">
        {/* CỤM TRÁI (60%): 2 KHỐI SỐ LIỆU */}
        <div className="w-full space-y-5 lg:col-span-3">
          {/* Cụm 1: Tổng số */}
          <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 shadow-xl sm:p-5">
            <BannerTag1 {...bannerProps1} className="block">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 px-4 py-3">
                <span className="text-sm font-bold uppercase tracking-wide text-slate-300 sm:text-base">
                  TỔNG SỐ DOANH NGHIỆP / HKD / HTX:
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-blue-400 tabular-nums sm:text-3xl">
                    {totalUnits.toLocaleString("vi-VN")}
                  </span>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenMetricId("b1_total_units", "Tổng số ĐV kinh doanh");
                        }}
                        className="rounded-lg border border-blue-500 bg-blue-500/10 p-2 text-blue-400 transition hover:bg-blue-500/20"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onOpenQtyModal) onOpenQtyModal("b1_sme_total");
                          else
                            setQuantityState({
                              field: "sme_total",
                              label: "Tổng số Doanh nghiệp SME",
                              current: smeTotal,
                              matchTokens: ["sme", "doanh nghiệp"],
                            });
                        }}
                        className="rounded-lg border border-cyan-500 bg-cyan-500/10 p-2 text-cyan-400 transition hover:bg-cyan-500/20"
                        title="Setup Số lượng"
                      >
                        <Edit3 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </BannerTag1>

            <div className="grid w-full grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCell
                label="DOANH NGHIỆP SME"
                value={smeTotal}
                unit="DN"
                color="#3b82f6"
                targetUrl={metricLinks["b1_sme_total"]}
                onEditLink={() => handleOpenMetricId("b1_sme_total", "Tổng DN SME")}
                onEditQuantity={() => {
                  if (onOpenQtyModal) onOpenQtyModal("b1_sme_total");
                  else
                    setQuantityState({
                      field: "sme_total",
                      label: "Tổng DN SME",
                      current: smeTotal,
                      matchTokens: ["sme", "doanh nghiệp"],
                    });
                }}
              />
              <StatCell
                label="HỘ KINH DOANH"
                value={hkdTotal}
                unit="HỘ"
                color="#10b981"
                targetUrl={metricLinks["b1_hkd_total"]}
                onEditLink={() => handleOpenMetricId("b1_hkd_total", "Tổng Hộ KD")}
                onEditQuantity={() => {
                  if (onOpenQtyModal) onOpenQtyModal("b1_hkd_total");
                  else
                    setQuantityState({
                      field: "hkd_total",
                      label: "Tổng Hộ KD",
                      current: hkdTotal,
                      matchTokens: ["hkd", "hộ kinh doanh"],
                    });
                }}
              />
              <StatCell
                label="HỢP TÁC XÃ"
                value={htxTotal}
                unit="HTX"
                color="#a855f7"
                targetUrl={metricLinks["b1_htx_total"]}
                onEditLink={() => handleOpenMetricId("b1_htx_total", "Tổng Hợp tác xã")}
                onEditQuantity={() => {
                  if (onOpenQtyModal) onOpenQtyModal("b1_htx_total");
                  else
                    setQuantityState({
                      field: "htx_total",
                      label: "Tổng Hợp tác xã",
                      current: htxTotal,
                      matchTokens: ["htx", "hợp tác xã"],
                    });
                }}
              />
            </div>
          </div>

          {/* Cụm 2: Đã CĐS */}
          <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 shadow-xl sm:p-5">
            <BannerTag2 {...bannerProps2} className="block">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-4 py-3">
                <span className="text-sm font-bold uppercase tracking-wide text-slate-300 sm:text-base">
                  TỔNG SỐ DOANH NGHIỆP / HKD / HTX CĐS:
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-emerald-400 tabular-nums sm:text-3xl">
                    {totalDx.toLocaleString("vi-VN")}
                  </span>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenMetricId("b1_total_dx", "Tổng số ĐV CĐS");
                        }}
                        className="rounded-lg border border-emerald-500 bg-emerald-500/10 p-2 text-emerald-400 transition hover:bg-emerald-500/20"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onOpenQtyModal) onOpenQtyModal("b1_sme_dx");
                          else
                            setQuantityState({
                              field: "sme_dx",
                              fields: ["sme_dx", "sme_cds"],
                              label: "Doanh nghiệp SME CĐS",
                              current: smeDx,
                              matchTokens: ["sme cds", "sme cđs"],
                            });
                        }}
                        className="rounded-lg border border-cyan-500 bg-cyan-500/10 p-2 text-cyan-400 transition hover:bg-cyan-500/20"
                        title="Setup Số lượng"
                      >
                        <Edit3 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </BannerTag2>

            <div className="grid w-full grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCell
                label="DOANH NGHIỆP SME CĐS"
                value={smeDx}
                unit="DN"
                color="#3b82f6"
                targetUrl={metricLinks["b1_sme_dx"]}
                onEditLink={() => handleOpenMetricId("b1_sme_dx", "DN SME CĐS")}
                onEditQuantity={() => {
                  if (onOpenQtyModal) onOpenQtyModal("b1_sme_dx");
                  else
                    setQuantityState({
                      field: "sme_dx",
                      fields: ["sme_dx", "sme_cds"],
                      label: "DN SME CĐS",
                      current: smeDx,
                      matchTokens: ["sme cds", "sme cđs"],
                    });
                }}
              />
              <StatCell
                label="HỘ KINH DOANH CĐS"
                value={hkdDx}
                unit="HỘ"
                color="#10b981"
                targetUrl={metricLinks["b1_hkd_dx"]}
                onEditLink={() => handleOpenMetricId("b1_hkd_dx", "Hộ KD CĐS")}
                onEditQuantity={() => {
                  if (onOpenQtyModal) onOpenQtyModal("b1_hkd_dx");
                  else
                    setQuantityState({
                      field: "hkd_dx",
                      fields: ["hkd_dx", "hkd_cds"],
                      label: "Hộ KD CĐS",
                      current: hkdDx,
                      matchTokens: ["hkd cds", "hkd cđs"],
                    });
                }}
              />
              <StatCell
                label="HỢP TÁC XÃ CĐS"
                value={htxDx}
                unit="HTX"
                color="#a855f7"
                targetUrl={metricLinks["b1_htx_dx"]}
                onEditLink={() => handleOpenMetricId("b1_htx_dx", "Hợp tác xã CĐS")}
                onEditQuantity={() => {
                  if (onOpenQtyModal) onOpenQtyModal("b1_htx_dx");
                  else
                    setQuantityState({
                      field: "htx_dx",
                      fields: ["htx_dx", "htx_cds"],
                      label: "Hợp tác xã CĐS",
                      current: htxDx,
                      matchTokens: ["htx cds", "htx cđs"],
                    });
                }}
              />
            </div>
          </div>
        </div>

        {/* CỤM PHẢI (40%): BIỂU ĐỒ CỘT TỶ LỆ CHUYỂN ĐỔI SỐ (GROUPED BAR CHART) */}
        <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-cyan-400" />
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
                  BIỂU ĐỒ TỶ LỆ CHUYỂN ĐỔI SỐ
                </h4>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <TrendingUp size={12} />
                <span>Toàn tỉnh: {dxPercent}%</span>
              </div>
            </div>

            {/* Chú thích cột */}
            <div className="mt-3 flex items-center justify-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="h-2.5 w-2.5 rounded-xs bg-blue-500" /> Tổng đơn vị
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" /> Đã CĐS
              </span>
            </div>

            {/* VÙNG BIỂU ĐỒ CỘT DỌC ĐỐI CHIẾU (3 NHÓM CỘT ĐÔI) */}
            <div className="mt-4 pt-2">
              <div className="grid grid-cols-3 gap-3 sm:gap-4 items-end h-[160px] px-1">
                {barGroups.map((g) => {
                  const totalH = Math.min(100, Math.max(15, (g.total / maxVal) * 100));
                  const dxH = Math.min(100, Math.max(10, (g.dx / maxVal) * 100));

                  return (
                    <div key={g.label} className="flex flex-col items-center h-full justify-end group">
                      {/* Badge % CĐS trên đỉnh */}
                      <span className="mb-2 text-[10px] sm:text-[11px] font-extrabold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                        {g.rate}%
                      </span>

                      {/* Cột đôi: [Tổng số] & [Đã CĐS] */}
                      <div className="w-full flex items-end justify-center gap-1.5 h-[115px] bg-slate-900/60 rounded-t-xl p-1 border-b border-slate-700/50">
                        {/* Cột Tổng số */}
                        <div
                          className="w-1/2 max-w-[24px] rounded-t-md bg-gradient-to-t from-blue-700 to-blue-400 shadow-md transition-all duration-700 relative group-hover:brightness-125 flex flex-col justify-start items-center"
                          style={{ height: `${totalH}%` }}
                          title={`Tổng: ${g.total.toLocaleString("vi-VN")}`}
                        >
                          <span className="text-[9px] font-mono text-white font-bold mt-0.5 hidden sm:block">
                            {g.total > 999 ? `${(g.total / 1000).toFixed(1)}k` : g.total}
                          </span>
                        </div>

                        {/* Cột Đã CĐS */}
                        <div
                          className="w-1/2 max-w-[24px] rounded-t-md bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md transition-all duration-700 relative group-hover:brightness-125 flex flex-col justify-start items-center"
                          style={{ height: `${dxH}%` }}
                          title={`Đã CĐS: ${g.dx.toLocaleString("vi-VN")}`}
                        >
                          <span className="text-[9px] font-mono text-white font-bold mt-0.5 hidden sm:block">
                            {g.dx > 999 ? `${(g.dx / 1000).toFixed(1)}k` : g.dx}
                          </span>
                        </div>
                      </div>

                      {/* Nhãn chân cột */}
                      <div className="mt-2 text-center w-full">
                        <div className="text-[11px] font-bold text-slate-300 truncate">
                          {g.label}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {g.dx}/{g.total}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Thanh tỷ lệ tổng thể ở dưới cùng */}
          <div className="mt-3 space-y-1.5 pt-3 border-t border-white/5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Tiến độ CĐS: <strong className="text-emerald-400">{totalDx}</strong> / {totalUnits} ĐV</span>
              <span className="font-bold text-emerald-400">{dxPercent}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${Math.min(100, Number(dxPercent))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="B1"
          currentId={(dashboard as any).b1_custom_id ?? (dashboard as any)?.metadata?.b1_custom_id ?? ""}
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {quantityState && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B1"
          field={quantityState.field}
          fields={quantityState.fields}
          label={quantityState.label}
          currentValue={quantityState.current}
          matchTokens={quantityState.matchTokens}
          onClose={() => setQuantityState(null)}
          onSaved={onChanged}
        />
      )}

      {metricIdState && (
        <MetricIdModal
          dashboard={dashboard}
          metricKey={metricIdState.metricKey}
          metricLabel={metricIdState.label}
          label={metricIdState.label}
          baseDomain={baseDomain}
          currentId={metricIds[metricIdState.metricKey] || metricIdState.metricId}
          initialId={metricIds[metricIdState.metricKey] || metricIdState.metricId}
          onClose={() => setMetricIdState(null)}
          onSave={async (key: string, id: string) => {
            if (onSaveMetricId) await onSaveMetricId(key, id);
            setMetricIdState(null);
          }}
          onSaved={onChanged}
        />
      )}
    </section>
  );
}

export default B1Section;