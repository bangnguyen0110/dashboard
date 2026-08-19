"use client";

import React from "react";
import { Building2, Zap, Settings, Link as LinkIcon, Edit3, ExternalLink } from "lucide-react";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { MetricIdModal } from "./metric-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow } from "@/lib/types";

export interface B1SectionProps {
  locationName?: string;
  data?: Record<string, unknown>;
  b1?: Record<string, unknown>;
  metricLinks?: Record<string, string>;
  dashboard?: DashboardRow;
  onChanged?: () => void;
  onOpenLinkModal?: (key: string) => void;
  onOpenQtyModal?: (key: string) => void;
  onOpenSetupId?: () => void;
  onOpenMetricId?: (key: string, label: string) => void;
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
}

interface QuantityState { field: string; label: string; current: number; matchTokens: string[]; }

const LINK_LABELS: Record<string, string> = {
  b1_total_units: "Tổng số Doanh nghiệp SME",
  b1_sme_total: "Tổng số Doanh nghiệp SME",
  b1_hkd_total: "Tổng số Hộ kinh doanh",
  b1_htx_total: "Tổng số Hợp tác xã",
  b1_total_dx_units: "Doanh nghiệp SME CĐS",
  b1_sme_dx: "Doanh nghiệp SME CĐS",
  b1_hkd_dx: "Hộ kinh doanh CĐS",
  b1_htx_dx: "Hợp tác xã CĐS",
};

const QTY_MAP: Record<string, { field: string; label: string; matchTokens: string[] }> = {
  b1_total_units: { field: "sme_total", label: "Tổng số Doanh nghiệp SME", matchTokens: ["doanh nghiệp SME", "sme"] },
  b1_sme_total: { field: "sme_total", label: "Tổng số Doanh nghiệp SME", matchTokens: ["doanh nghiệp SME", "sme"] },
  b1_hkd_total: { field: "hkd_total", label: "Tổng số Hộ kinh doanh", matchTokens: ["hộ kinh doanh", "hkd"] },
  b1_htx_total: { field: "htx_total", label: "Tổng số Hợp tác xã", matchTokens: ["hợp tác xã", "htx"] },
  b1_total_dx_units: { field: "sme_cds", label: "Doanh nghiệp SME CĐS", matchTokens: ["doanh nghiệp SME CĐS", "sme cds"] },
  b1_sme_dx: { field: "sme_cds", label: "Doanh nghiệp SME CĐS", matchTokens: ["doanh nghiệp SME CĐS", "sme cds"] },
  b1_hkd_dx: { field: "hkd_cds", label: "Hộ kinh doanh CĐS", matchTokens: ["hộ kinh doanh CĐS", "hkd cds"] },
  b1_htx_dx: { field: "htx_cds", label: "Hợp tác xã CĐS", matchTokens: ["hợp tác xã CĐS", "htx cds"] },
};

