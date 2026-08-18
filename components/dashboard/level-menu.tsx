"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Menu,
  FileText,
  Landmark,
  Layers,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

/**
 * Menu điều hướng 6 mục cho Dashboard (Tầng 1..5 + Tài liệu CĐS).
 * - Mặc định Tầng 1 (`activeLevel = 1`), trạng thái đồng bộ qua `?level=`.
 * - Sidebar cố định ở rìa trái (`fixed left-0 top-0 h-screen`), mặc định rộng
 *   `w-64`, khi thu gọn co về `w-20` (chỉ hiện Icon + tooltip).
 */

export interface LevelItem {
  level: number;
  label: string;
  title: string;
  icon: LucideIcon;
}

export const LEVELS: readonly LevelItem[] = [
  {
    level: 1,
    label: "Tầng 1",
    title: "Bộ tiêu chí kinh tế số",
    icon: BarChart3,
  },
  {
    level: 2,
    label: "Tầng 2",
    title: "Tiêu chí nền tảng kinh tế số",
    icon: Layers,
  },
  {
    level: 3,
    label: "Tầng 3",
    title: "Dự án kêu gọi đầu tư – Quy hoạch",
    icon: Building2,
  },
  {
    level: 4,
    label: "Tầng 4",
    title: "Chính sách & giải đáp kiến nghị",
    icon: ScrollText,
  },
  {
    level: 5,
    label: "Tầng 5",
    title: "Điểm trưng bày & Hội quán",
    icon: Landmark,
  },
  {
    level: 6,
    label: "Tài liệu CĐS",
    title: "Tài liệu chuyển đổi số cho doanh nghiệp",
    icon: FileText,
  },
] as const;

export const MIN_LEVEL = 1;
export const MAX_LEVEL = LEVELS.length;

function clampLevel(value: number): number {
  if (Number.isNaN(value)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, value));
}

/** Đọc / ghi tầng đang chọn qua Query Param `?level=` trên URL. */
export function useLevelParam(defaultLevel = MIN_LEVEL): [number, (next: number) => void] {
  const [level, setLevel] = useState(clampLevel(defaultLevel));

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("level");
    const parsed = raw ? Number.parseInt(raw, 10) : MIN_LEVEL;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLevel(clampLevel(parsed));
  }, []);

  const update = (next: number): void => {
    const value = clampLevel(next);
    setLevel(value);
    const url = new URL(window.location.href);
    url.searchParams.set("level", String(value));
    window.history.replaceState(null, "", url.toString());
  };

  return [level, update];
}

interface LevelMenuProps {
  value: number;
  onChange: (level: number) => void;
  /** "sidebar" (dọc cố định, dùng ở trang Dashboard) hoặc "tabs" (ngang). */
  variant?: "tabs" | "sidebar";
  /** Tên địa phương hiển thị động ở Tầng 1 */
  localName?: string;
  /** Trạng thái thu gọn Sidebar (chỉ áp dụng variant="sidebar"). */
  collapsed?: boolean;
  /** Gọi khi bấm nút thu gọn / mở rộng Sidebar. */
  onToggleCollapse?: () => void;
  /** Nội dung hiển thị ở chân Sidebar (Mobile: ThemeToggle). */
  mobileFooter?: React.ReactNode;
}

