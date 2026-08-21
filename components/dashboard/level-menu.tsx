"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Building2,
  Landmark,
  Briefcase,
  Network,
  FileText,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  X,
  Check,
  Globe,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { DashboardRow } from "@/lib/types";

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

export interface LevelItem {
  level: number;
  label: string;
  title: string;
  desc: string;
  icon: React.ElementType;
}

export const LEVELS: LevelItem[] = [
  {
    level: 1,
    label: "Tầng 1",
    title: "Tầng 1: Bộ tiêu chí kinh tế số UBND cấp xã",
    desc: "DEI 68% (Kinh tế & Xã hội)",
    icon: ShieldCheck,
  },
  {
    level: 2,
    label: "Tầng 2",
    title: "Tầng 2: Tiêu chí nền tảng kinh tế số",
    desc: "5 nhóm A-E khai thác từ Nền tảng",
    icon: Building2,
  },
  {
    level: 3,
    label: "Tầng 3",
    title: "Tầng 3: Dự án kêu gọi đầu tư - Quy hoạch",
    desc: "Kêu gọi đầu tư, quy hoạch",
    icon: Landmark,
  },
  {
    level: 4,
    label: "Tầng 4",
    title: "Tầng 4: Chính sách & Giải đáp kiến nghị",
    desc: "Hỗ trợ doanh nghiệp, các góp ý kiến nghị",
    icon: Briefcase,
  },
  {
    level: 5,
    label: "Tầng 5",
    title: "Tầng 5: Điểm trưng bày/Hội quán",
    desc: "Điểm bán Xanh, Doanh thu",
    icon: Network,
  },
];

export function useLevelParam(defaultLevel = 1): [number, (lvl: number) => void] {
  const [level, setLevel] = useState<number>(defaultLevel);
  return [level, setLevel];
}

interface LevelMenuProps {
  value: number;
  onChange: (level: number) => void;
  variant?: "sidebar" | "tabs";
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileFooter?: React.ReactNode;
  dashboard?: DashboardRow | null;
  onChanged?: () => void;
}

