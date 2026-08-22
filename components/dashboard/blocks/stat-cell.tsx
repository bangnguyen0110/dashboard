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
}: StatCellProps) {
  const { isAdmin } = useAuth();

  const rawUrl = (targetUrl ?? "").trim();
  const resolvedUrl = rawUrl
    ? (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`)
    : "";
  const hasLink = Boolean(resolvedUrl);

  const boxClass = `group relative overflow-hidden rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 w-full bg-linear-to-b from-slate-900/90 to-[#0c1830]/90 p-4 transition duration-300 select-none ${
    fullWidth ? "col-span-full" : ""
  } ${hasLink ? "hover:-translate-y-0.5 cursor-pointer hover:border-cyan-500/40" : ""}`;

  const inner = (
    <>
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-15 blur-2xl"
        style={{ background: color }}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-relaxed opacity-75 sm:text-sm">{label}</p>

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
                className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-2 text-amber-400/60 transition hover:text-amber-400 hover:bg-slate-700"
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
                className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-2 text-cyan-400/60 transition hover:text-cyan-400 hover:bg-slate-700"
              >
                <PencilLine size={14} />
              </button>
            )}
          </span>
        )}
      </div>

      <p className="mt-2 text-2xl font-bold text-emerald-400 tabular-nums">
        {value.toLocaleString("vi-VN")}
        {unit ? <span className="ml-1 text-xs font-medium opacity-60">{unit}</span> : null}
      </p>

      {subText ? (
        <p className="mt-1 text-[11px] font-medium" style={{ color: subColor }}>
          {subText}
        </p>
      ) : null}

      {hasLink ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-cyan-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          Bấm ô để mở link
          <ExternalLink size={11} />
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] opacity-40">Chưa cài link</p>
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