export function LevelMenu({
  value,
  onChange,
  variant = "sidebar",
  localName,
  collapsed = false,
  onToggleCollapse,
  mobileFooter,
}: LevelMenuProps) {
  const isSidebar = variant === "sidebar";
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isSidebar) {
    return (
      <nav aria-label="Sidebar Điều Hướng" className="glass sticky top-20 z-30 mb-6 flex gap-1 overflow-x-auto rounded-2xl p-1.5">
        {LEVELS.map((item) => {
          const Icon = item.icon;
          const active = item.level === value;
          return (
            <button
              key={item.level}
              type="button"
              onClick={() => onChange(item.level)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition sm:text-sm ${
                active
                  ? "bg-gradient-to-r from-accent/25 to-blue-600/25 text-accent shadow-inner"
                  : "text-foreground/60 hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Icon size={17} className={active ? "text-accent" : "opacity-70"} />
              <span>{item.label}</span>
              {active && <span className="hidden h-1.5 w-1.5 rounded-full bg-accent sm:inline-block" />}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* Nút mở Sidebar trên Mobile (cố định góc trên phải) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Mở rộng Sidebar"
        title="Mở rộng Sidebar"
        className="fixed top-3 right-3 z-40 grid h-11 w-11 place-items-center rounded-[15px] border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1e38] text-cyan-400 shadow-lg transition md:hidden"
      >
        <Menu size={22} />
      </button>

      {/* Backdrop mờ đen trên Mobile khi Sidebar mở */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar Desktop (≥ md) + Drawer Mobile */}
      <nav
        aria-label="Sidebar Điều Hướng"
        className={`glass-strong fixed left-0 top-0 z-50 flex h-screen flex-col shadow-glass transition-all duration-300 ${
          mobileOpen
            ? "w-72 translate-x-0"
            : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "md:w-20" : "md:w-64"}`}
      >
        {/* Header Sidebar + Nút Thu gọn */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
            collapsed ? "md:justify-center md:px-2" : "md:justify-between md:px-4"
          } justify-between px-4`}
        >
          {!collapsed && <span className="truncate text-sm font-bold">Kinh tế số</span>}
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileOpen(false);
              } else {
                onToggleCollapse?.();
              }
            }}
            aria-label={collapsed ? "Mở rộng Sidebar" : "Thu gọn Sidebar"}
            title={collapsed ? "Mở rộng" : "Thu gọn"}
            className="glass grid h-9 w-9 shrink-0 place-items-center rounded-xl text-amber-400 transition hover:text-amber-300"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Danh sách Menu */}
        <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {LEVELS.map((item) => {
            const Icon = item.icon;
            const active = item.level === value;
            const displayTitle =
              item.level === 1 && localName
                ? `Bộ tiêu chí kinh tế số của ${localName}`
                : item.title;

            return (
              <button
                key={item.level}
                type="button"
                onClick={() => {
                  onChange(item.level);
                  setMobileOpen(false);
                }}
                aria-pressed={active}
                className={`group relative flex w-full items-center rounded-xl text-left transition ${
                  collapsed && !mobileOpen
                    ? "md:justify-center md:px-2 md:py-3"
                    : "flex-col items-start gap-1 px-3.5 py-3"
                } ${
                  active
                    ? "border border-accent/20 bg-gradient-to-r from-accent/25 via-blue-600/20 to-blue-500/10 font-semibold text-accent shadow-inner"
                    : "text-foreground/70 hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <span
                  className={`flex w-full items-center gap-2.5 ${
                    collapsed && !mobileOpen ? "md:justify-center" : ""
                  }`}
                >
                  <Icon size={17} className={active ? "text-accent" : "opacity-70"} />
                  {!collapsed || mobileOpen ? (
                    <span className="text-sm font-medium">{item.label}</span>
                  ) : null}
                  {collapsed && !mobileOpen ? (
                    <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg bg-black/85 px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
                      {item.label} · {displayTitle}
                    </span>
                  ) : null}
                </span>
                {(!collapsed || mobileOpen) && (
                  <span className="line-clamp-2 w-full pl-7 text-[11px] leading-tight font-normal opacity-75">
                    {displayTitle}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chân Sidebar (Mobile: ThemeToggle & Import PDF) — ẩn hoàn toàn trên ≥ md */}
        {mobileFooter && (
          <div className="hidden shrink-0 border-t border-white/10 p-3 md:hidden">
            {mobileFooter}
          </div>
        )}
      </nav>
    </>
  );
}