export function B1Section({
  locationName = "ĐỊA PHƯƠNG",
  data,
  b1,
  metricLinks = {},
  dashboard,
  onChanged,
  onOpenLinkModal,
  onOpenQtyModal,
  onOpenSetupId,
  onOpenMetricId,
  onSaveMetricId,
}: B1SectionProps) {
  const source = data || b1 || {};
  const { isAdmin } = useAuth();

  const [showBlockId, setShowBlockId] = React.useState(false);
  const [quantityState, setQuantityState] = React.useState<{ field: string; label: string; current: number; matchTokens: string[] } | null>(null);
  const [metricIdState, setMetricIdState] = React.useState<{ metricKey: string; metricId: string | null } | null>(null);

  const currentValueOf = (key: string): number => {
    const field = QTY_MAP[key]?.field ?? "";
    return Number(source?.[field] ?? 0);
  };

  const handleOpenLink = (key: string): void => {
    if (onOpenMetricId) {
      onOpenMetricId(key, LINK_LABELS[key] ?? key);
      return;
    }
    // Mở MetricIdModal để thiết lập ID + đồng bộ số liệu qua web scraping
    setMetricIdState({
      metricKey: key,
      metricId: null,
    });
  };

  const handleOpenQty = (key: string): void => {
    if (onOpenQtyModal) {
      onOpenQtyModal(key);
      return;
    }
    const info = QTY_MAP[key];
    if (!info) return;
    setQuantityState({
      field: info.field,
      label: info.label,
      current: currentValueOf(key),
      matchTokens: info.matchTokens,
    });
  };

  const handleSetupId = (): void => {
    if (onOpenSetupId) {
      onOpenSetupId();
      return;
    }
    setShowBlockId(true);
  };

  const smeTotal = Number(source?.smeTotal || source?.sme_total || 0);
  const hkdTotal = Number(source?.hkdTotal || source?.hkd_total || 0);
  const htxTotal = Number(source?.htxTotal || source?.htx_total || 0);
  const totalUnits = smeTotal + hkdTotal + htxTotal;

  const smeDx = Number(source?.smeDx || source?.sme_dx || 0);
  const hkdDx = Number(source?.hkdDx || source?.hkd_dx || 0);
  const htxDx = Number(source?.htxDx || source?.htx_dx || 0);
  const totalDxUnits = smeDx + hkdDx + htxDx;

  const totalDxRatio = totalUnits > 0 ? ((totalDxUnits / totalUnits) * 100).toFixed(2) : "0.00";
  const smeRatio = smeTotal > 0 ? ((smeDx / smeTotal) * 100).toFixed(2) : "0";
  const hkdRatio = hkdTotal > 0 ? ((hkdDx / hkdTotal) * 100).toFixed(1) : "0";
  const htxRatio = htxTotal > 0 ? ((htxDx / htxTotal) * 100).toFixed(1) : "0.0";

  return (
    <div className="w-full bg-[#0a1124]/90 backdrop-blur-xl p-4 sm:p-6 md:p-7 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 shadow-2xl space-y-6 mb-8 text-white">
      {/* Header Khối B1 */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Building2 className="w-6 h-6"/>
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-bold uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              B1: THÔNG TIN ĐƠN VỊ KINH DOANH - {dashboard?.unit?.name ?? locationName}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Chỉ số chuyển đổi số doanh nghiệp, hộ kinh doanh & HTX</p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleSetupId}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Settings size={14}/>
            <span>Thiết lập ID</span>
          </button>
        )}
      </div>

      {/* CỤM 1: TỔNG SỐ DOANH NGHIỆP / HKD / HTX */}
      <div className="space-y-3.5 w-full">
        <BannerCard label="TỔNG SỐ DOANH NGHIỆP/ HKD/ HTX:" link={metricLinks?.["b1_total_units"]} metricKey="b1_total_units" onOpenLink={handleOpenLink} onOpenQty={handleOpenQty} value={totalUnits}/>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 w-full">
          <StatCard link={metricLinks?.["b1_sme_total"]} metricKey="b1_sme_total" onOpenLink={handleOpenLink} onOpenQty={handleOpenQty} title="TỔNG SỐ DOANH NGHIỆP VỪA VÀ NHỎ" value={smeTotal}/>
          <StatCard link={metricLinks["b1_hkd_total"]} metricKey="b1_hkd_total" onOpenLink={handleOpenLink} onOpenQty={handleOpenQty} title="TỔNG SỐ HỘ KINH DOANH" value={hkdTotal}/>
          <StatCard link={metricLinks["b1_htx_total"]} metricKey="b1_htx_total" onOpenLink={handleOpenLink} onOpenQty={handleOpenQty} title="TỔNG SỐ HỢP TÁC XÃ" value={htxTotal}/>
        </div>
      </div>

      {/* CỤM 2: TỔNG SỐ CHUYỂN ĐỔI SỐ */}
      <div className="space-y-3.5 w-full">
        <BannerCard label="TỔNG SỐ DOANH NGHIỆP/ HKD/ HTX SỐ CHUYỂN ĐỔI SỐ:" link={metricLinks?.["b1_total_dx_units"]} metricKey="b1_total_dx_units" onOpenLink={handleOpenLink} onOpenQty={handleOpenQty} value={totalDxUnits}/>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 w-full">
          <StatCard subText={`Chiếm ${smeRatio}% (${smeDx}/${smeTotal})`} isDx link={metricLinks?.["b1_sme_dx"]} metricKey="b1_sme_dx" onOpenLink={handleOpenLink} onOpenQty={handleOpenQty} title="TỔNG SỐ DOANH NGHIỆP CHUYỂN ĐỔI SỐ" value={smeDx}/>
          <StatCard subText={`Chiếm ${hkdRatio}% (${hkdDx}/${hkdTotal})`} isDx link={metricLinks?.["b1_hkd_dx"]} metricKey="b1_hkd_dx" onOpenLink={handleOpenLink} onOpenQty={handleOpenQty} title="TỔNG SỐ HỘ KINH DOANH CHUYỂN ĐỔI SỐ" value={hkdDx}/>
          <StatCard subText={`Chiếm ${htxRatio}% (${htxDx}/${htxTotal})`} isDx link={metricLinks?.["b1_htx_dx"]} metricKey="b1_htx_dx" onOpenLink={handleOpenLink} onOpenQty={handleOpenQty} title="TỔNG SỐ HỢP TÁC XÃ CHUYỂN ĐỔI SỐ" value={htxDx}/>
        </div>
      </div>

      {/* VỊ TRÍ DƯỚI CÙNG: THẺ TỈ LỆ */}
      <div className="w-full bg-gradient-to-r from-slate-900/95 via-[#0d1f38]/90 to-slate-900/95 p-4 sm:p-5 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 shadow-lg space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400"/>
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              TỈ LỆ CĐS TỔNG TẤT CẢ ĐƠN VỊ KINH DOANH
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-xl sm:text-2xl font-black text-cyan-400">{totalDxRatio}%</span>
            <span className="text-xs text-slate-400">({totalDxUnits}/{totalUnits} đơn vị)</span>
          </div>
        </div>

        <div className="w-full bg-slate-800/90 h-3 rounded-full overflow-hidden p-0.5 border-x-2 border-b-2 border-[#1d293d] border-t-0">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-700 shadow-sm shadow-cyan-500/50"
            style={{ width: `${Math.min(Number(totalDxRatio), 100)}%` }}
          />
        </div>
      </div>

      {showBlockId && dashboard && (
        <BlockIdModal dashboard={dashboard} section="B1" currentId={dashboard.b1_custom_id} onClose={() => setShowBlockId(false)} onSaved={() => onChanged?.()} />
      )}
      {quantityState && dashboard && (
        <CellQuantityModal dashboard={dashboard} section="B1" field={quantityState.field} label={quantityState.label} currentValue={quantityState.current} matchTokens={quantityState.matchTokens} onClose={() => setQuantityState(null)} onSaved={() => onChanged?.()} />
      )}
      {metricIdState && dashboard && (
        <MetricIdModal
          dashboard={dashboard}
          metricKey={metricIdState.metricKey}
          label={LINK_LABELS[metricIdState.metricKey] ?? metricIdState.metricKey}
          baseDomain={dashboard.base_domain || dashboard.metadata?.base_domain || dashboard.domain_link || ""}
          initialId={metricIdState.metricId ?? ""}
          onClose={() => setMetricIdState(null)}
          onSave={onSaveMetricId ?? (async (metricKey: string, metricId: string) => {
            const base = (dashboard.base_domain || dashboard.metadata?.base_domain || dashboard.domain_link || "").trim().replace(/\/+$/, "");
            const fullUrl = base ? `${base}/${metricId}` : metricId;

            // 1) Ghi metric_id + URL vào bảng metric_links
            const linkRes = await fetch("/api/v1/metrics/set-link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dashboardId: dashboard.id,
                metricKey,
                targetUrl: fullUrl,
                metricId,
              }),
            });
            if (!linkRes.ok) {
              const d = await linkRes.json();
              throw new Error(d.error ?? "Lỗi lưu ID liên kết");
            }

            // 2) Cào dữ liệu qua API scrape-metric
            const scrapeRes = await fetch("/api/scrape-metric", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetUrl: fullUrl }),
            });
            const scrapeData = await scrapeRes.json();
            if (!scrapeRes.ok || !scrapeData.success || typeof scrapeData.value !== "number") {
              throw new Error(scrapeData?.error ?? "Không bóc tách được số liệu từ URL");
            }

            // 3) Cập nhật chỉ tiêu theo field mapping (B1)
            const field = QTY_MAP[metricKey]?.field;
            if (field) {
              const upRes = await fetch("/api/v1/metrics/update-value", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  dashboardId: dashboard.id,
                  section: "B1",
                  field,
                  fields: [field],
                  value: scrapeData.value,
                }),
              });
              if (!upRes.ok) {
                const d = await upRes.json();
                throw new Error(d.error ?? "Lỗi cập nhật số liệu");
              }
            }
          })}
          onSaved={() => onChanged?.()}
        />
      )}
    </div>
  );
}