export function LevelMenu({
  value,
  onChange,
  variant = "sidebar",
  collapsed = false,
  onToggleCollapse,
  mobileFooter,
  dashboard,
  onChanged,
}: LevelMenuProps) {
  const { isAdmin } = useAuth();
  const [showDocModal, setShowDocModal] = useState(false);
  const [docUrlInput, setDocUrlInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState("");

  const resolvedDashboardId =
    dashboard?.id ||
    (typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean).pop()
      : "");

  useEffect(() => {
    const fetchLink = async () => {
      const meta = dashboard?.metadata as Record<string, any> | undefined;
      let url =
        (meta?.tailieu_cds_url as string) ||
        ((dashboard as any)?.tailieu_cds_url as string) ||
        "";

      if (!url && resolvedDashboardId) {
        const local = localStorage.getItem(`tailieu_cds_${resolvedDashboardId}`);
        if (local) url = local;

        try {
          const { data } = await supabase
            .from("metric_links")
            .select("target_url")
            .eq("dashboard_id", resolvedDashboardId)
            .eq("metric_key", "tailieu_cds_url")
            .maybeSingle();

          if (data?.target_url) url = data.target_url;
        } catch {
          // ignore
        }
      }
      setSavedUrl(url);
    };

    void fetchLink();
  }, [dashboard, resolvedDashboardId]);

  const handleOpenSetupLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDocUrlInput(savedUrl);
    setShowDocModal(true);
  };

  const handleSaveDocLink = async () => {
    const targetId = resolvedDashboardId;
    if (!targetId) {
      alert("Không tìm thấy ID Dashboard!");
      return;
    }

    setIsSaving(true);
    const cleanUrl = docUrlInput.trim();

    try {
      await fetch("/api/v1/metrics/set-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: targetId,
          metricKey: "tailieu_cds_url",
          targetUrl: cleanUrl,
          metricId: cleanUrl,
        }),
      });

      const existingMeta = (dashboard?.metadata as Record<string, any>) || {};
      const updatedMeta = { ...existingMeta, tailieu_cds_url: cleanUrl };

      await supabase
        .from("dashboards")
        .update({ metadata: updatedMeta })
        .eq("id", targetId);

      localStorage.setItem(`tailieu_cds_${targetId}`, cleanUrl);
      setSavedUrl(cleanUrl);

      alert("Đã lưu liên kết Tài liệu CĐS thành công!");
      setShowDocModal(false);

      if (onChanged) onChanged();
    } catch (err: any) {
      console.error("Lỗi lưu link:", err);
      localStorage.setItem(`tailieu_cds_${targetId}`, cleanUrl);
      setSavedUrl(cleanUrl);
      setShowDocModal(false);
      alert("Đã lưu liên kết thành công!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClickDocMenu = () => {
    if (savedUrl) {
      const target =
        savedUrl.startsWith("http://") || savedUrl.startsWith("https://")
          ? savedUrl
          : `https://${savedUrl}`;
      window.open(target, "_blank", "noopener,noreferrer");
    } else if (isAdmin) {
      setDocUrlInput("");
      setShowDocModal(true);
    } else {
      alert("Liên kết tài liệu đang được cập nhật!");
    }
  };

  if (variant === "sidebar") {
    return (
      <>
        <aside
          className={`fixed left-0 top-0 z-50 h-screen border-r border-[#14233c] bg-[#071326] text-slate-200 transition-all duration-300 flex flex-col justify-between select-none ${
            collapsed ? "w-20" : "w-[260px]"
          }`}
        >
          <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
            {/* Header Sidebar */}
            <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-white/5">
              {!collapsed && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-black text-sm">
                    D
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xs font-black uppercase tracking-wider text-cyan-400">
                      ĐIỀU HÀNH SỐ
                    </h2>
                    <p className="truncate text-[10px] text-slate-400">Hệ sinh thái địa phương</p>
                  </div>
                </div>
              )}

              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700 hover:text-white mx-auto"
                  title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
                >
                  {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                </button>
              )}
            </div>

            {/* Danh sách Menu (Tầng 1 -> 5 & Tài liệu CĐS) */}
            <div className="p-3 space-y-1.5 flex-1">
              {/* Tầng 1 đến Tầng 5 */}
              {LEVELS.map((item) => {
                const Icon = item.icon;
                const active = value === item.level;

                return (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => onChange(item.level)}
                    className={`relative w-full text-left transition-colors duration-150 rounded-xl group ${
                      active
                        ? "bg-[#0d274c] text-white border-l-[3.5px] border-[#00d2ff]"
                        : "bg-transparent hover:bg-[#0c1f38] text-slate-300 hover:text-white border-l-[3.5px] border-transparent"
                    } ${
                      collapsed
                        ? "p-3 flex justify-center"
                        : "px-3.5 py-3 flex items-start gap-3.5"
                    }`}
                    title={collapsed ? `${item.title} - ${item.desc}` : undefined}
                  >
                    {/* Icon */}
                    <Icon
                      size={20}
                      className={`shrink-0 mt-0.5 transition-colors ${
                        active
                          ? "text-[#00d2ff]"
                          : "text-slate-400 group-hover:text-[#00d2ff]"
                      }`}
                    />

                    {/* Text Container */}
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <h4
                          className={`text-[13.5px] font-bold leading-snug tracking-tight ${
                            active ? "text-white" : "text-slate-200 group-hover:text-white"
                          }`}
                        >
                          {item.title}
                        </h4>
                        <p
                          className={`text-[11px] mt-0.5 leading-normal truncate ${
                            active
                              ? "text-[#7ea3cc] font-medium"
                              : "text-slate-400 group-hover:text-slate-300 font-normal"
                          }`}
                        >
                          {item.desc}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Tài liệu Chuyển đổi số cho doanh nghiệp */}
              <div className="relative flex items-center group">
                <button
                  type="button"
                  onClick={handleClickDocMenu}
                  className={`w-full text-left transition-colors duration-150 rounded-xl bg-transparent hover:bg-[#0c1f38] text-slate-300 hover:text-white border-l-[3.5px] border-transparent ${
                    collapsed ? "p-3 flex justify-center" : "px-3.5 py-3 flex items-start gap-3.5"
                  }`}
                  title={
                    collapsed
                      ? `Tài liệu Chuyển đổi số cho doanh nghiệp ${savedUrl ? `(${savedUrl})` : ""}`
                      : undefined
                  }
                >
                  <FileText
                    size={20}
                    className="shrink-0 mt-0.5 text-slate-400 group-hover:text-[#00d2ff]"
                  />
                  {!collapsed && (
                    <div className="min-w-0 flex-1 pr-6">
                      <h4 className="text-[13.5px] font-bold leading-snug text-slate-200 group-hover:text-white">
                        Tài liệu Chuyển đổi số cho doanh nghiệp
                      </h4>
                      
                    </div>
                  )}
                </button>

                {/* Nút [ 🔗 ] cho Admin */}
                {isAdmin && !collapsed && (
                  <button
                    type="button"
                    onClick={handleOpenSetupLink}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-slate-700 bg-slate-800/80 p-1.5 text-slate-400 transition hover:border-[#00d2ff]/50 hover:bg-[#00d2ff]/10 hover:text-[#00d2ff]"
                    title="Thiết lập link tài liệu"
                  >
                    <LinkIcon size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Footer Sidebar */}
            {mobileFooter && (
              <div className="p-3 border-t border-white/5 shrink-0">{mobileFooter}</div>
            )}
          </div>
        </aside>

        {/* Modal nhập link tài liệu */}
        {showDocModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c1830] p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <Globe size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                      Thiết lập Custom Link
                    </h3>
                    <p className="text-xs text-slate-400">Tài liệu CĐS cho doanh nghiệp</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300 mb-1.5">
                    Đường dẫn liên kết:
                  </label>
                  <input
                    type="url"
                    value={docUrlInput}
                    onChange={(e) => setDocUrlInput(e.target.value)}
                    placeholder="https://drive.google.com/... hoặc https://..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowDocModal(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDocLink}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#00d2ff] hover:bg-[#00beea] px-4 py-2 text-xs font-bold text-slate-950 transition disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>{isSaving ? "Đang lưu..." : "Lưu link"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export default LevelMenu;