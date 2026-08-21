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
      <div className="relative z-50 flex flex-col w-full max-w-6xl h-[92vh] max-h-[92vh] rounded-2xl glass-strong p-3.5 sm:p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2 shrink-0">
          <h3 className="text-xs sm:text-base font-bold uppercase tracking-wider text-accent truncate">
            DANH SÁCH DASHBOARD XÃ, PHƯỜNG THUỘC {provinceName.toUpperCase()}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground/60 transition hover:bg-white/10 hover:text-foreground shrink-0"
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
              className="w-full rounded-xl border border-white/10 bg-transparent py-2 pl-9 pr-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-accent"
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
              className="glass rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-accent flex-1 sm:flex-none"
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
                    className="glass group relative w-full rounded-2xl p-3.5 sm:p-4 text-left transition hover:-translate-y-0.5 hover:shadow-glass flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate text-slate-100">
                            {commune.unit?.name ?? commune.title}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs opacity-60">
                            {commune.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onViewDashboard(commune)}
                          className="glass shrink-0 rounded-lg p-1.5 text-foreground/60 transition hover:text-accent sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label="Xem Dashboard"
                          title="Xem Dashboard"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 w-full">
                        <div className="flex items-center justify-between text-xs">
                          <span className="opacity-60">Tỉ lệ CĐS Đơn vị KD</span>
                          <span className="font-semibold text-cyan-400">
                            {stats.ratioB1}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                          <div
                            className="h-full rounded-full bg-cyan-400 transition-all"
                            style={{ width: `${stats.ratioB1}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="opacity-60">Tỉ lệ CĐS Sản phẩm</span>
                          <span className="font-semibold text-amber-400">
                            {stats.ratioB2}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all"
                            style={{ width: `${stats.ratioB2}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="opacity-60">Tổng số đơn vị KD</span>
                          <span className="font-semibold">
                            {stats.totalBusiness.toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="opacity-60">Tổng số sản phẩm</span>
                          <span className="font-semibold">
                            {stats.totalProducts.toLocaleString("vi-VN")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center justify-end gap-1.5 border-t border-white/5 pt-3 w-full">
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditLink(commune)}
                            className="glass rounded-lg p-1.5 text-foreground/60 transition hover:text-accent"
                            aria-label="Thiết lập link"
                            title="Thiết lập link"
                          >
                            <Link2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditQuantity(commune)}
                            className="glass rounded-lg p-1.5 text-foreground/60 transition hover:text-accent"
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
                        className="glass rounded-lg px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:text-accent hover:bg-accent/20"
                        aria-label="Xem Dashboard"
                      >
                        Xem
                      </button>
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