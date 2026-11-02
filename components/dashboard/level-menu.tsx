"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Building2,
  Landmark,
  Briefcase,
  Network,
  FileText,
  RefreshCw,
  FileUp,
  Link as LinkIcon,
  X,
  Check,
  Globe,
  GitMerge,
  Download,
  FileSpreadsheet,
  FileType,
  Moon,
  Sun,
  MoreVertical,
} from "lucide-react";
import { useTheme } from "next-themes";
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

/* ===================== CẤU HÌNH TÍNH NĂNG XUẤT BẢNG BÁO CÁO ===================== */

type ExportFormatId = "docx" | "pdf" | "xlsx";

const EXPORT_FORMATS: { id: ExportFormatId; label: string; ext: string; icon: React.ElementType }[] = [
  { id: "docx", label: "Microsoft Word", ext: ".docx", icon: FileText },
  { id: "pdf", label: "Adobe PDF", ext: ".pdf", icon: FileType },
  { id: "xlsx", label: "Excel Spreadsheet", ext: ".xlsx", icon: FileSpreadsheet },
];

/**
 * Nội dung cố định của báo cáo: CHỈ số liệu Tầng 1 (SME, Hộ kinh doanh, HTX,
 * CĐS & OCOP). Lựa chọn "Phạm vi nội dung báo cáo" (Tầng 1 / Tầng 2 / Toàn bộ)
 * đã được bỏ hoàn toàn — phía server cũng cố định phạm vi xuất là Tầng 1.
 */
const EXPORT_TIER1_CONTENT = ["SME", "Hộ kinh doanh", "HTX", "CĐS", "OCOP"];


interface LevelMenuProps {
  value: number;
  onChange: (level: number) => void;
  variant?: "sidebar" | "tabs";
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  dashboard?: DashboardRow | null;
  onChanged?: () => void;
  onSyncLive?: () => void;
  isSyncing?: boolean;
  onOpenImportPdf?: () => void;
}

export function LevelMenu({
  value,
  onChange,
  variant = "sidebar",
  mobileOpen = false,
  onCloseMobile = () => {},
  dashboard,
  onChanged,
  onSyncLive,
  isSyncing = false,
  onOpenImportPdf,
}: LevelMenuProps) {
  const { isAdmin } = useAuth();
  const [showDocModal, setShowDocModal] = useState(false);
  const [docUrlInput, setDocUrlInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setShowAdminDropdown(false);
      }
    }
    if (showAdminDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAdminDropdown]);

  const isDark = mounted ? (resolvedTheme || theme) === "dark" : true;

  const handleToggleTheme = () => {
    const currentTheme = resolvedTheme || theme || "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (nextTheme === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
      }
      localStorage.setItem("theme", nextTheme);
    }
  };

  // State quản lý Modal Đồng bộ số liệu từ xã/phường
  const [showCommuneSyncModal, setShowCommuneSyncModal] = useState(false);
  const [communeSyncUrl, setCommuneSyncUrl] = useState("");
  const [isSyncingCommunes, setIsSyncingCommunes] = useState(false);

  // State quản lý Modal Xuất bảng báo cáo
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormatId>("xlsx");
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportFileUrl, setExportFileUrl] = useState("");
  const [exportFileName, setExportFileName] = useState("");
  const exportTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleSelectLevel = (level: number) => {
    onChange(level);
    onCloseMobile();
  };

  // Mở modal đồng bộ xã/phường với URL tự động tạo sẵn
  const handleOpenCommuneSyncModal = () => {
    const meta = dashboard?.metadata as Record<string, any> | undefined;
    const baseDomain = dashboard?.base_domain || dashboard?.domain_link || "kienhaiangiang.vn";
    const autoDefaultUrl =
      meta?.sync_communes_url ||
      `https://${baseDomain.replace(/^https?:\/\//, "")}/tong-hop-xa-phuong-${resolvedDashboardId}`;
    
    setCommuneSyncUrl(autoDefaultUrl);
    setShowCommuneSyncModal(true);
  };

