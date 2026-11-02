"use client";

import { ExternalLink, Link2, PencilLine } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * Ô chỉ tiêu dùng chung trong khối B1 / B2.
 * - Giá trị lớn ở giữa, có 2 icon hành động: "Thiết lập ID" và "Setup Số lượng".
 * - Bấm toàn bộ ô sẽ mở `targetUrl` trong tab mới nếu có link.
 */

interface StatCellProps {
  label: string;
  value: number;
  unit?: string;
  color?: string;
  /** true = hàng rộng 100% cụm (dùng cho Tổng sản phẩm OCOP). */
  fullWidth?: boolean;
  targetUrl?: string;
  onEditLink?: () => void;
  onEditQuantity?: () => void;
  /** Dòng phụ nhỏ hiển thị dưới giá trị (dùng cho "Tỉ lệ %" Cụm 2). */
  subText?: string;
  subColor?: string;
  accentBorder?: string;
  iconBg?: string;
  icon?: React.ElementType;
}

export function StatCell({
  label,
  value,
  unit,
  color = "var(--accent-emerald)",
  fullWidth = false,
  targetUrl,
  onEditLink,
  onEditQuantity,
  subText,
  subColor = "var(--accent-emerald)",
  accentBorder = "border-l-blue-500",
  iconBg = "bg-blue-50 text-blue-600",
  icon: Icon,
}: StatCellProps) {
  const { isAdmin } = useAuth();

  const rawUrl = (targetUrl ?? "").trim();
  const resolvedUrl = rawUrl
    ? (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`)
    : "";
  const hasLink = Boolean(resolvedUrl);

  const boxClass = `group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 select-none shadow-sm hover:shadow-md border-l-4 ${accentBorder} dark:border-x-2 dark:border-b-2 dark:border-[#1d293d] dark:border-t-0 dark:border-l-4 dark:border-l-transparent dark:bg-linear-to-b dark:from-slate-900/90 dark:to-[#0c1830]/90 dark:shadow-none dark:hover:shadow-none w-full ${
    fullWidth ? "col-span-full" : ""
  } ${hasLink ? "hover:-translate-y-0.5 cursor-pointer dark:hover:border-cyan-500/40" : ""}`;

  const inner = (
    <>
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-15 blur-2xl dark:opacity-20"
        style={{ background: color }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${iconBg} dark:border dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-cyan-400 transition-colors`}
            >
              <Icon size={16} />
            </span>
          )}
          <p className="text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-300 dark:opacity-75 sm:text-sm truncate">
            {label}
          </p>
        </div>

        {isAdmin && (onEditLink || onEditQuantity) && (
          <span className="flex shrink-0 items-center gap-1 z-10">
            {onEditLink && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEditLink();
                }}
                aria-label={`Thiết lập ID cho ${label}`}
                title="Thiết lập ID"
                className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-amber-400/60 dark:hover:text-amber-400 dark:hover:bg-slate-700 transition"
              >
                <Link2 size={14} />
              </button>
            )}
            {onEditQuantity && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEditQuantity();
                }}
                aria-label={`Setup số lượng cho ${label}`}
                title="Setup số lượng (nhập tay / PDF)"
                className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:text-cyan-600 hover:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-cyan-400/60 dark:hover:text-cyan-400 dark:hover:bg-slate-700 transition"
              >
                <PencilLine size={14} />
              </button>
            )}
          </span>
        )}
      </div>

      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-emerald-400 tabular-nums">
        {value.toLocaleString("vi-VN")}
        {unit ? (
          <span className="ml-1 text-xs font-medium text-slate-500 dark:opacity-60">{unit}</span>
        ) : null}
      </p>

      {subText ? (
        <p className="mt-1 text-[11px] font-medium" style={{ color: subColor }}>
          {subText}
        </p>
      ) : null}

      {hasLink ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-cyan-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600 dark:bg-cyan-400" />
          Bấm ô để mở link
          <ExternalLink size={11} />
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-400 dark:opacity-40">Xem chi tiết</p>
      )}
    </>
  );

  if (hasLink) {
    return (
      <a
        href={resolvedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={boxClass}
      >
        {inner}
      </a>
    );
  }

  return <div className={boxClass}>{inner}</div>;
}
