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
  className?: string;
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
  className,
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
    <section className={`w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden dark:rounded-xl dark:border-x-2 dark:border-b-2 dark:border-[#1d293d] dark:border-t-0 dark:bg-[#0a1124]/90 dark:shadow-2xl dark:backdrop-blur-xl ${className || "mb-6"}`}>
      {/* Header Khối B1 */}
      <div className="bg-[#0047db] dark:bg-[#0047db] text-white px-5 py-4 flex justify-between items-center transition-colors">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 text-white">
            <Building2 size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wide text-white sm:text-lg">
              B1: Đơn vị kinh doanh
            </h3>
            <p className="text-xs text-blue-100">
              Doanh nghiệp SME · Hộ kinh doanh · Hợp tác xã
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowBlockId(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium border border-white/20 transition-colors"
          >
            <Settings size={14} /> Thiết lập ID
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-6">
        {/* CỤM TRÊN: 2 KHỐI SỐ LIỆU */}
        <div className="w-full space-y-5">
          {/* Cụm 1: Tổng số */}
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border dark:border-[#1d335d] dark:bg-[#0a1830] dark:shadow-xl sm:p-5">
            <BannerTag1 {...bannerProps1} className="block">
              <div
                style={{ backgroundColor: '#cbecff' }}
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 px-4 py-3 shadow-xs border-l-4 border-l-blue-600"
              >
                <span className="text-sm font-bold uppercase tracking-wide text-slate-800 sm:text-base">
                  TỔNG SỐ DOANH NGHIỆP / HKD / HTX:
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-blue-700 tabular-nums sm:text-3xl">
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
                        className="rounded-xl border border-blue-300 bg-white/80 p-2 text-blue-700 transition hover:bg-white"
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
                        className="rounded-xl border border-blue-300 bg-white/80 p-2 text-slate-700 transition hover:bg-white"
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
                accentBorder="border-l-blue-500"
                iconBg="bg-blue-50 text-blue-600"
                icon={Building2}
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
                accentBorder="border-l-blue-500"
                iconBg="bg-blue-50 text-blue-600"
                icon={Building2}
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
                accentBorder="border-l-blue-500"
                iconBg="bg-blue-50 text-blue-600"
                icon={Building2}
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
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border dark:border-[#1d335d] dark:bg-[#0a1830] dark:shadow-xl sm:p-5">
            <BannerTag2 {...bannerProps2} className="block">
              <div
                style={{ backgroundColor: '#c8eee1' }}
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 px-4 py-3 shadow-xs border-l-4 border-l-emerald-600"
              >
                <span className="text-sm font-bold uppercase tracking-wide text-slate-800 sm:text-base">
                  TỔNG SỐ DOANH NGHIỆP / HKD / HTX CĐS:
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-emerald-700 tabular-nums sm:text-3xl">
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
                        className="rounded-xl border border-emerald-300 bg-white/80 p-2 text-emerald-700 transition hover:bg-white"
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
                        className="rounded-xl border border-emerald-300 bg-white/80 p-2 text-slate-700 transition hover:bg-white"
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
                accentBorder="border-l-emerald-500"
                iconBg="bg-emerald-50 text-emerald-600"
                icon={TrendingUp}
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
                accentBorder="border-l-emerald-500"
                iconBg="bg-emerald-50 text-emerald-600"
                icon={TrendingUp}
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
                accentBorder="border-l-emerald-500"
                iconBg="bg-emerald-50 text-emerald-600"
                icon={TrendingUp}
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

        {/* CỤM DƯỚI: BIỂU ĐỒ CỘT TỶ LỆ CHUYỂN ĐỔI SỐ (GROUPED BAR CHART) */}
        <div className="w-full min-h-[250px] rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:border dark:border-[#1d335d] dark:shadow-none flex flex-col justify-between">
          {/* Header của thẻ con */}
          <div className="bg-blue-50 dark:bg-[#162b54] border-b border-blue-100 dark:border-[#25427b] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                BIỂU ĐỒ TỶ LỆ CHUYỂN ĐỔI SỐ
              </h4>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full dark:text-blue-400 dark:bg-[#0f1f3a] dark:border-[#1d335d]">
              <TrendingUp size={12} />
              <span>Toàn tỉnh: {dxPercent}%</span>
            </div>
          </div>

          {/* Phần Nội dung (Biểu đồ) */}
          <div className="bg-white dark:bg-[#0a1830] p-5 flex-1 flex flex-col justify-between">
            <div>
              {/* Chú thích cột */}
              <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <span className="h-2.5 w-2.5 rounded-xs bg-blue-500" /> Tổng đơn vị
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-blue-300">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 dark:bg-blue-400" /> Đã CĐS
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
                        <span className="mb-2 text-[10px] sm:text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:text-blue-300 dark:bg-[#162b54] dark:border-[#25427b]">
                          {g.rate}%
                        </span>

                        {/* Cột đôi: [Tổng số] & [Đã CĐS] */}
                        <div className="w-full flex items-end justify-center gap-1.5 h-[115px] bg-white rounded-t-xl p-1 border-b border-slate-200 shadow-xs dark:bg-[#0f1f3a] dark:border-[#1d335d] dark:shadow-none">
                          {/* Cột Tổng số */}
                          <div
                            className="w-1/2 max-w-[24px] rounded-t-xl bg-gradient-to-t from-blue-700 to-blue-400 shadow-md transition-all duration-700 relative group-hover:brightness-125 flex flex-col justify-start items-center"
                            style={{ height: `${totalH}%` }}
                            title={`Tổng: ${g.total.toLocaleString("vi-VN")}`}
                          >
                            <span className="text-[9px] font-mono text-white font-bold mt-0.5 hidden sm:block">
                              {g.total > 999 ? `${(g.total / 1000).toFixed(1)}k` : g.total}
                            </span>
                          </div>

                          {/* Cột Đã CĐS */}
                          <div
                            className="w-1/2 max-w-[24px] rounded-t-xl bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md transition-all duration-700 relative group-hover:brightness-125 flex flex-col justify-start items-center"
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
                          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                            {g.label}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
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
            <div className="mt-3 space-y-1.5 pt-3 border-t border-slate-200 dark:border-[#1d335d]">
              <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300">
                <span>Tiến độ CĐS: <strong className="text-emerald-600 dark:text-blue-400">{totalDx}</strong> / {totalUnits} ĐV</span>
                <span className="font-bold text-emerald-600 dark:text-blue-400">{dxPercent}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 border border-slate-300 dark:bg-[#0f1f3a] dark:border-[#1d335d]">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 dark:from-blue-600 dark:to-blue-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, Number(dxPercent))}%` }}
                />
              </div>
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