"use client";

import React, { useState } from "react";
import { Package, PieChart, Settings, Link as LinkIcon, Edit3 } from "lucide-react";
import { StatCell } from "./stat-cell";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { MetricIdModal } from "./metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { getStoredMetricId } from "@/lib/card-link";

interface B2SectionProps {
  dashboard: DashboardRow;
  b2: KpiRow;
  metricLinks: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged: () => void;
  onOpenQtyModal?: (key: string) => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
}

const num = (kpi: KpiRow, key: string): number => Number(kpi[key] ?? 0);

export function B2Section({
  dashboard,
  b2,
  metricLinks,
  metricIds = {},
  onChanged,
  onOpenQtyModal,
  onOpenMetricId,
  onSaveMetricId,
}: B2SectionProps) {
  const { isAdmin } = useAuth();
  const [showBlockId, setShowBlockId] = useState(false);
  const [quantityState, setQuantityState] = useState<{
    field: string;
    label: string;
    current: number;
    matchTokens: string[];
  } | null>(null);
  const [metricIdState, setMetricIdState] = useState<{
    metricKey: string;
    label: string;
    metricId: string;
  } | null>(null);

  const ocop3 = num(b2, "ocop_3star");
  const ocop4 = num(b2, "ocop_4star");
  const ocop5 = num(b2, "ocop_5star");
  const spThuong = num(b2, "sp_thuong");
  const dichVu = num(b2, "dich_vu");

  const ocopTotal = ocop3 + ocop4 + ocop5;
  const otherTotal = spThuong + dichVu;
  const totalAll = ocopTotal + otherTotal;

  const handleOpenMetricId = (key: string, label: string): void => {
    if (onOpenMetricId) {
      onOpenMetricId(key, label);
      return;
    }
    const existingId = getStoredMetricId(metricIds, key, metricLinks[key]);
    setMetricIdState({ metricKey: key, label, metricId: existingId });
  };

  const baseDomain = (
    dashboard?.base_domain ||
    dashboard?.metadata?.base_domain ||
    dashboard?.domain_link ||
    ""
  ).trim().replace(/\/+$/, "");

  const banner1Link = metricLinks["b2_total_ocop"] || "";
  const banner2Link = metricLinks["b2_total_normal_service"] || "";
  const BannerTag1: "a" | "div" = banner1Link ? "a" : "div";
  const BannerTag2: "a" | "div" = banner2Link ? "a" : "div";
  const bannerProps1 = banner1Link ? { href: banner1Link, target: "_blank", rel: "noopener noreferrer" } : {};
  const bannerProps2 = banner2Link ? { href: banner2Link, target: "_blank", rel: "noopener noreferrer" } : {};

  // DỮ LIỆU TÍNH TOÁN BIỂU ĐỒ TRÒN (DONUT / PIE CHART)
  const segments = [
    { name: "OCOP 3★", value: ocop3, color: "#f59e0b" },
    { name: "OCOP 4★", value: ocop4, color: "#fb923c" },
    { name: "OCOP 5★", value: ocop5, color: "#eab308" },
    { name: "SP Thường", value: spThuong, color: "#3b82f6" },
    { name: "Dịch Vụ", value: dichVu, color: "#a855f7" },
  ];

  const radius = 62;
  const circumference = 2 * Math.PI * radius; // ≈ 389.55
  let accumulatedPercent = 0;

  return (
    <section className="mb-6 w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden dark:rounded-xl dark:border-x-2 dark:border-b-2 dark:border-[#1d293d] dark:border-t-0 dark:bg-[#0a1124]/90 dark:shadow-2xl dark:backdrop-blur-xl">
      {/* Header Khối B2 */}
      <div className="bg-[#0047db] dark:bg-[#0047db] text-white px-5 py-4 flex justify-between items-center transition-colors">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 text-white">
            <Package size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wide text-white sm:text-lg">
              B2: Thông tin sản phẩm trên địa bàn - {dashboard.unit?.name ?? "Địa phương"}
            </h3>
            <p className="text-xs text-blue-100">
              Sản phẩm OCOP · Sản phẩm thường · Dịch vụ
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowBlockId(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-white/20"
          >
            <Settings size={14} /> Thiết lập ID
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-6">
        {/* CỤM TRÊN: 2 KHỐI SỐ LIỆU */}
        <div className="w-full space-y-5">
          {/* Cụm 1: OCOP */}
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border dark:border-[#1d335d] dark:bg-[#0a1830] dark:shadow-xl sm:p-5">
            <BannerTag1 {...bannerProps1} className="block">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs border-l-4 border-l-amber-500 dark:bg-[#162b54] dark:border-[#25427b] dark:border-l-4 dark:border-l-[#3b82f6]">
                <span className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 sm:text-base">
                  TỔNG SỐ SẢN PHẨM OCOP:
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-amber-600 dark:text-blue-400 tabular-nums sm:text-3xl">
                    {ocopTotal.toLocaleString("vi-VN")}
                  </span>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenMetricId("b2_total_ocop", "Tổng sản phẩm OCOP");
                        }}
                        className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-600 transition hover:bg-amber-100 dark:border-[#25427b] dark:bg-[#0f1f3a] dark:text-blue-400 dark:hover:bg-[#1d335d]"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onOpenQtyModal) onOpenQtyModal("b2_ocop_3");
                          else
                            setQuantityState({
                              field: "ocop_3star",
                              label: "OCOP 3 sao",
                              current: ocop3,
                              matchTokens: ["ocop 3 sao", "ocop_3star"],
                            });
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-[#25427b] dark:bg-[#0f1f3a] dark:text-blue-400 dark:hover:bg-[#1d335d]"
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
                label="OCOP 3 SAO"
                value={ocop3}
                unit="SP"
                color="#f59e0b"
                accentBorder="border-l-amber-500"
                iconBg="bg-amber-50 text-amber-600"
                icon={Package}
                targetUrl={metricLinks["b2_ocop_3"]}
                onEditLink={() => handleOpenMetricId("b2_ocop_3", "OCOP 3 sao")}
                onEditQuantity={() =>
                  setQuantityState({
                    field: "ocop_3star",
                    label: "OCOP 3 sao",
                    current: ocop3,
                    matchTokens: ["ocop 3 sao", "ocop_3star"],
                  })
                }
              />
              <StatCell
                label="OCOP 4 SAO"
                value={ocop4}
                unit="SP"
                color="#fb923c"
                accentBorder="border-l-amber-500"
                iconBg="bg-amber-50 text-amber-600"
                icon={Package}
                targetUrl={metricLinks["b2_ocop_4"]}
                onEditLink={() => handleOpenMetricId("b2_ocop_4", "OCOP 4 sao")}
                onEditQuantity={() =>
                  setQuantityState({
                    field: "ocop_4star",
                    label: "OCOP 4 sao",
                    current: ocop4,
                    matchTokens: ["ocop 4 sao", "ocop_4star"],
                  })
                }
              />
              <StatCell
                label="OCOP 5 SAO"
                value={ocop5}
                unit="SP"
                color="#eab308"
                accentBorder="border-l-amber-500"
                iconBg="bg-amber-50 text-amber-600"
                icon={Package}
                targetUrl={metricLinks["b2_ocop_5"]}
                onEditLink={() => handleOpenMetricId("b2_ocop_5", "OCOP 5 sao")}
                onEditQuantity={() =>
                  setQuantityState({
                    field: "ocop_5star",
                    label: "OCOP 5 sao",
                    current: ocop5,
                    matchTokens: ["ocop 5 sao", "ocop_5star"],
                  })
                }
              />
            </div>
          </div>

          {/* Cụm 2: SP Thường & Dịch vụ */}
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border dark:border-[#1d335d] dark:bg-[#0a1830] dark:shadow-xl sm:p-5">
            <BannerTag2 {...bannerProps2} className="block">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs border-l-4 border-l-purple-500 dark:bg-[#162b54] dark:border-[#25427b] dark:border-l-4 dark:border-l-[#3b82f6]">
                <span className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 sm:text-base">
                  TỔNG SỐ SP THƯỜNG & DỊCH VỤ:
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-purple-600 dark:text-blue-400 tabular-nums sm:text-3xl">
                    {otherTotal.toLocaleString("vi-VN")}
                  </span>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenMetricId(
                            "b2_total_normal_service",
                            "Sản phẩm thường & Dịch vụ"
                          );
                        }}
                        className="rounded-xl border border-purple-200 bg-purple-50 p-2 text-purple-600 transition hover:bg-purple-100 dark:border-[#25427b] dark:bg-[#0f1f3a] dark:text-blue-400 dark:hover:bg-[#1d335d]"
                        title="Thiết lập ID"
                      >
                        <LinkIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setQuantityState({
                            field: "sp_thuong",
                            label: "Sản phẩm thường",
                            current: spThuong,
                            matchTokens: ["sản phẩm thường", "sp thường"],
                          });
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-[#25427b] dark:bg-[#0f1f3a] dark:text-blue-400 dark:hover:bg-[#1d335d]"
                        title="Setup Số lượng"
                      >
                        <Edit3 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </BannerTag2>

            <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-3">
              <StatCell
                label="SẢN PHẨM THƯỜNG"
                value={spThuong}
                unit="SP"
                color="#3b82f6"
                accentBorder="border-l-purple-500"
                iconBg="bg-purple-50 text-purple-600"
                icon={Package}
                targetUrl={metricLinks["b2_sp_thuong"]}
                onEditLink={() => handleOpenMetricId("b2_sp_thuong", "Sản phẩm thường")}
                onEditQuantity={() =>
                  setQuantityState({
                    field: "sp_thuong",
                    label: "Sản phẩm thường",
                    current: spThuong,
                    matchTokens: ["sản phẩm thường", "sp thường"],
                  })
                }
              />
              <StatCell
                label="TỔNG SỐ DỊCH VỤ"
                value={dichVu}
                unit="DV"
                color="#a855f7"
                accentBorder="border-l-purple-500"
                iconBg="bg-purple-50 text-purple-600"
                icon={Package}
                targetUrl={metricLinks["b2_dich_vu"]}
                onEditLink={() => handleOpenMetricId("b2_dich_vu", "Dịch vụ")}
                onEditQuantity={() =>
                  setQuantityState({
                    field: "dich_vu",
                    label: "Dịch vụ",
                    current: dichVu,
                    matchTokens: ["dịch vụ", "dv"],
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* CỤM DƯỚI: BIỂU ĐỒ TRÒN PHÂN BỔ SẢN PHẨM (DONUT / PIE CHART) */}
        <div className="w-full min-h-[250px] rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:border dark:border-[#1d335d] dark:shadow-none flex flex-col justify-between">
          {/* Header của thẻ con */}
          <div className="bg-blue-50 dark:bg-[#162b54] border-b border-blue-100 dark:border-[#25427b] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart size={16} className="text-amber-500 dark:text-blue-400" />
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                BIỂU ĐỒ TỶ LỆ CÁC LOẠI SẢN PHẨM
              </h4>
            </div>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:text-blue-400 dark:bg-[#0f1f3a] dark:border-[#1d335d]">
              Tổng: {totalAll.toLocaleString("vi-VN")}
            </span>
          </div>

          {/* Phần Nội dung (Biểu đồ tròn) */}
          <div className="bg-white dark:bg-[#0a1830] p-5 flex-1 flex flex-col justify-between">
            <div className="relative flex justify-center items-center py-3">
              <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
                <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                  {/* Vòng tròn nền */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="#e2e8f0"
                    className="dark:stroke-[#162b54]"
                    strokeWidth="22"
                  />

                  {/* 5 Khúc phân đoạn của biểu đồ tròn */}
                  {totalAll > 0 &&
                    segments.map((seg) => {
                      const share = seg.value / totalAll;
                      const strokeDasharray = `${share * circumference} ${circumference}`;
                      const strokeDashoffset = -accumulatedPercent * circumference;
                      accumulatedPercent += share;

                      return (
                        <circle
                          key={seg.name}
                          cx="80"
                          cy="80"
                          r={radius}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="22"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-700 hover:opacity-80"
                        />
                      );
                    })}
                </svg>

                {/* Nhãn con số ở giữa biểu đồ tròn */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-blue-400 tabular-nums">
                    {totalAll.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    Sản phẩm & DV
                  </span>
                </div>
              </div>
            </div>

            {/* CHÚ THÍCH PHÂN BỔ 5 LOẠI Ở DƯỚI CÙNG */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#1d335d]">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {segments.map((seg) => {
                  const percentage = totalAll > 0 ? ((seg.value / totalAll) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={seg.name} className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs dark:bg-[#0f1f3a] dark:border-[#1d335d] dark:shadow-none">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <div className="truncate">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{seg.name}: </span>
                        <strong style={{ color: seg.color }}>{percentage}%</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="B2"
          currentId={(dashboard as any).b2_custom_id ?? (dashboard as any)?.metadata?.b2_custom_id ?? ""}
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {quantityState && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B2"
          field={quantityState.field}
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
          currentId={metricIdState.metricId}
          initialId={metricIdState.metricId}
          onClose={() => setMetricIdState(null)}
          onSave={async (key: string, id: string) => {
            if (onSaveMetricId) await onSaveMetricId(key, id);
            onChanged();
          }}
          onSaved={onChanged}
        />
      )}
    </section>
  );
}

export default B2Section;