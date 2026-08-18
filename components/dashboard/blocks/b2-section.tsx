"use client";

import React, { useState } from "react";
import { Package, Sparkles, Settings, Link as LinkIcon, Edit3 } from "lucide-react";
import { StatCell } from "./stat-cell";
import { CellLinkModal } from "./cell-link-modal";
import { CellQuantityModal } from "./cell-quantity-modal";
import { BlockIdModal } from "./block-id-modal";
import { useAuth } from "@/context/AuthContext";
import type { DashboardRow, KpiRow } from "@/lib/types";

interface B2SectionProps {
  dashboard: DashboardRow;
  b2: KpiRow;
  metricLinks: Record<string, string>;
  onChanged: () => void;
}

const num = (kpi: KpiRow, key: string): number => Number(kpi[key] ?? 0);

interface LinkState { metricKey: string; label: string; initialUrl: string; }
interface QuantityState { field: string; label: string; current: number; matchTokens: string[]; }

export function B2Section({ dashboard, b2, metricLinks, onChanged }: B2SectionProps) {
  const { isAdmin } = useAuth();
  const [showBlockId, setShowBlockId] = useState(false);
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const [quantityState, setQuantityState] = useState<QuantityState | null>(null);

  const ocop3 = num(b2, "ocop_3star");
  const ocop4 = num(b2, "ocop_4star");
  const ocop5 = num(b2, "ocop_5star");
  const spThuong = num(b2, "sp_thuong");
  const dichVu = num(b2, "dich_vu");

  const ocopTotal = ocop3 + ocop4 + ocop5;
  const otherTotal = spThuong + dichVu;
  const totalAll = ocopTotal + otherTotal;
  const pct = (part: number, whole: number) => whole > 0 ? ((part / whole) * 100).toFixed(1) : "0.0";

  // Banner Tổng Cụm 1 (OCOP) / Cụm 2 (SP Thường & Dịch vụ) tự chuyển thành <a> khi có link
  const banner1Link = metricLinks["b2_total_ocop"] || "";
  const banner2Link = metricLinks["b2_total_normal_service"] || "";
  const BannerTag1: "a" | "div" = banner1Link ? "a" : "div";
  const BannerTag2: "a" | "div" = banner2Link ? "a" : "div";
  const bannerProps1 = banner1Link ? { href: banner1Link, target: "_blank", rel: "noopener noreferrer" } : {};
  const bannerProps2 = banner2Link ? { href: banner2Link, target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <section className="mb-6 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0a1124]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      {/* Header Khối B2 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_-4px_rgba(245,158,11,0.5)]">
            <Package size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
              B2: Thông tin sản phẩm trên địa bàn - {dashboard.unit?.name ?? "Địa phương"}
            </h3>
            <p className="text-xs text-slate-400">Sản phẩm OCOP · Sản phẩm thường · Dịch vụ</p>
          </div>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setShowBlockId(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2 text-xs font-medium text-cyan-300 transition hover:text-cyan-200">
          <Settings size={14} /> Thiết lập ID
        </button>
        )}
      </div>

      <div className="space-y-6">
        {/* GRID 5 cột: Cụm OCOP 60% (3/5) - Cụm SP thường & Dịch vụ 40% (2/5) */}
        <div className="grid w-full grid-cols-1 lg:grid-cols-5 gap-5">
          {/* CỤM 1: SẢN PHẨM OCOP */}
          <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 shadow-xl sm:p-5 lg:col-span-3">
            <BannerTag1 {...bannerProps1} className="block">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-4 py-3">
              <span className="text-sm font-bold uppercase tracking-wide text-slate-300 sm:text-base">TỔNG SỐ SẢN PHẨM OCOP:</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-amber-400 tabular-nums sm:text-3xl">{ocopTotal.toLocaleString("vi-VN")}</span>
                {isAdmin && (
                  <>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLinkState({ metricKey: "b2_total_ocop", label: "OCOP 3 sao", initialUrl: metricLinks["b2_total_ocop"] || "" }); }}
                  className="rounded-lg border border-amber-500 bg-amber-500/10 p-2 text-amber-400 transition hover:text-amber-300 hover:bg-amber-500/20"
                  aria-label="Thiết lập link OCOP"
                  title="Thiết lập Link"
                >
                  <LinkIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuantityState({ field: "ocop_3star", label: "OCOP 3 sao", current: ocop3, matchTokens: ["ocop 3 sao", "ocop_3star"] }); }}
                  className="rounded-lg border border-cyan-500 bg-cyan-500/10 p-2 text-cyan-400 transition hover:text-cyan-300 hover:bg-cyan-500/20"
                  aria-label="Setup số lượng OCOP"
                  title="Setup Số lượng"
                >
                  <Edit3 size={14} />
                </button>
                  </>
                )}
              </div>
            </div>
            </BannerTag1>
            <div className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-5">
              <StatCell label="OCOP 3 SAO" value={ocop3} unit="SP" color="#f59e0b"
                targetUrl={metricLinks["b2_ocop_3"]}
                onEditLink={() => setLinkState({ metricKey: "b2_ocop_3", label: "OCOP 3 sao", initialUrl: metricLinks["b2_ocop_3"] || "" })}
                onEditQuantity={() => setQuantityState({ field: "ocop_3star", label: "OCOP 3 sao", current: ocop3, matchTokens: ["ocop 3 sao", "ocop_3star"] })} />
              <StatCell label="OCOP 4 SAO" value={ocop4} unit="SP" color="#f59e0b"
                targetUrl={metricLinks["b2_ocop_4"]}
                onEditLink={() => setLinkState({ metricKey: "b2_ocop_4", label: "OCOP 4 sao", initialUrl: metricLinks["b2_ocop_4"] || "" })}
                onEditQuantity={() => setQuantityState({ field: "ocop_4star", label: "OCOP 4 sao", current: ocop4, matchTokens: ["ocop 4 sao", "ocop_4star"] })} />
              <StatCell label="OCOP 5 SAO" value={ocop5} unit="SP" color="#f59e0b"
                targetUrl={metricLinks["b2_ocop_5"]}
                onEditLink={() => setLinkState({ metricKey: "b2_ocop_5", label: "OCOP 5 sao", initialUrl: metricLinks["b2_ocop_5"] || "" })}
                onEditQuantity={() => setQuantityState({ field: "ocop_5star", label: "OCOP 5 sao", current: ocop5, matchTokens: ["ocop 5 sao", "ocop_5star"] })} />
            </div>
          </div>
{/* CỤM 2: SẢN PHẨM THƯỜNG & DỊCH VỤ */}
          <div className="w-full rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 shadow-xl sm:p-5 lg:col-span-2">
            <BannerTag2 {...bannerProps2} className="block">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 px-4 py-3">
              <span className="text-sm font-bold uppercase tracking-wide text-slate-300 sm:text-base">TỔNG SỐ SP THƯỜNG & DỊCH VỤ:</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-blue-400 tabular-nums sm:text-3xl">{otherTotal.toLocaleString("vi-VN")}</span>
                {isAdmin && (
                  <>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLinkState({ metricKey: "b2_total_normal_service", label: "Sản phẩm thường", initialUrl: metricLinks["b2_total_normal_service"] || "" }); }}
                  className="rounded-lg border border-amber-500 bg-amber-500/10 p-2 text-amber-400 transition hover:text-amber-300 hover:bg-amber-500/20"
                  aria-label="Thiết lập link SP thường"
                  title="Thiết lập Link"
                >
                  <LinkIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuantityState({ field: "sp_thuong", label: "Sản phẩm thường", current: spThuong, matchTokens: ["sản phẩm thường", "sp thường"] }); }}
                  className="rounded-lg border border-cyan-500 bg-cyan-500/10 p-2 text-cyan-400 transition hover:text-cyan-300 hover:bg-cyan-500/20"
                  aria-label="Setup số lượng SP thường"
                  title="Setup Số lượng"
                >
                  <Edit3 size={14} />
                </button>
                  </>
                )}
              </div>
            </div>
            </BannerTag2>
            <div className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 mt-5">
              <StatCell label="SẢN PHẨM THƯỜNG" value={spThuong} unit="SP" color="#3b82f6"
                targetUrl={metricLinks["b2_sp_thuong"]}
                onEditLink={() => setLinkState({ metricKey: "b2_sp_thuong", label: "Sản phẩm thường", initialUrl: metricLinks["b2_sp_thuong"] || "" })}
                onEditQuantity={() => setQuantityState({ field: "sp_thuong", label: "Sản phẩm thường", current: spThuong, matchTokens: ["sản phẩm thường", "sp thường"] })} />
              <StatCell label="TỔNG SỐ DỊCH VỤ" value={dichVu} unit="DV" color="#a855f7"
                targetUrl={metricLinks["b2_dich_vu"]}
                onEditLink={() => setLinkState({ metricKey: "b2_dich_vu", label: "Dịch vụ", initialUrl: metricLinks["b2_dich_vu"] || "" })}
                onEditQuantity={() => setQuantityState({ field: "dich_vu", label: "Dịch vụ", current: dichVu, matchTokens: ["dịch vụ", "dv"] })} />
            </div>
          </div>
        </div>
      </div>
{/* Tỷ lệ sản phẩm & dịch vụ */}
      <div className="mt-6 rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold uppercase tracking-wide text-cyan-300">Tỉ lệ sản phẩm & dịch vụ</span>
          <Sparkles size={16} className="text-amber-400" />
        </div>
        <div className="relative mt-2 h-4 w-full overflow-hidden rounded-full border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-slate-900">
          {totalAll > 0 ? (
            <div className="flex h-full">
              <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${(ocopTotal / totalAll) * 100}%` }} />
              <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${(spThuong / totalAll) * 100}%` }} />
              <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${(dichVu / totalAll) * 100}%` }} />
            </div>
          ) : (
            <div className="h-full w-0 bg-slate-700 transition-all duration-700" />
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-800/50 px-3 py-2">
            <span className="flex items-center gap-2 text-xs text-slate-300">
              <span className="h-3 w-3 rounded-full bg-amber-500" /> OCOP
            </span>
            <span className="font-bold text-amber-400 tabular-nums">{totalAll > 0 ? `${pct(ocopTotal, totalAll)}%` : "0.0%"} ({ocopTotal})</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-800/50 px-3 py-2">
            <span className="flex items-center gap-2 text-xs text-slate-300">
              <span className="h-3 w-3 rounded-full bg-blue-500" /> SP Thường
            </span>
            <span className="font-bold text-blue-400 tabular-nums">{totalAll > 0 ? `${pct(spThuong, totalAll)}%` : "0.0%"} ({spThuong})</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-800/50 px-3 py-2">
            <span className="flex items-center gap-2 text-xs text-slate-300">
              <span className="h-3 w-3 rounded-full bg-indigo-500" /> Dịch vụ
            </span>
            <span className="font-bold text-indigo-400 tabular-nums">{totalAll > 0 ? `${pct(dichVu, totalAll)}%` : "0.0%"} ({dichVu})</span>
          </div>
        </div>
      </div>

      {showBlockId && (<BlockIdModal dashboard={dashboard} section="B2" currentId={dashboard.b2_custom_id} onClose={() => setShowBlockId(false)} onSaved={onChanged} />)}
      {linkState && (<CellLinkModal dashboard={dashboard} metricKey={linkState.metricKey} label={linkState.label} initialUrl={linkState.initialUrl} onClose={() => setLinkState(null)} onSaved={onChanged} />)}
      {quantityState && (<CellQuantityModal dashboard={dashboard} section="B2" field={quantityState.field} label={quantityState.label} currentValue={quantityState.current} matchTokens={quantityState.matchTokens} onClose={() => setQuantityState(null)} onSaved={onChanged} />)}
    </section>
  );
}

export default B2Section;
