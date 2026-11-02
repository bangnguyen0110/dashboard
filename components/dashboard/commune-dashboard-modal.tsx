"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Link2,
  PencilLine,
  ExternalLink,
  X,
} from "lucide-react";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

const ITEMS_PER_PAGE = 18;
const RATE_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

interface ComStats {
  totalBusiness: number;
  cdsBusiness: number;
  ratioB1: number;
  totalProducts: number;
  ratioB2: number;
}

interface CommuneDashboardModalProps {
  open: boolean;
  provinceName: string;
  communes: DashboardRow[];
  communeKpi: Record<string, { b1?: KpiRow; b2?: KpiRow }>;
  onEditLink: (commune: DashboardRow) => void;
  onEditQuantity: (commune: DashboardRow) => void;
  onViewDashboard: (commune: DashboardRow) => void;
  onClose: () => void;
}

function computeStats(
  commune: DashboardRow,
  communeKpi: Record<string, { b1?: KpiRow; b2?: KpiRow }>
): ComStats {
  const b1 = communeKpi[commune.id]?.b1 ?? {};
  const b2 = communeKpi[commune.id]?.b2 ?? {};
  const totalBusiness =
    Number(b1.sme_total ?? 0) +
    Number(b1.hkd_total ?? 0) +
    Number(b1.htx_total ?? 0);
  const cdsBusiness =
    Number(b1.sme_cds ?? 0) +
    Number(b1.hkd_cds ?? 0) +
    Number(b1.htx_cds ?? 0);
  const ratioB1 =
    totalBusiness > 0 ? Math.round((cdsBusiness / totalBusiness) * 100) : 0;
  const ocopTotal =
    Number(b2.ocop_3star ?? 0) +
    Number(b2.ocop_4star ?? 0) +
    Number(b2.ocop_5star ?? 0);
  const totalProducts =
    ocopTotal + Number(b2.sp_thuong ?? 0) + Number(b2.dich_vu ?? 0);
  const ratioB2 =
    totalProducts > 0 ? Math.round((ocopTotal / totalProducts) * 100) : 0;
  return { totalBusiness, cdsBusiness, ratioB1, totalProducts, ratioB2 };
}

