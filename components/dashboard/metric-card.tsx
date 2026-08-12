"use client";

import { ExternalLink, Settings } from "lucide-react";

export type MetricValueInfo = {
  value: number;
  goal: number | null;
  count: number;
};

export type MetricDef = {
  key: string;
  label: string;
  unit: string;
  color: string;
};

type MetricCardProps = {
  metric: MetricDef;
  info: MetricValueInfo;
  targetUrl: string;
  onEditLink: () => void;
};

export function MetricCard({ metric, info, targetUrl, onEditLink }: MetricCardProps) {
  const handleOpen = () => {
    if (targetUrl) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  const pct =
    info.goal !== null && info.goal > 0
      ? Math.min(100, Math.round((info.value / info.goal) * 100))
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleOpen();
      }}
      className={`glass group relative cursor-pointer overflow-hidden rounded-2xl p-5 transition duration-300 select-none hover:-translate-y-1 ${
        targetUrl
          ? "hover:shadow-[0_0_42px_-6px_var(--accent)]"
          : "hover:shadow-glass"
      }`}
      style={{ borderTop: `2px solid ${metric.color}` }}
    >
      {/* glow phía góc */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-20 blur-2xl"
        style={{ background: metric.color }}
      />

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium opacity-80">{metric.label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {info.value.toLocaleString("vi-VN")}
            {metric.unit ? (
              <span className="ml-1.5 text-sm font-medium opacity-60">{metric.unit}</span>
            ) : null}
          </p>
        </div>

        {/* Icon bánh răng ⚙️: nhập/sửa link chuyển hướng */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditLink();
          }}
          aria-label={`Cài đặt link chuyển hướng cho ${metric.label}`}
          title="Cài đặt link chuyển hướng"
          className="glass gear rounded-lg p-2 text-foreground/60 transition hover:text-accent"
        >
          <Settings size={16} />
        </button>
      </div>

      {info.goal !== null ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs opacity-70">
            <span>Mục tiêu: {info.goal.toLocaleString("vi-VN")}</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct ?? 0}%`, background: metric.color }}
            />
          </div>
        </div>
      ) : null}

      {targetUrl ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Đã cài link — bấm thẻ để mở
          <ExternalLink size={12} />
        </p>
      ) : (
        <p className="mt-3 text-xs opacity-50">Chưa cài link chuyển hướng</p>
      )}
    </div>
  );
}