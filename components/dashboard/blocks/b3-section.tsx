"use client";

import React, { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { StatCell } from "./stat-cell";
import { CellQuantityModal } from "./cell-quantity-modal";
import { MetricIdModal } from "./metric-id-modal";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { getStoredMetricId } from "@/lib/card-link";

interface B3SectionProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks: Record<string, string>;
  metricIds?: Record<string, string>;
  onChanged: () => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function B3Section({
  dashboard,
  data = {},
  metricLinks,
  metricIds = {},
  onChanged,
  onSaveMetricId,
  onSaveQuantity,
}: B3SectionProps) {
  const [qtyTarget, setQtyTarget] = useState<{ key: string; label: string; current: number } | null>(null);
  const [metricIdTarget, setMetricIdTarget] = useState<{ key: string; label: string; id: string } | null>(null);

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

  return (
    <section className="mb-6 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 h-full flex flex-col justify-between">
      <div>
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_-4px_rgba(6,182,212,0.5)]">
            <ShoppingCart size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
              B3: Thương mại điện tử & Khách hàng
            </h3>
            <p className="text-xs text-slate-400">Giao thương trực tuyến · Tăng trưởng & Bảo lưu</p>
          </div>
        </div>

        {/* Lưới 5 thẻ căn chỉnh cân đối */}
        <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCell
            label="DOANH THU GIAO THƯƠNG"
            value={Number(data["doanh_thu"] ?? 0)}
            unit="TR VNĐ"
            color="#06b6d4"
            targetUrl={metricLinks["b3_doanh_thu"]}
            onEditLink={() => handleOpenId("b3_doanh_thu", "Doanh thu giao thương")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b3_doanh_thu",
                label: "Doanh thu giao thương",
                current: Number(data["doanh_thu"] ?? 0),
              })
            }
          />
          <StatCell
            label="ĐƠN HÀNG HOÀN TẤT"
            value={Number(data["don_hang"] ?? 0)}
            unit="ĐƠN"
            color="#3b82f6"
            targetUrl={metricLinks["b3_don_hang"]}
            onEditLink={() => handleOpenId("b3_don_hang", "Đơn hàng hoàn tất")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b3_don_hang",
                label: "Đơn hàng hoàn tất",
                current: Number(data["don_hang"] ?? 0),
              })
            }
          />
          <StatCell
            label="KHÁCH HÀNG MỚI"
            value={Number(data["khach_hang_moi"] ?? 0)}
            unit="KH"
            color="#10b981"
            targetUrl={metricLinks["b3_khach_hang_moi"]}
            onEditLink={() => handleOpenId("b3_khach_hang_moi", "Khách hàng mới")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b3_khach_hang_moi",
                label: "Khách hàng mới",
                current: Number(data["khach_hang_moi"] ?? 0),
              })
            }
          />
          <StatCell
            label="TỶ LỆ MUA LẶP LẠI"
            value={Number(data["ty_le_mua_lap"] ?? 0)}
            unit="%"
            color="#f59e0b"
            targetUrl={metricLinks["b3_ty_le_mua_lap"]}
            onEditLink={() => handleOpenId("b3_ty_le_mua_lap", "Tỷ lệ mua lặp lại")}
            onEditQuantity={() =>
              setQtyTarget({
                key: "b3_ty_le_mua_lap",
                label: "Tỷ lệ mua lặp lại",
                current: Number(data["ty_le_mua_lap"] ?? 0),
              })
            }
          />
          <div className="sm:col-span-2">
            <StatCell
              label="GIÁ TRỊ TRUNG BÌNH / ĐƠN (AOV)"
              value={Number(data["aov"] ?? 0)}
              unit="K VNĐ"
              color="#a855f7"
              targetUrl={metricLinks["b3_aov"]}
              onEditLink={() => handleOpenId("b3_aov", "Giá trị trung bình/Đơn")}
              onEditQuantity={() =>
                setQtyTarget({
                  key: "b3_aov",
                  label: "Giá trị trung bình/Đơn",
                  current: Number(data["aov"] ?? 0),
                })
              }
            />
          </div>
        </div>
      </div>

      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B3"
          field={qtyTarget.key.replace("b3_", "")}
          label={qtyTarget.label}
          currentValue={qtyTarget.current}
          matchTokens={[qtyTarget.label.toLowerCase()]}
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

export default B3Section;