"use client";

import { memo } from "react";
import {
  Edit3,
  ExternalLink,
  Globe,
  Link2,
  Trash2,
} from "lucide-react";
import type { DashboardRow } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

/**
 * Thẻ Dashboard Tỉnh ở trang danh sách.
 * Bấm vào thẻ -> điều hướng tới `/[provinceId]`.
 * Kèm 2 nút hành động: "Thiết lập Link" và "Setup thông số".
 */

interface ProvinceCardProps {
  dashboard: DashboardRow;
  onOpen: (dashboard: DashboardRow) => void;
  onSetupLink: (dashboard: DashboardRow) => void;
  onSetupMetrics: (dashboard: DashboardRow) => void;
  onEdit: (dashboard: DashboardRow) => void;
  onDelete: (dashboard: DashboardRow) => void;
}

function ActionButton({
  label,
  onClick,
  className = "",
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${className}`}
    >
      {label}
    </button>
  );
}

function ProvinceCardImpl({
  dashboard,
  onOpen,
  onSetupLink,
  onSetupMetrics,
  onEdit,
  onDelete,
}: ProvinceCardProps) {
  const unitName = dashboard.unit?.name ?? dashboard.title;
  const level = dashboard.metadata?.level ?? 1;
  const metricCount = Object.keys(dashboard.metadata?.metrics ?? {}).length;
  const { isAdmin } = useAuth();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(dashboard)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(dashboard);
        }
      }}
      className="glass group relative flex cursor-pointer flex-col rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-glass"
    >
      {/* Quầng sáng góc trên */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/15 opacity-0 blur-2xl transition group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <Globe size={18} />
        </div>
        <span className="glass inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-accent">
          Tầng {level}
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold leading-snug">{unitName}</h3>
      <p className="mt-1 line-clamp-1 text-xs opacity-60">
        {dashboard.title}
      </p>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] opacity-50">
        <Link2 size={12} />
        <span className="line-clamp-1">
          {dashboard.domain_link
            ? dashboard.domain_link.replace(/^https?:\/\//, "")
            : "Chưa thiết lập link"}
        </span>
      </div>

      <div className="mt-2 text-[11px] opacity-50">
        {metricCount > 0
          ? `${metricCount} chỉ tiêu đã thiết lập`
          : "Chưa có thông số nào"}
      </div>

      {/* Hành động (chỉ Admin) */}
      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3">
          <ActionButton
            label="Thiết lập Link"
            onClick={() => onSetupLink(dashboard)}
            className="bg-accent/10 text-accent hover:bg-accent/20"
          />
          <ActionButton
            label="Thiết lập Số lượng"
            onClick={() => onSetupMetrics(dashboard)}
            className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
          />
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(dashboard);
              }}
              aria-label={`Sửa ${unitName}`}
              title="Sửa Dashboard"
              className="rounded-lg p-1.5 text-foreground/50 transition hover:bg-white/10 hover:text-foreground"
            >
              <Edit3 size={14} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(dashboard);
              }}
              aria-label={`Xóa ${unitName}`}
              title="Xóa Dashboard"
              className="rounded-lg p-1.5 text-foreground/50 transition hover:bg-red-500/15 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </span>
        </div>
      )}

      <span className="pointer-events-none absolute bottom-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent opacity-0 transition group-hover:opacity-100">
        <ExternalLink size={13} />
      </span>
    </div>
  );
}

export const ProvinceCard = memo(ProvinceCardImpl);