export default B1Section;

interface BannerCardProps {
  label: string;
  value: number;
  metricKey: string;
  link?: string;
  onOpenLink?: (key: string) => void;
  onOpenQty?: (key: string) => void;
}

function BannerCard({ label, value, metricKey, link, onOpenLink, onOpenQty }: BannerCardProps) {
  const { isAdmin } = useAuth();
  const content = (
    <div
      className={`relative group w-full bg-[#0c1e38] px-4 sm:px-6 py-4 rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 flex justify-between items-center shadow-md ${
        link ? "cursor-pointer" : ""
      }`}
    >
      <span className="text-xs sm:text-base font-bold uppercase tracking-wide text-slate-100 flex items-center gap-1.5">
        {label}
        {link && <ExternalLink className="text-cyan-400 shrink-0" size={13}/>}
      </span>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
          {value.toLocaleString()}
        </span>
        {isAdmin && (
          <div className="flex gap-1 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onOpenLink) onOpenLink(metricKey);
              }}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-600 text-slate-300 hover:text-white border border-[#1d293d]"
              title="Thiết lập ID"
            >
              <LinkIcon size={13}/>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onOpenQty) onOpenQty(metricKey);
              }}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-emerald-600 text-slate-300 hover:text-white border border-[#1d293d]"
              title="Setup Số lượng"
            >
              <Edit3 size={13}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="block w-full">
        {content}
      </a>
    );
  }
  return content;
}

