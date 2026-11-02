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
import { cardLinkProps, getStoredMetricId } from "@/lib/card-link";

interface Level3ViewProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks?: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged?: () => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function Level3View({
  dashboard,
  data = {},
  metricLinks = {},
  metricIds = {},
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
    const id = getStoredMetricId(metricIds, key, metricLinks[key]);
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
        <div
          {...cardLinkProps(metricLinks["l3_du_an_dau_tu"])}
          className={`bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors overflow-hidden${metricLinks["l3_du_an_dau_tu"] ? " cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
        >
          <div className="p-5 flex justify-between items-start border-b border-slate-100 dark:border-slate-700/50">
            <div className="flex gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-xl border border-amber-200 dark:border-amber-700/50 shrink-0">
                <Briefcase size={22} />
              </div>
              <div>
                <h4 className="text-slate-800 dark:text-white font-bold uppercase tracking-wide text-xs sm:text-sm">
                  DỰ ÁN KÊU GỌI ĐẦU TƯ
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Danh mục dự án xúc tiến & thu hút đầu tư địa phương
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {metricLinks["l3_du_an_dau_tu"] && (
                <a
                  href={metricLinks["l3_du_an_dau_tu"]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-50 dark:bg-[#0f172a] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
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
                    className="p-2 bg-slate-50 dark:bg-[#0f172a] text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
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
                    className="p-2 bg-slate-50 dark:bg-[#0f172a] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
                    title="Setup số lượng"
                  >
                    <Edit3 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-5 bg-slate-50/50 dark:bg-transparent flex justify-between items-end">
            <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Số lượng dự án</span>
            <div>
              <span className="text-2xl sm:text-4xl font-black text-amber-500 dark:text-amber-400 tabular-nums">
                {duAnDauTu.toLocaleString("vi-VN")}{" "}
                <span className="text-xs sm:text-sm font-bold text-amber-600/70 dark:text-amber-500/70">DỰ ÁN</span>
              </span>
            </div>
          </div>
        </div>

        {/* Thẻ 2: Thông tin quy hoạch */}
        <div
          {...cardLinkProps(metricLinks["l3_thong_tin_quy_hoach"])}
          className={`bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm transition-colors overflow-hidden${metricLinks["l3_thong_tin_quy_hoach"] ? " cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
        >
          <div className="p-5 flex justify-between items-start border-b border-slate-100 dark:border-slate-700/50">
            <div className="flex gap-4">
              <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 rounded-xl border border-cyan-200 dark:border-cyan-700/50 shrink-0">
                <MapPin size={22} />
              </div>
              <div>
                <h4 className="text-slate-800 dark:text-white font-bold uppercase tracking-wide text-xs sm:text-sm">
                  THÔNG TIN QUY HOẠCH
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Bản đồ số, quy hoạch phân khu & chỉ tiêu xây dựng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {metricLinks["l3_thong_tin_quy_hoach"] && (
                <a
                  href={metricLinks["l3_thong_tin_quy_hoach"]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-50 dark:bg-[#0f172a] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
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
                    className="p-2 bg-slate-50 dark:bg-[#0f172a] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
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
                    className="p-2 bg-slate-50 dark:bg-[#0f172a] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
                    title="Setup số lượng"
                  >
                    <Edit3 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-5 bg-slate-50/50 dark:bg-transparent flex justify-between items-end">
            <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Số lượng quy hoạch</span>
            <div>
              <span className="text-2xl sm:text-4xl font-black text-cyan-600 dark:text-cyan-400 tabular-nums">
                {thongTinQuyHoach.toLocaleString("vi-VN")}{" "}
                <span className="text-xs sm:text-sm font-bold text-cyan-600/70 dark:text-cyan-500/70">THÔNG TIN</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THẺ 3: BIỂU ĐỒ CỘT NGANG (WIDTH: 100% ĐẶT Ở CUỐI CÙNG) */}
      <div className="w-full bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6 shadow-sm transition-colors overflow-hidden">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-blue-200 dark:border-cyan-500/30 bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400">
              <BarChart3 size={18} />
            </span>
            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                BIỂU ĐỒ TƯƠNG QUAN DỰ ÁN ĐẦU TƯ & QUY HOẠCH
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                So sánh số lượng và tỷ trọng phân bổ giữa 2 hạng mục
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">
            <TrendingUp size={13} />
            <span>Tổng cộng: {totalAll.toLocaleString("vi-VN")} mục</span>
          </div>
        </div>

        {/* VÙNG BIỂU ĐỒ NGANG (HORIZONTAL BAR CHART) */}
        <div className="space-y-6 pt-2">
          {/* Hàng 1: Dự án kêu gọi đầu tư */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm" />
                DỰ ÁN KÊU GỌI ĐẦU TƯ
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {duAnDauTu.toLocaleString("vi-VN")} DỰ ÁN
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">({pctDuAn}%)</span>
              </div>
            </div>

            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 shadow-md transition-all duration-700"
                style={{ width: `${widthDuAn}%` }}
              />
            </div>
          </div>

          {/* Hàng 2: Thông tin quy hoạch */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-sm" />
                THÔNG TIN QUY HOẠCH
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-cyan-600 dark:text-cyan-400 tabular-nums">
                  {thongTinQuyHoach.toLocaleString("vi-VN")} THÔNG TIN
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">({pctQuyHoach}%)</span>
              </div>
            </div>

            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5">
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