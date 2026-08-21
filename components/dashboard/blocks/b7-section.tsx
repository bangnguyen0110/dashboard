"use client";

import React, { useState } from "react";
import { Sprout, Settings, TrendingUp, Layers } from "lucide-react";
import { StatCell } from "./stat-cell";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { MetricIdModal } from "./metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";

interface B7SectionProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks: Record<string, string>;
  onChanged: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function B7Section({
  dashboard,
  data = {},
  metricLinks,
  onChanged,
  onOpenMetricId,
  onSaveMetricId,
  onSaveQuantity,
}: B7SectionProps) {
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
    const url = metricLinks[key] || "";
    const id = url.split("/").filter(Boolean).pop() || "";
    setMetricIdTarget({ key, label, id });
  };

  const vungTrong = Number(data["vung_trong_xanh"] ?? 24);
  const truyXuat = Number(data["truy_xuat_qr"] ?? 156);
  const iot = Number(data["cam_bien_iot"] ?? 85);
  const tmdt = Number(data["len_san_tmdt"] ?? 92);
  const totalAgri = vungTrong + truyXuat + iot + tmdt;

  // CẤU HÌNH BIỂU ĐỒ STACKED AREA CHART (SVG)
  const chartW = 500;
  const chartH = 170;
  const padLeft = 35;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;

  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;
  const xPoints = [
    padLeft,
    padLeft + innerW * 0.33,
    padLeft + innerW * 0.66,
    padLeft + innerW,
  ];

  // Mô phỏng tích lũy 4 mốc thời gian: Quý 1 -> Quý 2 -> Quý 3 -> Hiện tại
  const qRatios = [0.35, 0.58, 0.82, 1.0];
  const maxCumulative = totalAgri > 0 ? totalAgri * 1.1 : 100;

  const getY = (val: number) => {
    const r = Math.min(1, Math.max(0, val / maxCumulative));
    return (padTop + innerH * (1 - r)).toFixed(1);
  };

  // Tính toán các tầng xếp chồng (Cumulative Layers)
  // Layer 1: Vùng trồng
  const l1Values = qRatios.map((r) => vungTrong * r);
  // Layer 2: Vùng trồng + Truy xuất
  const l2Values = qRatios.map((r, i) => l1Values[i] + truyXuat * r);
  // Layer 3: + IoT
  const l3Values = qRatios.map((r, i) => l2Values[i] + iot * r);
  // Layer 4: + TMĐT (Tổng)
  const l4Values = qRatios.map((r, i) => l3Values[i] + tmdt * r);

  const baselineY = (padTop + innerH).toFixed(1);

  // Tạo Path SVG diện tích xếp chồng (Area Paths)
  const makeAreaPath = (topVals: number[], botVals?: number[]) => {
    const topPts = topVals.map((v, i) => `${xPoints[i]},${getY(v)}`);
    if (!botVals) {
      return `M ${topPts[0]} L ${topPts.join(" L ")} L ${xPoints[3]},${baselineY} L ${xPoints[0]},${baselineY} Z`;
    }
    const botPts = [...botVals].reverse().map((v, i) => `${xPoints[3 - i]},${getY(v)}`);
    return `M ${topPts[0]} L ${topPts.join(" L ")} L ${botPts.join(" L ")} Z`;
  };

  return (
    <section className="mb-6 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 h-full flex flex-col justify-between">
      <div>
        {/* Header Khối B7 */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-lime-500/30 bg-lime-500/10 text-lime-400 shadow-[0_0_20px_-4px_rgba(132,204,22,0.5)]">
              <Sprout size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
                B7: Nông nghiệp thông minh & Truy xuất - {dashboard.unit?.name ?? "Địa phương"}
              </h3>
              <p className="text-xs text-slate-400">
                Vùng trồng xanh · Mã QR · Thiết bị IoT & TMĐT Nông sản
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
            label="VÙNG TRỒNG XANH"
            value={vungTrong}
            unit="VÙNG"
            color="#84cc16"
            targetUrl={metricLinks["b7_vung_trong_xanh"]}
            onEditLink={() => handleOpenId("b7_vung_trong_xanh", "Vùng trồng Xanh")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b7_vung_trong_xanh",
                field: "vung_trong_xanh",
                label: "Vùng trồng Xanh",
                current: vungTrong,
                matchTokens: ["vùng trồng xanh", "vung_trong_xanh"],
              })
            }
          />
          <StatCell
            label="TRUY XUẤT QR"
            value={truyXuat}
            unit="MÃ"
            color="#06b6d4"
            targetUrl={metricLinks["b7_truy_xuat_qr"]}
            onEditLink={() => handleOpenId("b7_truy_xuat_qr", "Truy xuất QR")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b7_truy_xuat_qr",
                field: "truy_xuat_qr",
                label: "Truy xuất QR",
                current: truyXuat,
                matchTokens: ["truy xuất qr", "truy_xuat_qr"],
              })
            }
          />
          <StatCell
            label="CẢM BIẾN IOT"
            value={iot}
            unit="THIẾT BỊ"
            color="#a855f7"
            targetUrl={metricLinks["b7_cam_bien_iot"]}
            onEditLink={() => handleOpenId("b7_cam_bien_iot", "Cảm biến IoT")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b7_cam_bien_iot",
                field: "cam_bien_iot",
                label: "Cảm biến IoT",
                current: iot,
                matchTokens: ["cảm biến iot", "cam_bien_iot"],
              })
            }
          />
          <StatCell
            label="LÊN SÀN TMĐT"
            value={tmdt}
            unit="SẢN PHẨM"
            color="#f97316"
            targetUrl={metricLinks["b7_len_san_tmdt"]}
            onEditLink={() => handleOpenId("b7_len_san_tmdt", "Lên sàn TMĐT")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b7_len_san_tmdt",
                field: "len_san_tmdt",
                label: "Lên sàn TMĐT",
                current: tmdt,
                matchTokens: ["lên sàn tmdt", "len_san_tmdt"],
              })
            }
          />
        </div>

        {/* 2. BIỂU ĐỒ STACKED AREA CHART (WIDTH: 100% Ở CUỐI CÙNG) */}
        <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5 shadow-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-lime-500/30 bg-lime-500/10 text-lime-400">
                <Layers size={16} />
              </span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
                  TIẾN TRÌNH SỐ HÓA NÔNG NGHIỆP TÍCH LŨY
                </h4>
                <p className="text-[11px] text-slate-400">Biểu đồ miền xếp chồng (Stacked Area Chart)</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-lime-400 bg-lime-500/10 px-2.5 py-0.5 rounded-full border border-lime-500/20">
              <TrendingUp size={13} />
              <span>Tổng: {totalAgri.toLocaleString("vi-VN")}</span>
            </div>
          </div>

          {/* CHÚ THÍCH CÁC TẦNG MIỀN */}
          <div className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-orange-400">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#f97316]" /> Lên sàn TMĐT ({tmdt})
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#a855f7]" /> Cảm biến IoT ({iot})
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#06b6d4]" /> Truy xuất QR ({truyXuat})
            </span>
            <span className="flex items-center gap-1.5 text-lime-400">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#84cc16]" /> Vùng trồng xanh ({vungTrong})
            </span>
          </div>

          {/* VÙNG VẼ SVG STACKED AREA */}
          <div className="relative flex justify-center items-center py-2">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full overflow-visible">
              <defs>
                <linearGradient id="grad-tmdt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="grad-iot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="grad-qr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="grad-vungtrong" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#84cc16" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#84cc16" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              {/* Lưới ngang tham chiếu */}
              {[0, 0.33, 0.66, 1].map((ratio, i) => {
                const y = (padTop + innerH * (1 - ratio)).toFixed(1);
                return (
                  <g key={i}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={chartW - padRight}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="1"
                      strokeDasharray={i > 0 && i < 3 ? "3 3" : "none"}
                    />
                    <text
                      x={padLeft - 6}
                      y={Number(y) + 3}
                      textAnchor="end"
                      className="fill-slate-500 text-[8px] font-mono"
                    >
                      {Math.round(maxCumulative * ratio)}
                    </text>
                  </g>
                );
              })}

              {/* Tầng 4 (Trên cùng): Lên sàn TMĐT */}
              <path
                d={makeAreaPath(l4Values, l3Values)}
                fill="url(#grad-tmdt)"
                stroke="#f97316"
                strokeWidth="1.5"
                className="transition-all duration-700"
              />
              {/* Tầng 3: Cảm biến IoT */}
              <path
                d={makeAreaPath(l3Values, l2Values)}
                fill="url(#grad-iot)"
                stroke="#a855f7"
                strokeWidth="1.5"
                className="transition-all duration-700"
              />
              {/* Tầng 2: Truy xuất QR */}
              <path
                d={makeAreaPath(l2Values, l1Values)}
                fill="url(#grad-qr)"
                stroke="#06b6d4"
                strokeWidth="1.5"
                className="transition-all duration-700"
              />
              {/* Tầng 1 (Đáy): Vùng trồng xanh */}
              <path
                d={makeAreaPath(l1Values)}
                fill="url(#grad-vungtrong)"
                stroke="#84cc16"
                strokeWidth="1.5"
                className="transition-all duration-700"
              />

              {/* Điểm nút & Nhãn trục hoành X */}
              {["Quý 1", "Quý 2", "Quý 3", "Hiện tại"].map((label, idx) => (
                <g key={idx}>
                  <line
                    x1={xPoints[idx]}
                    y1={padTop}
                    x2={xPoints[idx]}
                    y2={padTop + innerH}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={xPoints[idx]}
                    y={chartH - 6}
                    textAnchor="middle"
                    className="fill-slate-400 font-semibold text-[9px]"
                  >
                    {label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="B7"
          currentId={
            (dashboard as any).b7_custom_id ??
            (dashboard as any)?.metadata?.b7_custom_id ??
            ""
          }
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B7"
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

export default B7Section;