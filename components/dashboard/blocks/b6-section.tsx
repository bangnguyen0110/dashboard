"use client";

import React, { useState } from "react";
import {
  Compass,
  MapPin,
  Users,
  DollarSign,
  Star,
  Settings,
  ExternalLink,
  Link as LinkIcon,
  Edit3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { MetricIdModal } from "./metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";

interface B6SectionProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks: Record<string, string>;
  onChanged: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

interface B6ItemConfig {
  key: string;
  field: string;
  growthField: string;
  label: string;
  desc: string;
  unit: string;
  colorClass: string;
  badgeBg: string;
  defaultGrowth: number;
  icon: React.ElementType;
}

const B6_ITEMS: B6ItemConfig[] = [
  {
    key: "b6_diem_du_lich",
    field: "diem_du_lich",
    growthField: "growth_diem_du_lich",
    label: "Điểm du lịch số hóa",
    desc: "Di tích, danh lam thắng cảnh số hóa VR/3D/QR",
    unit: "ĐIỂM",
    colorClass: "text-rose-400",
    badgeBg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    defaultGrowth: 15.2,
    icon: MapPin,
  },
  {
    key: "b6_khach_tour_online",
    field: "khach_tour_online",
    growthField: "growth_khach_tour",
    label: "Khách đặt tour Online",
    desc: "Lượt khách đặt vé & tour qua nền tảng trực tuyến",
    unit: "LƯỢT",
    colorClass: "text-blue-400",
    badgeBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    defaultGrowth: 22.4,
    icon: Users,
  },
  {
    key: "b6_doanh_thu_lu_hanh",
    field: "doanh_thu_lu_hanh",
    growthField: "growth_doanh_thu",
    label: "Doanh thu lữ hành ĐT",
    desc: "Doanh thu booking, lưu trú & dịch vụ số",
    unit: "TR VNĐ",
    colorClass: "text-emerald-400",
    badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    defaultGrowth: 18.6,
    icon: DollarSign,
  },
  {
    key: "b6_danh_gia_tuong_tac",
    field: "danh_gia_tuong_tac",
    growthField: "growth_danh_gia",
    label: "Đánh giá hệ thống tương tác",
    desc: "Tỷ lệ hài lòng & phản hồi từ du khách",
    unit: "%",
    colorClass: "text-amber-400",
    badgeBg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    defaultGrowth: -2.8,
    icon: Star,
  },
];

export function B6Section({
  dashboard,
  data = {},
  metricLinks,
  onChanged,
  onOpenMetricId,
  onSaveMetricId,
  onSaveQuantity,
}: B6SectionProps) {
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

  return (
    <section className="mb-6 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 h-full flex flex-col justify-between">
      <div>
        {/* Header Khối B6 */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-[0_0_20px_-4px_rgba(244,63,94,0.5)]">
              <Compass size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
                B6: Du lịch - Ẩm thực - Lễ hội - {dashboard.unit?.name ?? "Địa phương"}
              </h3>
              <p className="text-xs text-slate-400">
                Số hóa điểm đến · Tour Online & Tương tác du khách
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

        {/* Danh sách 4 thẻ thống kê (Mỗi thẻ rộng 100%) */}
        <div className="space-y-3.5 w-full">
          {B6_ITEMS.map((item) => {
            const Icon = item.icon;
            const val = Number(data[item.field] ?? 0);
            const growth = Number(data[item.growthField] ?? item.defaultGrowth);
            const isPositive = growth >= 0;
            const targetUrl = metricLinks[item.key] || "";

            return (
              <div
                key={item.key}
                className="w-full rounded-2xl border border-white/5 bg-[#0c1830]/90 p-4 shadow-xl transition-all duration-300 hover:border-white/15"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Trái: Icon + Tiêu đề + Mô tả */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${item.badgeBg}`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-100">
                        {item.label}
                      </h4>
                      <p className="hidden sm:block truncate text-[11px] text-slate-400 mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {/* Phải: Giá trị số + Badge Tăng/Giảm + Nút thao tác */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className={`text-xl sm:text-2xl font-black tabular-nums ${item.colorClass}`}
                        >
                          {val.toLocaleString("vi-VN")}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          {item.unit}
                        </span>
                      </div>

                      <div
                        className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isPositive
                            ? "text-emerald-400 bg-emerald-500/10"
                            : "text-rose-400 bg-rose-500/10"
                        }`}
                      >
                        {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        <span>
                          {isPositive ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`}
                        </span>
                      </div>
                    </div>

                    {targetUrl && (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-300 transition hover:text-white hover:bg-slate-700"
                        title={`Xem web: ${targetUrl}`}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}

                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenId(item.key, item.label)}
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-400 transition hover:text-amber-300 hover:bg-amber-500/20"
                          title="Thiết lập ID"
                        >
                          <LinkIcon size={14} />
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
                          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-2 text-cyan-400 transition hover:text-cyan-300 hover:bg-cyan-500/20"
                          title="Setup Số lượng"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showBlockId && (
        <BlockIdModal
          dashboard={dashboard}
          section="B6"
          currentId={
            (dashboard as any).b6_custom_id ??
            (dashboard as any)?.metadata?.b6_custom_id ??
            ""
          }
          onClose={() => setShowBlockId(false)}
          onSaved={onChanged}
        />
      )}

      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B6"
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

export default B6Section;