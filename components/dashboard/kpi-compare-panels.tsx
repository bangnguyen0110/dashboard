"use client";

/**
 * Khối giao diện của tính năng "Bộ lọc và so sánh thông tin":
 * - Bảng đối chiếu chi tiết (kỳ hiện tại vs kỳ so sánh)
 * - Thẻ chênh lệch + biểu đồ cột minh hoạ mức tăng/giảm
 * - Skeleton (đang tải), Empty State (không có dữ liệu), Notice (cảnh báo/thông tin)
 *
 * Thuần trình bày (presentational) — không truy cập Supabase, không ghi dữ liệu.
 */

import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Inbox,
  Info,
  Minus,
  Table2,
  TriangleAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu & định dạng                                            */
/* ------------------------------------------------------------------ */

export interface CompareMetricDef {
  /** Khoá chỉ số sau khi chuẩn hoá (VD: sme_total, ocop_total…). */
  key: string;
  /** Nhãn đầy đủ hiển thị trong bảng. */
  label: string;
  /** Nhãn ngắn hiển thị trên trục biểu đồ. */
  short: string;
  unit: string;
  color: string;
}

export interface CompareRowResult {
  def: CompareMetricDef;
  current: number;
  /** null khi chưa có mốc dữ liệu kỳ so sánh. */
  previous: number | null;
  diff: number | null;
}

export type NoticeTone = "info" | "warning" | "error";

const valueFormatter = new Intl.NumberFormat("vi-VN");

const tooltipStyle: CSSProperties = {
  background: "var(--glass-bg-strong)",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  color: "var(--foreground)",
  backdropFilter: "blur(12px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
};

export function formatMetricValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return valueFormatter.format(value);
}

export function formatDelta(diff: number | null | undefined): string {
  if (diff === null || diff === undefined || Number.isNaN(diff)) return "—";
  if (diff === 0) return "0";
  return `${diff > 0 ? "+" : "-"}${valueFormatter.format(Math.abs(diff))}`;
}

/** % thay đổi so với kỳ trước; trả về null khi kỳ trước bằng 0 hoặc chưa có dữ liệu. */
export function formatDeltaPercent(previous: number | null, diff: number | null): string | null {
  if (previous === null || diff === null || previous === 0) return null;
  const percent = (diff / previous) * 100;
  const rounded = Math.abs(percent) >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/* ------------------------------------------------------------------ */
/* Skeleton / Empty / Notice                                            */
/* ------------------------------------------------------------------ */

export function PanelSkeleton({ rows = 6, withChart = false }: { rows?: number; withChart?: boolean }) {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-9 w-full animate-pulse rounded-xl bg-white/10" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-6 w-full animate-pulse rounded-lg bg-white/10"
          style={{ animationDelay: `${index * 60}ms` }}
        />
      ))}
      {withChart && <div className="h-[210px] w-full animate-pulse rounded-xl bg-white/10" />}
    </div>
  );
}

export function CompareEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5">
        <Inbox size={26} className="opacity-60" />
      </div>
      <p className="text-sm font-semibold sm:text-base">{title}</p>
      {description && (
        <p className="max-w-xl text-xs leading-relaxed opacity-70 sm:text-sm">{description}</p>
      )}
    </div>
  );
}

export function CompareNotice({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  const toneClass =
    tone === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";

  const Icon = tone === "info" ? Info : TriangleAlert;

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed sm:text-xs ${toneClass}`}
      role="status"
    >
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
/* ------------------------------------------------------------------ */
/* Thẻ: Bảng đối chiếu (cột trái)                                       */
/* ------------------------------------------------------------------ */

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) {
    return <span className="text-xs opacity-50">—</span>;
  }
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold opacity-60">
        <Minus size={13} /> 0
      </span>
    );
  }
  const up = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        up ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
      }`}
    >
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {formatDelta(diff)}
    </span>
  );
}