// Thực hiện đồng bộ số liệu xã/phường, reset ID ở tỉnh và lưu URL mới
  const handleExecuteCommuneSync = async () => {
    if (!resolvedDashboardId) {
      alert("Không tìm thấy ID Dashboard!");
      return;
    }

    try {
      setIsSyncingCommunes(true);
      const res = await fetch("/api/v1/metrics/sync-from-communes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: resolvedDashboardId,
          customSyncUrl: communeSyncUrl,
          resetIds: true, // 🌟 Bật cờ reset toàn bộ ID đã thiết lập nhầm ở dashboard Tỉnh
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || "Đồng bộ số liệu xã/phường và reset ID tỉnh thành công!");
        setShowCommuneSyncModal(false);
        if (onChanged) onChanged();
        window.location.reload();
      } else {
        alert("Lỗi: " + (data.error || "Không thể đồng bộ số liệu"));
      }
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi kết nối khi đồng bộ số liệu.");
    } finally {
      setIsSyncingCommunes(false);
    }
  };

  /* ===================== LOGIC XUẤT BẢNG BÁO CÁO ===================== */

  // Gợi ý phạm vi dữ liệu hiển thị trong Modal (server là nơi quyết định cuối cùng)
  const dashUnit = (dashboard as unknown as { unit?: { type?: string } | null } | null | undefined)?.unit;
  const dashUnitType = dashUnit?.type ?? "";
  const exportScopeHint =
    dashUnitType === "PROVINCE"
      ? "Phạm vi Tầng 1: Dashboard cấp TỈNH — xuất số liệu của Tỉnh và danh sách toàn bộ Xã/Phường trực thuộc. Chỉ tiêu nào của Tỉnh chưa có bản ghi hoặc bằng 0 sẽ được tự động cộng dồn từ các Xã/Phường trực thuộc."
      : dashUnitType === "COMMUNE" || dashUnitType === "SPECIAL_ZONE"
        ? "Phạm vi Tầng 1: Dashboard cấp XÃ/PHƯỜNG — chỉ xuất số liệu của đơn vị này (cô lập nghiêm ngặt, không lấy dữ liệu Tỉnh hoặc xã khác)."
        : "Phạm vi Tầng 1: hệ thống tự xác định theo cấp của Dashboard hiện tại (Tỉnh = số liệu Tỉnh + các xã, tự bù bằng tổng của xã khi Tỉnh bằng 0; Xã = chỉ đúng đơn vị này).";

  const handleOpenExportModal = () => {
    setExportFormat("xlsx");
    setExportProgress(0);
    setIsExporting(false);
    setExportDone(false);
    setExportError("");
    if (exportFileUrl) {
      URL.revokeObjectURL(exportFileUrl);
      setExportFileUrl("");
    }
    setExportFileName("");
    setShowExportModal(true);
  };

  const handleCloseExportModal = () => {
    if (exportTimerRef.current) {
      clearInterval(exportTimerRef.current);
      exportTimerRef.current = null;
    }
    if (exportFileUrl) {
      URL.revokeObjectURL(exportFileUrl);
      setExportFileUrl("");
    }
    setShowExportModal(false);
  };

  /**
   * Tải file & TỰ ĐỘNG ĐÓNG popup:
   * trình duyệt bắt đầu tải ngay khi click (href + download),
   * sau ~1.2s mới thu hồi Blob URL và đóng modal để không làm gián đoạn tải.
   */
  const handleDownloadAndClose = () => {
    // Trigger tải file ngay lập tức (trình duyệt hiểu href + download attribute)
    // Đồng thời đóng modal ngay — không chờ timeout
    setShowExportModal(false);
    // Thu hồi Blob URL sau khi modal đã đóng để tránh rò rỉ
    window.setTimeout(() => {
      if (exportFileUrl) URL.revokeObjectURL(exportFileUrl);
      setExportFileUrl("");
      setExportDone(false);
      setExportProgress(0);
    }, 500);
  };

  const handleStartExport = async () => {
    if (!resolvedDashboardId || isExporting) return;

    setIsExporting(true);
    setExportDone(false);
    setExportError("");
    setExportProgress(0);
    if (exportFileUrl) {
      URL.revokeObjectURL(exportFileUrl);
      setExportFileUrl("");
    }

    // Thanh tiến trình mô phỏng: chạy dần tới 99% và CHẶN TRẦN TUYỆT ĐỐI —
    // chỉ đạt đúng 100% khi file báo cáo đã được tạo thành công.
    exportTimerRef.current = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 99) return 99;
        return Math.min(99, prev + Math.max(1, Math.round((99 - prev) * 0.1)));
      });
    }, 200);

    try {
      const res = await fetch("/api/v1/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: resolvedDashboardId,
          format: exportFormat,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload || payload.error) {
        throw new Error(payload?.error || "Không thể xuất báo cáo");
      }

      const binary = atob(String(payload.fileBase64 || ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: payload.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      setExportFileUrl(url);
      setExportFileName(String(payload.fileName || `bao-cao.${exportFormat}`));
      setExportProgress(100); // Chốt đúng 100% khi hoàn tất
      setExportDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Đã xảy ra lỗi khi xuất báo cáo.";
      setExportError(message);
    } finally {
      if (exportTimerRef.current) {
        clearInterval(exportTimerRef.current);
        exportTimerRef.current = null;
      }
      setIsExporting(false);
    }
  };

  // Hàm xử lý Làm mới dữ liệu chung
  const handleSmartRefresh = async () => {
    if (!resolvedDashboardId) {
      if (onChanged) onChanged();
      return;
    }

    try {
      setRefreshing(true);

      // 💠 Nếu có luồng từ DashboardDetail (onSyncLive) -> ủy quyền để Modal Process Bar
      // được giữ nguyên, refresh-all chỉ chạy MỘT lần và có timeout chống treo.
      if (onSyncLive) {
        onSyncLive();
        return;
      }

      // 🔁 Fallback khi LevelMenu dùng độc lập: gọi trực tiếp API refresh-all
      const res = await fetch("/api/v1/metrics/refresh-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardId: resolvedDashboardId }),
        // Giới hạn thời gian chờ để vòng quay KHÔNG bị treo vô hạn khi server quá lâu
        signal: AbortSignal.timeout(60_000),
      });

      const result = await res.json().catch(() => null);

      if (result && result.success) {
        alert(result.message || "Đã làm mới dữ liệu thành công!");
        // Tải lại dữ liệu mượt mà trên trang (không gọi refresh lần 2, không reload cả trang)
        if (onChanged) onChanged();
      } else {
        alert("Lỗi: " + ((result && result.error) || "Không thể làm mới dữ liệu"));
      }
    } catch (err) {
      console.error("Lỗi làm mới dữ liệu:", err);
      if (!onSyncLive) alert("Đã xảy ra lỗi kết nối hoặc quá thời gian chờ khi làm mới dữ liệu.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      {/* ================= THANH MENU TAB NGANG (STICKY) ================= */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-[#0a1830] border-b border-slate-200 dark:border-white/10 shadow-sm flex justify-between items-center px-4 md:px-6">
        {/* Khối chứa các TABS (Bên trái) */}
        <div
          className="flex overflow-x-auto gap-2 py-2 items-center flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {LEVELS.map((item) => {
            const Icon = item.icon;
            const active = value === item.level;

            return (
              <button
                key={item.level}
                type="button"
                onClick={() => handleSelectLevel(item.level)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon
                  size={16}
                  className={`shrink-0 ${
                    active ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                  }`}
                />
                <span>{item.title}</span>
              </button>
            );
          })}

          {/* Tài liệu Chuyển đổi số */}
          <div className="relative flex items-center group">
            <button
              type="button"
              onClick={handleClickDocMenu}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent transition"
            >
              <FileText size={16} className="text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Tài liệu CĐS</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenSetupLink}
                className="ml-1 rounded-md border border-slate-200 bg-white p-1 text-slate-400 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:border-[#00d2ff]/50 dark:hover:bg-[#00d2ff]/10 dark:hover:text-[#00d2ff]"
                title="Thiết lập link tài liệu"
              >
                <LinkIcon size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Cụm nút chức năng & Popup Admin (Bên phải) */}
        <div className="flex items-center gap-2 pl-3 shrink-0 relative">
          {/* 1. Nút Chuyển Giao diện (Sáng/Tối) */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#1d335d] dark:bg-[#162b54] dark:text-blue-400 dark:hover:bg-[#1d335d] transition shadow-xs"
            title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
          >
            {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-blue-600" />}
          </button>

          {/* 2. Nút Menu Admin & Popup Dropdown */}
          <div className="relative" ref={adminDropdownRef}>
            <button
              type="button"
              onClick={() => setShowAdminDropdown((prev) => !prev)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#1d335d] dark:bg-[#162b54] dark:text-blue-400 dark:hover:bg-[#1d335d] transition shadow-xs"
              title="Menu chức năng"
            >
              <MoreVertical size={17} />
            </button>

            {showAdminDropdown && (
              <div className="absolute right-0 mt-2 w-48 z-50 bg-white dark:bg-[#0a1830] rounded-xl shadow-xl border border-slate-200 dark:border-blue-800 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminDropdown(false);
                    handleOpenExportModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-900/40 dark:hover:text-blue-400 transition"
                >
                  <Download size={15} className="text-amber-500" />
                  <span>Xuất bảng báo cáo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAdminDropdown(false);
                    handleSmartRefresh();
                  }}
                  disabled={isSyncing || refreshing}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-900/40 dark:hover:text-blue-400 transition disabled:opacity-50"
                >
                  <RefreshCw
                    size={15}
                    className={`text-blue-600 dark:text-blue-400 ${isSyncing || refreshing ? "animate-spin" : ""}`}
                  />
                  <span>{isSyncing || refreshing ? "Đang cập nhật..." : "Làm mới dữ liệu"}</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminDropdown(false);
                      handleOpenCommuneSyncModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900/30 transition border-t border-slate-100 dark:border-white/5"
                  >
                    <GitMerge size={15} className="text-purple-500" />
                    <span>Đồng bộ số liệu</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

        {/* Modal cấu hình đường dẫn tự động & Đồng bộ số liệu xã/phường */}
        {showCommuneSyncModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0c1830] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    <GitMerge size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300">
                      Đồng bộ số liệu từ Xã/Phường
                    </h3>
                    <p className="text-xs text-slate-400">Tổng sum dữ liệu cấp tỉnh & tùy chỉnh liên kết</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCommuneSyncModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300 mb-1.5">
                    Đường dẫn liên kết (Tự động tạo & Có thể chỉnh sửa):
                  </label>
                  <input
                    type="url"
                    value={communeSyncUrl}
                    onChange={(e) => setCommuneSyncUrl(e.target.value)}
                    placeholder="https://kienhaiangiang.vn/tong-hop-xa-phuong"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-purple-400 focus:outline-none font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    * Link được tự động tạo sẵn. Nếu bạn chỉnh sửa ở đây, các thẻ card/link sẽ tự động trỏ tới đường dẫn mới đó.
                  </p>
                </div>

                <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3 text-xs text-purple-200">
                  ℹ️ Khi bấm thực hiện, hệ thống sẽ tự động tổng sum toàn bộ số liệu của tất cả các xã/phường trực thuộc để cập nhật lên dashboard Tỉnh.
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowCommuneSyncModal(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteCommuneSync}
                    disabled={isSyncingCommunes}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                  >
                    <GitMerge size={14} className={isSyncingCommunes ? "animate-spin" : ""} />
                    <span>{isSyncingCommunes ? "Đang đồng bộ..." : "Thực hiện đồng bộ ngay"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Custom Link Tài liệu */}
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

        {/* ===================== MODAL XUẤT BẢNG BÁO CÁO ===================== */}
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c1830] p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Download size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">Xuất bảng báo cáo</h3>
                    <p className="text-xs text-slate-400">Tải dữ liệu Dashboard về máy của bạn</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseExportModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Chọn định dạng file xuất */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300 mb-1.5">
                    Định dạng file xuất
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {EXPORT_FORMATS.map((f) => {
                      const Icon = f.icon;
                      const selected = exportFormat === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          disabled={isExporting}
                          onClick={() => setExportFormat(f.id)}
                          className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition disabled:opacity-60 ${
                            selected
                              ? "border-amber-400/60 bg-[#0d274c] text-amber-300 shadow-sm"
                              : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white"
                          }`}
                        >
                          <Icon size={17} className={selected ? "text-amber-300" : "text-slate-400"} />
                          <span className="text-[11px] font-bold leading-tight text-center">{f.label}</span>
                          <span className="text-[10px] text-slate-500">{f.ext}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nội dung báo cáo Tầng 1 cố định (đã bỏ lựa chọn "Phạm vi nội dung báo cáo") */}
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                    <ShieldCheck size={13} />
                    Nội dung báo cáo: Tầng 1
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {EXPORT_TIER1_CONTENT.map((item) => (
                      <span
                        key={item}
                        className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-200"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/80">
                    Báo cáo xuất ra chỉ gồm số liệu Tầng 1 (SME, Hộ kinh doanh, HTX, CĐS &amp; OCOP) — không còn lựa chọn
                    phạm vi Tầng 2 / Toàn bộ báo cáo.
                  </p>
                </div>

                {/* Gợi ý phạm vi dữ liệu theo cấp Dashboard */}
                <p className="text-[11px] text-slate-400 bg-slate-900/70 border border-white/5 rounded-xl p-2.5 leading-relaxed">
                  {exportScopeHint}
                </p>

                {/* Thanh tiến trình (chặn trần tuyệt đối 100%) */}
                {(isExporting || exportDone) && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                      <span>{exportDone ? "Tạo file báo cáo thành công!" : "Đang tổng hợp dữ liệu & tạo file..."}</span>
                      <span className="font-bold tabular-nums text-slate-100">{exportProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          exportDone ? "bg-emerald-400" : "bg-gradient-to-r from-amber-400 to-emerald-400"
                        }`}
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {exportError && (
                  <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">
                    {exportError}
                  </p>
                )}

                {/* Hành động */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={handleCloseExportModal}
                    disabled={isExporting}
                    className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {exportDone ? "Đóng" : "Hủy"}
                  </button>
                  {exportDone && exportFileUrl ? (
                    <a
                      href={exportFileUrl}
                      download={exportFileName}
                      onClick={handleDownloadAndClose}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 transition"
                    >
                      <Download size={14} />
                      <span>Tải xuống ngay</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartExport}
                      disabled={isExporting || !resolvedDashboardId}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#00d2ff] hover:bg-[#00beea] px-4 py-2 text-xs font-bold text-slate-950 transition disabled:opacity-50"
                    >
                      <Download size={14} className={isExporting ? "animate-bounce" : ""} />
                      <span>{isExporting ? "Đang xuất..." : "Xuất báo cáo"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
}

export default LevelMenu;