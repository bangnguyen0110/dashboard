"use client";

import React, { useState } from "react";
import { CreditCard } from "lucide-react";
import { StatCell } from "./stat-cell";
import { CellQuantityModal } from "./cell-quantity-modal";
import { MetricIdModal } from "./metric-id-modal";
import type { DashboardRow, KpiRow } from "@/lib/types";

interface B4SectionProps {
  dashboard: DashboardRow;
  data?: KpiRow;
  metricLinks: Record<string, string>;
  onChanged: () => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
}

export function B4Section({
  dashboard,
  data = {},
  metricLinks,
  onChanged,
  onSaveMetricId,
  onSaveQuantity,
}: B4SectionProps) {
  const [qtyTarget, setQtyTarget] = useState<{ key: string; label: string; current: number } | null>(null);
  const [metricIdTarget, setMetricIdTarget] = useState<{ key: string; label: string; id: string } | null>(null);

  const baseDomain = (
    dashboard?.base_domain ||
    dashboard?.metadata?.base_domain ||
    dashboard?.domain_link ||
    ""
  ).trim().replace(/\/+$/, "");

  const qr = Number(data["qr_pay"] ?? 0);
  const ibanking = Number(data["ibanking"] ?? 0);
  const wallet = Number(data["e_wallet"] ?? 0);
  const pos = Number(data["pos"] ?? 0);
  const total = qr + ibanking + wallet + pos;
  const pct = (val: number) => (total > 0 ? ((val / total) * 100).toFixed(1) : "0.0");

  const handleOpenId = (key: string, label: string) => {
    const url = metricLinks[key] || "";
    const id = url.split("/").filter(Boolean).pop() || "";
    setMetricIdTarget({ key, label, id });
  };

  return (
    <section className="mb-6 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 h-full flex flex-col justify-between">
      <div>
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)]">
            <CreditCard size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
              B4: Hạ tầng thanh toán số (KTM)
            </h3>
            <p className="text-xs text-slate-400">Phương thức thanh toán không dùng tiền mặt</p>
          </div>
        </div>

        {/* Biểu đồ phân bổ */}
        <div className="mb-5 rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4">
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
            <span>PHÂN BỔ PHƯƠNG THỨC THANH TOÁN</span>
            <span className="text-emerald-400">Tổng điểm: {total.toLocaleString("vi-VN")}</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-900 flex">
            {total > 0 && (
              <>
                <div style={{ width: `${pct(qr)}%` }} className="h-full bg-emerald-500" title={`QR Pay: ${pct(qr)}%`} />
                <div style={{ width: `${pct(ibanking)}%` }} className="h-full bg-blue-500" title={`Internet Banking: ${pct(ibanking)}%`} />
                <div style={{ width: `${pct(wallet)}%` }} className="h-full bg-purple-500" title={`Ví điện tử: ${pct(wallet)}%`} />
                <div style={{ width: `${pct(pos)}%` }} className="h-full bg-amber-500" title={`Máy POS: ${pct(pos)}%`} />
              </>
            )}
          </div>
        </div>

        {/* 1 HÀNG 4 THẺ CHIA 2x2 CÂN ĐỐI */}
        <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCell
            label="MÃ QR PAY"
            value={qr}
            unit="ĐIỂM"
            color="#10b981"
            targetUrl={metricLinks["b4_qr_pay"]}
            onEditLink={() => handleOpenId("b4_qr_pay", "Mã QR Pay")}
            onEditQuantity={() => setQtyTarget({ key: "b4_qr_pay", label: "Mã QR Pay", current: qr })}
          />
          <StatCell
            label="INTERNET BANKING"
            value={ibanking}
            unit="TÀI KHOẢN"
            color="#3b82f6"
            targetUrl={metricLinks["b4_ibanking"]}
            onEditLink={() => handleOpenId("b4_ibanking", "Internet Banking")}
            onEditQuantity={() => setQtyTarget({ key: "b4_ibanking", label: "Internet Banking", current: ibanking })}
          />
          <StatCell
            label="VÍ ĐIỆN TỬ"
            value={wallet}
            unit="VÍ"
            color="#a855f7"
            targetUrl={metricLinks["b4_e_wallet"]}
            onEditLink={() => handleOpenId("b4_e_wallet", "Ví Điện Tử")}
            onEditQuantity={() => setQtyTarget({ key: "b4_e_wallet", label: "Ví Điện Tử", current: wallet })}
          />
          <StatCell
            label="MÁY POS"
            value={pos}
            unit="MÁY"
            color="#f59e0b"
            targetUrl={metricLinks["b4_pos"]}
            onEditLink={() => handleOpenId("b4_pos", "Máy POS")}
            onEditQuantity={() => setQtyTarget({ key: "b4_pos", label: "Máy POS", current: pos })}
          />
        </div>
      </div>

      {qtyTarget && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B4"
          field={qtyTarget.key.replace("b4_", "")}
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

export default B4Section;