export function CompareTableCard({
  title,
  subtitle,
  rows,
  compareLabel,
  currentLabel,
  loading,
}: {
  title: string;
  subtitle?: string;
  rows: CompareRowResult[];
  compareLabel: string;
  currentLabel: string;
  loading: boolean;
}) {
  return (
    <section className="glass flex h-full flex-col rounded-2xl p-4 sm:p-5">
      <header className="mb-3 flex items-start gap-2 border-b border-white/5 pb-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-accent">
          <Table2 size={15} />
        </span>
        <div className="min-w-0">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-accent sm:text-xs">
            {title}
          </h4>
          {subtitle && <p className="mt-0.5 text-[11px] leading-relaxed opacity-60">{subtitle}</p>}
        </div>
      </header>

      {loading ? (
        <PanelSkeleton rows={6} />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[430px] border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider opacity-60 sm:text-[11px]">
                <th className="py-2 pr-2 text-left font-semibold">Chỉ số</th>
                <th className="py-2 pr-2 text-right font-semibold">{compareLabel}</th>
                <th className="py-2 pr-2 text-right font-semibold">{currentLabel}</th>
                <th className="py-2 text-right font-semibold">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.def.key} className="border-t border-white/5">
                  <td className="py-2.5 pr-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: row.def.color }}
                      />
                      <span className="min-w-0">
                        {row.def.label}
                        <span className="ml-1 text-[10px] opacity-50">({row.def.unit})</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-right font-mono tabular-nums opacity-80">
                    {formatMetricValue(row.previous)}
                  </td>
                  <td className="py-2.5 pr-2 text-right font-mono font-semibold tabular-nums">
                    {formatMetricValue(row.current)}
                  </td>
                  <td className="py-2.5 text-right">
                    <DiffBadge diff={row.diff} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs opacity-50">
                    Không có chỉ số nào để hiển thị.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
/* ------------------------------------------------------------------ */
/* Thẻ: Chênh lệch & Biểu đồ (cột phải)                                 */
/* ------------------------------------------------------------------ */

export function CompareDiffCard({
  title,
  subtitle,
  rows,
  loading,
}: {
  title: string;
  subtitle?: string;
  rows: CompareRowResult[];
  loading: boolean;
}) {
  const comparable = rows.filter((row) => row.diff !== null);
  const increased = comparable.filter((row) => (row.diff ?? 0) > 0).length;
  const decreased = comparable.filter((row) => (row.diff ?? 0) < 0).length;
  const unchanged = comparable.filter((row) => (row.diff ?? 0) === 0).length;
  const hasCompareData = comparable.length > 0;

  const chartData = comparable.map((row) => ({
    key: row.def.key,
    name: row.def.short,
    label: row.def.label,
    diff: row.diff as number,
  }));

  return (
    <section className="glass flex h-full flex-col rounded-2xl p-4 sm:p-5">
      <header className="mb-3 flex items-start gap-2 border-b border-white/5 pb-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-amber-400">
          <BarChart3 size={15} />
        </span>
        <div className="min-w-0">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 sm:text-xs">
            {title}
          </h4>
          {subtitle && <p className="mt-0.5 text-[11px] leading-relaxed opacity-60">{subtitle}</p>}
        </div>
      </header>

      {loading ? (
        <PanelSkeleton rows={4} withChart />
      ) : !hasCompareData ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <BarChart3 size={22} className="opacity-40" />
          <p className="text-xs opacity-60 sm:text-sm">
            Chưa có mốc dữ liệu kỳ trước nên chưa thể tính chênh lệch.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight size={13} /> Tăng: {increased}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-semibold text-red-600 dark:text-red-400">
              <ArrowDownRight size={13} /> Giảm: {decreased}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold opacity-70">
              <Minus size={13} /> Không đổi: {unchanged}
            </span>
          </div>

          <div className="space-y-1.5">
            {comparable.map((row) => {
              const diff = row.diff as number;
              const percent = formatDeltaPercent(row.previous, row.diff);
              const up = diff > 0;
              const flat = diff === 0;
              return (
                <div
                  key={row.def.key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.def.color }} />
                    <span className="truncate text-[11px] opacity-80 sm:text-xs">{row.def.label}</span>
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold tabular-nums sm:text-xs ${
                      flat
                        ? "opacity-60"
                        : up
                          ? "text-emerald-500 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    {flat ? <Minus size={12} /> : up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {formatDelta(diff)}
                    {percent && <span className="ml-1 font-normal opacity-70">({percent})</span>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-1 h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={54}
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={42}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "var(--foreground)" }}
                  labelStyle={{ color: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
                  labelFormatter={(_label: unknown, payload: unknown) => {
                    const items = Array.isArray(payload) ? payload : [];
                    const first = items[0] as { payload?: { label?: string } } | undefined;
                    return first?.payload?.label ?? "";
                  }}
                  formatter={(value: unknown) => [formatDelta(Number(value)), "Chênh lệch"]}
                />
                <Bar dataKey="diff" radius={[6, 6, 0, 0]} maxBarSize={46}>
                  {chartData.map((item) => (
                    <Cell
                      key={item.key}
                      fill={item.diff > 0 ? "#34d399" : item.diff < 0 ? "#f87171" : "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] opacity-50 sm:text-[11px]">
            Cột xanh = tăng so với kỳ so sánh · Cột đỏ = giảm · Cột xám = không đổi.
          </p>
        </div>
      )}
    </section>
  );
}