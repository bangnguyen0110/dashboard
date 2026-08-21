"use client";

import React, { useState } from "react";
import {
  Briefcase,
  MapPin,
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

interface Level3ViewProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks?: Record<string, string>;
  onChanged?: () => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function Level3View({
  dashboard,
  data = {},
  metricLinks = {},
  onChanged = () => {},
  onSaveMetricId,
  onSaveQuantity,
}: Level3ViewProps) {
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
    const url = metricLinks[key] || "";
    const id = url.split("/").filter(Boolean).pop() || "";
    setMetricIdTarget({ key, label, id });
  };

  // Số liệu 2 chỉ tiêu
  const duAnDauTu = Number(data["du_an_dau_tu"] ?? 0);
  const thongTinQuyHoach = Number(data["thong_tin_quy_hoach"] ?? 0);
  const totalAll = duAnDauTu + thongTinQuyHoach;

  // Tính tỷ lệ % cho thanh biểu đồ ngang
  const maxVal = Math.max(duAnDauTu, thongTinQuyHoach, 1);
  const pctDuAn = totalAll > 0 ? ((duAnDauTu / totalAll) * 100).toFixed(1) : "0.0";
  const pctQuyHoach = totalAll > 0 ? ((thongTinQuyHoach / totalAll) * 100).toFixed(1) : "0.0";

  const widthDuAn = totalAll > 0 ? Math.min(100, Math.max(8, (duAnDauTu / maxVal) * 100)) : 0;
  const widthQuyHoach = totalAll > 0 ? Math.min(100, Math.max(8, (thongTinQuyHoach / maxVal) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* 1. HÀNG 1: 2 THẺ CHỈ TIÊU (MỖI THẺ RỘNG 50%) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Thẻ 1: Dự án kêu gọi đầu tư */}
        <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl transition hover:border-white/15 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <Briefcase size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-200">
                  DỰ ÁN KÊU GỌI ĐẦU TƯ
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Danh mục dự án xúc tiến & thu hút đầu tư địa phương
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {metricLinks["l3_du_an_dau_tu"] && (
                <a
                  href={metricLinks["l3_du_an_dau_tu"]}
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
                    onClick={() => handleOpenId("l3_du_an_dau_tu", "Dự án kêu gọi đầu tư")}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-400 transition hover:bg-amber-500/20"
                    title="Thiết lập ID"
                  >
                    <LinkIcon size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQtyTarget({
                        key: "l3_du_an_dau_tu",
                        field: "du_an_dau_tu",
                        label: "Dự án kêu gọi đầu tư",
                        current: duAnDauTu,
                        matchTokens: ["dự án kêu gọi đầu tư", "du_an_dau_tu"],
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

          <div className="mt-5 flex items-baseline justify-between pt-3 border-t border-white/5">
            <span className="text-xs font-semibold text-slate-400">Số lượng dự án</span>
            <div>
              <span className="text-2xl sm:text-3xl font-black tabular-nums text-amber-400">
                {duAnDauTu.toLocaleString("vi-VN")}
              </span>
              <span className="ml-1.5 text-xs font-bold text-slate-400">DỰ ÁN</span>
            </div>
          </div>
        </div>

        {/* Thẻ 2: Thông tin quy hoạch */}
        <div className="rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl transition hover:border-white/15 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                <MapPin size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-200">
                  THÔNG TIN QUY HOẠCH
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Bản đồ số, quy hoạch phân khu & chỉ tiêu xây dựng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {metricLinks["l3_thong_tin_quy_hoach"] && (
                <a
                  href={metricLinks["l3_thong_tin_quy_hoach"]}
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
                    onClick={() => handleOpenId("l3_thong_tin_quy_hoach", "Thông tin quy hoạch")}
                    className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-1.5 text-cyan-400 transition hover:bg-cyan-500/20"
                    title="Thiết lập ID"
                  >
                    <LinkIcon size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQtyTarget({
                        key: "l3_thong_tin_quy_hoach",
                        field: "thong_tin_quy_hoach",
                        label: "Thông tin quy hoạch",
                        current: thongTinQuyHoach,
                        matchTokens: ["thông tin quy hoạch", "thong_tin_quy_hoach"],
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

          <div className="mt-5 flex items-baseline justify-between pt-3 border-t border-white/5">
            <span className="text-xs font-semibold text-slate-400">Số lượng quy hoạch</span>
            <div>
              <span className="text-2xl sm:text-3xl font-black tabular-nums text-cyan-400">
                {thongTinQuyHoach.toLocaleString("vi-VN")}
              </span>
              <span className="ml-1.5 text-xs font-bold text-slate-400">THÔNG TIN</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THẺ 3: BIỂU ĐỒ CỘT NGANG (WIDTH: 100% ĐẶT Ở CUỐI CÙNG) */}
      <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 sm:p-6 shadow-xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <BarChart3 size={16} />
            </span>
            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
                BIỂU ĐỒ TƯƠNG QUAN DỰ ÁN ĐẦU TƯ & QUY HOẠCH
              </h4>
              <p className="text-[11px] text-slate-400">
                So sánh số lượng và tỷ trọng phân bổ giữa 2 hạng mục
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <TrendingUp size={13} />
            <span>Tổng cộng: {totalAll.toLocaleString("vi-VN")} mục</span>
          </div>
        </div>

        {/* VÙNG BIỂU ĐỒ NGANG (HORIZONTAL BAR CHART) */}
        <div className="space-y-6 pt-2">
          {/* Hàng 1: Dự án kêu gọi đầu tư */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-sm" />
                DỰ ÁN KÊU GỌI ĐẦU TƯ
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-400 tabular-nums">
                  {duAnDauTu.toLocaleString("vi-VN")} DỰ ÁN
                </span>
                <span className="text-[11px] text-slate-400 font-mono">({pctDuAn}%)</span>
              </div>
            </div>

            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 shadow-md transition-all duration-700"
                style={{ width: `${widthDuAn}%` }}
              />
            </div>
          </div>

          {/* Hàng 2: Thông tin quy hoạch */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-sm" />
                THÔNG TIN QUY HOẠCH
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-cyan-400 tabular-nums">
                  {thongTinQuyHoach.toLocaleString("vi-VN")} THÔNG TIN
                </span>
                <span className="text-[11px] text-slate-400 font-mono">({pctQuyHoach}%)</span>
              </div>
            </div>

            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-md transition-all duration-700"
                style={{ width: `${widthQuyHoach}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Block ID */}
      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="L3"
          currentId={(dashboard as any).l3_custom_id ?? (dashboard as any)?.metadata?.l3_custom_id ?? ""}
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {/* Modal Chỉnh sửa số lượng */}
      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="L3" 
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

export default Level3View;