interface StatCardProps {
  title: string;
  value: number;
  subText?: string;
  metricKey: string;
  link?: string;
  isDx?: boolean;
  onOpenLink?: (key: string) => void;
  onOpenQty?: (key: string) => void;
}

function StatCard({ title, value, subText, metricKey, link, onOpenLink, onOpenQty }: StatCardProps) {
  const { isAdmin } = useAuth();
  const content = (
    <div
      className={`relative group p-4 sm:p-5 rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-gradient-to-b from-slate-900/90 to-[#0c1830]/90 transition-all duration-200 flex flex-col items-center justify-center text-center w-full ${
        link ? "cursor-pointer" : ""
      }`}
    >
      {isAdmin && (
        <div className="absolute top-2.5 right-2.5 flex gap-1 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onOpenLink) onOpenLink(metricKey);
            }}
            className="p-1 rounded-md bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
            title="Thiết lập ID"
          >
            <LinkIcon size={12}/>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onOpenQty) onOpenQty(metricKey);
            }}
            className="p-1 rounded-md bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors"
            title="Setup Số lượng"
          >
            <Edit3 size={12}/>
          </button>
        </div>
      )}

      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2 line-clamp-1 flex items-center gap-1">
        {title}
        {link && <ExternalLink className="text-cyan-400 shrink-0" size={10}/>}
      </p>
      <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">{value.toLocaleString()}</p>
      {subText && <p className="text-[11px] font-medium text-slate-400 mt-2">{subText}</p>}
    </div>
  );

  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="block w-full">
        {content}
      </a>
    );
  }
  return content;
}