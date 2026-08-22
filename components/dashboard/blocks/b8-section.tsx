"use client";

import React, { useState } from "react";
import { Lightbulb, Settings, BarChart3, TrendingUp } from "lucide-react";
import { StatCell } from "./stat-cell";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { MetricIdModal } from "./metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { getStoredMetricId } from "@/lib/card-link";

interface B8SectionProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function B8Section({
  dashboard,
  data = {},
  metricLinks,
  metricIds = {},
  onChanged,
  onOpenMetricId,
  onSaveMetricId,
  onSaveQuantity,
}: B8SectionProps) {
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

  const startup = Number(data["startup"] ?? 28);
  const duAnUom = Number(data["du_an_uom"] ?? 14);
  const chuyenGia = Number(data["chuyen_gia"] ?? 35);
  const nhaDauTu = Number(data["nha_dau_tu"] ?? 8);
  const totalB8 = startup + duAnUom + chuyenGia + nhaDauTu;

  // DỮ LIỆU CỘT CHO BIỂU ĐỒ B8
  const maxVal = Math.max(startup, duAnUom, chuyenGia, nhaDauTu, 1);
  const b8Bars = [
    {
      label: "STARTUP",
      unit: "DN",
      value: startup,
      growth: "+20.0%",
      color: "text-amber-400",
      gradient: "from-amber-500 to-yellow-400",
    },
    {
      label: "DỰ ÁN ƯƠM",
      unit: "DỰ ÁN",
      value: duAnUom,
      growth: "+16.7%",
      color: "text-blue-400",
      gradient: "from-blue-600 to-cyan-400",
    },
    {
      label: "CHUYÊN GIA",
      unit: "NGƯỜI",
      value: chuyenGia,
      growth: "+25.0%",
      color: "text-emerald-400",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      label: "NHÀ ĐẦU TƯ",
      unit: "NHÀ ĐT",
      value: nhaDauTu,
      growth: "+14.3%",
      color: "text-purple-400",
      gradient: "from-purple-600 to-pink-400",
    },
  ];

  return (
    <section className="mb-6 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 h-full flex flex-col justify-between">
      <div>
        {/* Header Khối B8 */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_-4px_rgba(245,158,11,0.5)]">
              <Lightbulb size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
                B8: Đổi mới sáng tạo & Khởi nghiệp - {dashboard.unit?.name ?? "Địa phương"}
              </h3>
              <p className="text-xs text-slate-400">
                Startup · Vườn ươm dự án · Mạng lưới chuyên gia & Nhà đầu tư
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

        {/* 1. LƯỚI 1 HÀNG 2 THẺ (2x2) */}
        <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <StatCell
            label="STARTUP"
            value={startup}
            unit="DN"
            color="#f59e0b"
            targetUrl={metricLinks["b8_startup"]}
            onEditLink={() => handleOpenId("b8_startup", "Startup")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b8_startup",
                field: "startup",
                label: "Startup",
                current: startup,
                matchTokens: ["startup", "khởi nghiệp"],
              })
            }
          />
          <StatCell
            label="DỰ ÁN ƯƠM"
            value={duAnUom}
            unit="DỰ ÁN"
            color="#3b82f6"
            targetUrl={metricLinks["b8_du_an_uom"]}
            onEditLink={() => handleOpenId("b8_du_an_uom", "Dự án ươm")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b8_du_an_uom",
                field: "du_an_uom",
                label: "Dự án ươm",
                current: duAnUom,
                matchTokens: ["dự án ươm", "du_an_uom"],
              })
            }
          />
          <StatCell
            label="CHUYÊN GIA"
            value={chuyenGia}
            unit="NGƯỜI"
            color="#10b981"
            targetUrl={metricLinks["b8_chuyen_gia"]}
            onEditLink={() => handleOpenId("b8_chuyen_gia", "Chuyên gia")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b8_chuyen_gia",
                field: "chuyen_gia",
                label: "Chuyên gia",
                current: chuyenGia,
                matchTokens: ["chuyên gia", "chuyen_gia"],
              })
            }
          />
          <StatCell
            label="NHÀ ĐẦU TƯ"
            value={nhaDauTu}
            unit="NHÀ ĐT"
            color="#a855f7"
            targetUrl={metricLinks["b8_nha_dau_tu"]}
            onEditLink={() => handleOpenId("b8_nha_dau_tu", "Nhà Đầu Tư")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b8_nha_dau_tu",
                field: "nha_dau_tu",
                label: "Nhà Đầu Tư",
                current: nhaDauTu,
                matchTokens: ["nhà đầu tư", "nha_dau_tu"],
              })
            }
          />
        </div>

        {/* 2. BIỂU ĐỒ CỘT BAR CHART (WIDTH: 100% Ở CUỐI CÙNG) */}
        <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <BarChart3 size={16} />
              </span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
                  QUY MÔ HỆ SINH THÁI ĐMST & KHỞI NGHIỆP
                </h4>
                <p className="text-[11px] text-slate-400">Biểu đồ cột so sánh tương quan 4 nguồn lực</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              <TrendingUp size={13} />
              <span>Tổng lực: {totalB8.toLocaleString("vi-VN")}</span>
            </div>
          </div>

          {/* VÙNG VẼ CÁC CỘT BIỂU ĐỒ */}
          <div className="pt-2 pb-1">
            <div className="grid grid-cols-4 gap-2 sm:gap-4 items-end px-1">
              {b8Bars.map((bar) => {
                const heightPercent = Math.min(100, Math.max(14, (bar.value / maxVal) * 100));

                return (
                  <div key={bar.label} className="flex flex-col items-center h-full justify-end group">
                    {/* Badge tăng trưởng */}
                    <span className="mb-1 text-[10px] font-extrabold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                      {bar.growth}
                    </span>

                    {/* Số lượng */}
                    <span className={`mb-1.5 text-xs sm:text-sm font-black tabular-nums ${bar.color}`}>
                      {bar.value}
                    </span>

                    {/* Thân cột */}
                    <div className="w-full max-w-[48px] sm:max-w-[56px] h-[105px] bg-slate-900/80 rounded-t-xl border border-white/10 p-1 flex flex-col justify-end shadow-inner">
                      <div
                        className={`w-full rounded-t-lg bg-gradient-to-t ${bar.gradient} shadow-lg transition-all duration-700 group-hover:brightness-125`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    {/* Tên chỉ tiêu chân cột */}
                    <div className="mt-2 text-center w-full">
                      <div className="text-[11px] font-bold text-slate-200 truncate">
                        {bar.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{bar.unit}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="B8"
          currentId={
            (dashboard as any).b8_custom_id ??
            (dashboard as any)?.metadata?.b8_custom_id ??
            ""
          }
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B8"
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
    </section>
  );
}

export default B8Section;