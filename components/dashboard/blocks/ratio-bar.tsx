"use client";

/**
 * Thanh hiển thị Tỉ lệ CĐS (phần trăm) dạng Badge + Progress bar.
 * Dùng trong thẻ Dashboard Xã/Phường ở danh sách.
 */

interface RatioBarProps {
  label: string;
  percent: number;
  color?: string;
}

export function RatioBar({ label, percent, color = "var(--accent-cyan)" }: RatioBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="opacity-70">{label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {clamped}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800/50">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </div>
  );
}
