"use client";

import React, { useState } from "react";
import { Layers, Settings, ExternalLink, Link as LinkIcon, Edit3 } from "lucide-react";
import { StatCell } from "./stat-cell";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { MetricIdModal } from "./metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";

interface B5SectionProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks: Record<string, string>;
  onChanged: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

interface LevelItem {
  key: string;
  field: string;
  label: string;
  barColor: string;
}

// 5 MỨC THEO ĐÚNG THỨ TỰ VÀ MÀU SẮC TRONG ẢNH MẪU
const B5_LEVEL_ITEMS: LevelItem[] = [
  {
    key: "b5_level_1",
    field: "level_1",
    label: "Mức 1: Có tài khoản MXH",
    barColor: "bg-[#94a3b8]", // Xám bạc (Slate)
  },
  {
    key: "b5_level_2",
    field: "level_2",
    label: "Mức 2: Nhận thanh toán QR",
    barColor: "bg-[#06b6d4]", // Xanh Cyan
  },
  {
    key: "b5_level_3",
    field: "level_3",
    label: "Mức 3: Đăng ký SP OCOP",
    barColor: "bg-[#10b981]", // Xanh Lá (Emerald)
  },
  {
    key: "b5_level_4",
    field: "level_4",
    label: "Mức 4: Bán hàng TMĐT",
    barColor: "bg-[#6366f1]", // Xanh Tím (Indigo)
  },
  {
    key: "b5_level_5",
    field: "level_5",
    label: "Mức 5: Dùng phần mềm Kế toán",
    barColor: "bg-[#a855f7]", // Tím (Purple)
  },
];

export function B5Section({
  dashboard,
  data = {},
  metricLinks,
  onChanged,
  onOpenMetricId,
  onSaveMetricId,
  onSaveQuantity,
}: B5SectionProps) {
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

  const tongKhaoSat = Number(data["tong_khao_sat"] ?? 0);
  const hoCds = Number(data["ho_cds"] ?? 0);

  const handleOpenId = (key: string, label: string) => {
    if (onOpenMetricId) {
      onOpenMetricId(key, label);
      return;
    }
    const url = metricLinks[key] || "";
    const id = url.split("/").filter(Boolean).pop() || "";
    setMetricIdTarget({ key, label, id });
  };

  const getPercent = (value: number) => {
    if (tongKhaoSat <= 0) return 0;
    return Math.min(100, (value / tongKhaoSat) * 100);
  };

  return (
    <section className="mb-6 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 h-full flex flex-col justify-between">
      <div>
        {/* Header Khối B5 */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shadow-[0_0_20px_-4px_rgba(99,102,241,0.5)]">
              <Layers size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
                B5: Phân lớp hộ kinh doanh số - {dashboard.unit?.name ?? "Địa phương"}
              </h3>
              <p className="text-xs text-slate-400">
                Khảo sát & Chi tiết phân lớp năng lực số (Levels 1 - 5)
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

        <div className="space-y-5">
          {/* HÀNG 1: 2 THẺ TỔNG SỐ KHẢO SÁT & HỘ CÓ HOẠT ĐỘNG CĐS */}
          <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCell
              label="TỔNG SỐ HỘ KHẢO SÁT"
              value={tongKhaoSat}
              unit="HỘ"
              color="#3b82f6"
              targetUrl={metricLinks["b5_tong_khao_sat"]}
              onEditLink={() => handleOpenId("b5_tong_khao_sat", "Tổng số hộ khảo sát")}
              onEditQuantity={() =>
                setQtyTarget({
                  key: "b5_tong_khao_sat",
                  field: "tong_khao_sat",
                  label: "Tổng số hộ khảo sát",
                  current: tongKhaoSat,
                  matchTokens: ["tổng hộ khảo sát", "tong_khao_sat"],
                })
              }
            />
            <StatCell
              label="HỘ CÓ HOẠT ĐỘNG CĐS"
              value={hoCds}
              unit="HỘ"
              color="#10b981"
              targetUrl={metricLinks["b5_ho_cds"]}
              onEditLink={() => handleOpenId("b5_ho_cds", "Hộ có hoạt động CĐS")}
              onEditQuantity={() =>
                setQtyTarget({
                  key: "b5_ho_cds",
                  field: "ho_cds",
                  label: "Hộ có hoạt động CĐS",
                  current: hoCds,
                  matchTokens: ["hộ cđs", "ho_cds"],
                })
              }
            />
          </div>

          {/* HÀNG 2: THẺ DUY NHẤT CHỨA 5 ITEMS PHẲNG THEO MẪU ẢNH */}
          <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-5 shadow-xl sm:p-6">
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-400 mb-6">
              CHI TIẾT PHÂN LỚP NĂNG LỰC SỐ (LEVELS):
            </h4>

            {/* DANH SÁCH 5 HÀNG (ITEMS) */}
            <div className="space-y-5">
              {B5_LEVEL_ITEMS.map((item) => {
                const val = Number(data[item.field] ?? 0);
                const percent = getPercent(val);
                const targetUrl = metricLinks[item.key] || "";

                return (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-center justify-between gap-3 group"
                  >
                    {/* 1. Tên mức (Bên trái) */}
                    <div className="w-48 sm:w-56 shrink-0 truncate text-xs sm:text-sm font-medium text-slate-200">
                      {item.label}
                    </div>

                    {/* 2. Thanh Progress Bar (Ở giữa) */}
                    <div className="flex-1 min-w-[120px] h-3.5 sm:h-4 bg-[#081024] rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full ${item.barColor} transition-all duration-700 shadow-sm`}
                        style={{
                          width: `${percent > 0 ? percent : 0}%`,
                          minWidth: val > 0 ? "8px" : "0px",
                        }}
                      />
                    </div>

                    {/* 3. Giá trị số + Các nút thao tác (Bên phải) */}
                    <div className="w-20 sm:w-24 shrink-0 flex items-center justify-end gap-1.5 text-right">
                      <span className="text-xs sm:text-sm font-black text-slate-100 tabular-nums">
                        {val.toLocaleString("vi-VN")}
                      </span>

                      {/* Nút mở link ngoài */}
                      {targetUrl && (
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:text-white"
                          title={`Xem web: ${targetUrl}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}

                      {/* Nút Admin: Thiết lập ID & Chỉnh số lượng */}
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenId(item.key, item.label)}
                            className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1 text-amber-400 transition hover:bg-amber-500/20"
                            title="Thiết lập ID"
                          >
                            <LinkIcon size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setQtyTarget({
                                key: item.key,
                                field: item.field,
                                label: item.label,
                                current: val,
                                matchTokens: [item.label.toLowerCase()],
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
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="B5"
          currentId={
            (dashboard as any).b5_custom_id ??
            (dashboard as any)?.metadata?.b5_custom_id ??
            ""
          }
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B5"
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

export default B5Section;