export function CommuneDashboardModal({
  open,
  provinceName,
  communes,
  communeKpi,
  onEditLink,
  onEditQuantity,
  onViewDashboard,
  onClose,
}: CommuneDashboardModalProps) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [rateFilter, setRateFilter] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return communes.filter((c) => {
      if (q && !(c.unit?.name ?? c.title).toLowerCase().includes(q)) {
        return false;
      }
      if (rateFilter != null) {
        const stats = computeStats(c, communeKpi);
        if (stats.ratioB1 < rateFilter) return false;
      }
      return true;
    });
  }, [communes, communeKpi, search, rateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );
  const start = filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const end = Math.min(page * ITEMS_PER_PAGE, filtered.length);

  const pageNumbers = useMemo(() => {
    const total = totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const delta = 1;
    const range: (number | string)[] = [1];
    const left = Math.max(2, page - delta);
    const right = Math.min(total - 1, page + delta);
    if (left > 2) range.push("…");
    for (let i = left; i <= right; i++) range.push(i);
    if (right < total - 1) range.push("…");
    range.push(total);
    return range;
  }, [totalPages, page]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative z-50 flex flex-col w-full max-w-6xl h-[92vh] max-h-[92vh] rounded-xl glass-strong p-3.5 sm:p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2 shrink-0 border-b border-[#bfd7ee] dark:border-white/5 pb-3">
          <h3 className="text-xs sm:text-base font-bold uppercase tracking-wider text-accent truncate">
            DANH SÁCH DASHBOARD XÃ, PHƯỜNG THUỘC {provinceName.toUpperCase()}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-foreground/60 transition hover:bg-white/10 hover:text-foreground shrink-0"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Bộ lọc tìm kiếm */}
        <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative flex-1 w-full">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm tên xã / phường / đặc khu..."
              className="w-full rounded-xl border border-[#bfd7ee] dark:border-white/10 bg-white dark:bg-transparent py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2">
            <select
              value={rateFilter ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setRateFilter(v === "" ? null : Number(v));
                setPage(1);
              }}
              className="rounded-xl border border-[#bfd7ee] dark:border-white/10 bg-white dark:bg-[#0c1830] px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-accent flex-1 sm:flex-none"
            >
              <option value="">Tất cả tỷ lệ</option>
              {RATE_OPTIONS.filter((r) => r > 0).map((r) => (
                <option key={r} value={r}>
                  ≥ {r}%
                </option>
              ))}
            </select>
            <span className="text-[11px] sm:text-xs opacity-60 shrink-0">
              {filtered.length} dashboard
            </span>
          </div>
        </div>

        {/* Khu vực cuộn danh sách thẻ (100% width trên mobile) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full pr-1">
          <div className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3 w-full">
            {paged.length === 0 ? (
              <p className="col-span-full py-12 text-center text-sm opacity-50">
                Không có dashboard nào khớp bộ lọc.
              </p>
            ) : (
              paged.map((commune) => {
                const stats = computeStats(commune, communeKpi);
                return (
                  <div
                    key={commune.id}
                    className="bg-white dark:bg-[#0a1830] rounded-xl flex flex-col overflow-hidden border border-[#bfd7ee] dark:border-[#25427b] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md group relative w-full text-left"
                  >
                    {/* Card Header với độ tương phản cao */}
                    <div className="bg-blue-100 dark:bg-[#1a3263] px-5 py-3.5 border-b border-[#bfd7ee] dark:border-[#25427b] flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate text-blue-900 dark:text-blue-100">
                          {commune.unit?.name ?? commune.title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-blue-600 dark:text-blue-400">
                          {commune.title}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onViewDashboard(commune)}
                        className="rounded-xl border border-[#bfd7ee] dark:border-white/10 bg-white/70 dark:bg-white/5 p-1.5 text-blue-700 dark:text-foreground/60 transition hover:bg-white hover:text-blue-900 dark:hover:text-accent shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Xem Dashboard"
                        title="Xem Dashboard"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400">Tỉ lệ CĐS Đơn vị KD</span>
                          <span className="font-semibold text-blue-600 dark:text-cyan-400">
                            {stats.ratioB1}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/15 border border-[#bfd7ee]/50 dark:border-transparent">
                          <div
                            className="h-full rounded-full bg-blue-600 dark:bg-cyan-400 transition-all"
                            style={{ width: `${stats.ratioB1}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-600 dark:text-slate-400">Tỉ lệ CĐS Sản phẩm</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {stats.ratioB2}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/15 border border-[#bfd7ee]/50 dark:border-transparent">
                          <div
                            className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all"
                            style={{ width: `${stats.ratioB2}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-600 dark:text-slate-400">Tổng số đơn vị KD</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {stats.totalBusiness.toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400">Tổng số sản phẩm</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {stats.totalProducts.toLocaleString("vi-VN")}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3.5 flex items-center justify-end gap-1.5 border-t border-[#bfd7ee]/70 dark:border-white/5 pt-3 w-full">
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditLink(commune)}
                              className="rounded-xl border border-[#bfd7ee] dark:border-white/10 bg-slate-50 dark:bg-white/5 p-1.5 text-slate-600 dark:text-slate-300 transition hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:text-accent"
                              aria-label="Thiết lập link"
                              title="Thiết lập link"
                            >
                              <Link2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditQuantity(commune)}
                              className="rounded-xl border border-[#bfd7ee] dark:border-white/10 bg-slate-50 dark:bg-white/5 p-1.5 text-slate-600 dark:text-slate-300 transition hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:text-accent"
                              aria-label="Setup số lượng"
                              title="Setup số lượng"
                            >
                              <PencilLine size={14} />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onViewDashboard(commune)}
                          className="rounded-xl border border-[#bfd7ee] dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 transition hover:bg-blue-100 dark:hover:bg-blue-800/50"
                          aria-label="Xem Dashboard"
                        >
                          Xem
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Phân trang */}
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5 shrink-0">
          <span className="text-[11px] sm:text-xs opacity-60">
            {filtered.length === 0
              ? "0 / 0"
              : `${start}–${end} / ${filtered.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="glass inline-flex items-center justify-center rounded-xl p-1.5 text-sm disabled:opacity-40"
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((n, i) =>
              n === "…" ? (
                <span key={`dots-${i}`} className="px-1 text-xs sm:text-sm opacity-50">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n as number)}
                  className={`rounded-xl px-2 sm:px-2.5 py-1 text-xs sm:text-sm font-medium ${
                    page === n
                      ? "bg-accent text-white"
                      : "glass opacity-70 hover:opacity-100"
                  }`}
                >
                  {n}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="glass inline-flex items-center justify-center rounded-xl p-1.5 text-sm disabled:opacity-40"
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}