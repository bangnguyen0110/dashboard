"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  History,
  Link2,
  Loader2,
  Minus,
  Radio,
  Settings2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { defaultMaXa, formatVnNumber, readRevenueSource } from "@/lib/revenue-sync";
import { useAuth } from "@/context/AuthContext";
import { Dialog } from "../dialog";
import { useRevenueRealtime } from "./use-revenue-realtime";
import { RevenueSetupModal } from "./revenue-setup-modal";
import { RevenueHistoryLog } from "./revenue-history-log";
import { MetricIdModal } from "./metric-id-modal";
import { getStoredMetricId } from "@/lib/card-link";
import { supabase } from "@/lib/supabase";

/**
 * KHỐI B3 — DÒNG CHẢY DOANH THU (Tầng 1 / Level 1)
 *
 * Gồm 2 hàng:
 *  - HÀNG 1: 5 thẻ doanh thu (ngày / tuần / tháng / quý / năm).
 *  - HÀNG 2: Biểu đồ đường tăng trưởng doanh thu + bộ lọc mốc thời gian.
 *
 * Quy ước: Mặc định tất cả thông số doanh thu đều = 0.
 * - Dashboard XÃ: hiển thị `data` (cột JSONB `dashboards.b3`) được truyền vào.
 * - Dashboard TỈNH: `loadCommunes` cộng dồn `b3` của toàn bộ xã/phường rồi truyền vào.
 *
 * Chỉ ghi dữ liệu gián tiếp qua callback `onSaveMetricId` / `onSaveQuantity`
 * (không truy cập Supabase trực tiếp).
 */

export type B3RangeKey = "day" | "week" | "month" | "quarter" | "year";

/** Alias giữ tương thích yêu cầu: `timeFilter` dùng chung cho Biểu đồ + BXH. */
export type B3ChartFilter = B3RangeKey;
/** Alias tương thích ngược với tên state cũ `chartFilter`. */
export type B3TimeFilter = B3RangeKey;

export interface B3RevenueData {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  yearly: number;
}

/** Giá trị mặc định của khối B3 — toàn bộ bằng 0. */
export const B3_REVENUE_DEFAULTS: B3RevenueData = {
  daily: 0,
  weekly: 0,
  monthly: 0,
  quarterly: 0,
  yearly: 0,
};

interface B3RevenueSectionProps {
  dashboard: DashboardRow;
  /** Dữ liệu B3 (mặc định các trường doanh thu đều = 0). */
  data?: KpiRow | null;
  /** Map `metric_key` -> `target_url` (hiển thị / ghép URL khi thiết lập ID). */
  metricLinks?: Record<string, string>;
  /** Map `metric_key` -> ID đã lưu (hiện lại trong modal khi mở lần sau). */
  metricIds?: Record<string, string>;
  /** Lưu ID vừa nhập cho thẻ B3: `b3_daily`, `b3_weekly`, `b3_monthly`, `b3_quarterly`, `b3_yearly`. */
  onSaveMetricId?: (metricKey: string, metricId: string) => Promise<void>;
  /** Lưu số lượng thủ công cho chỉ số B3 (dự phòng, cùng chữ ký với các khối khác). */
  onSaveQuantity?: (metricKey: string, value: number) => Promise<void>;
  /** Ghi đè quyền Admin (mặc định lấy từ `useAuth`). */
  isAdmin?: boolean;
  /**
   * Gọi sau khi "Cào ngay" thành công để cha refetch `dashboards` (5 thẻ B3
   * hiển thị số mới ngay không cần F5).
   */
  onChanged?: () => void;
  /**
   * (Dashboard TỈNH) Danh sách `dashboard_id` các xã/phường trực thuộc — dùng
   * truy vấn `kpi_revenue_history` cộng dồn cho biểu đồ. Để trống/thiếu thì
   * fallback về `dashboard.id` hiện tại (Dashboard Xã).
   */
  historyDashboardIds?: string[];
  /**
   * (Dashboard TỈNH) Danh sách TẤT CẢ dashboard xã/phường trực thuộc
   * (mỗi item là `DashboardRow`, gồm cột JSONB `b3`) — dùng vẽ
   * BXH Top 5 Cao Nhất / Top 5 Thấp Nhất theo đúng `chartFilter` hiện tại.
   */
  communesData?: DashboardRow[];
}

const numberFmt = new Intl.NumberFormat("vi-VN");

const toNum = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Chuẩn hoá dữ liệu B3 thô thành 5 mốc doanh thu (mặc định 0). */
export function readB3Revenue(data?: KpiRow | null): B3RevenueData {
  return {
    daily: toNum(data?.["daily"]),
    weekly: toNum(data?.["weekly"]),
    monthly: toNum(data?.["monthly"]),
    quarterly: toNum(data?.["quarterly"]),
    yearly: toNum(data?.["yearly"]),
  };
}

const RANGE_OPTIONS: { key: B3RangeKey; label: string }[] = [
  { key: "day", label: "Ngày" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
];

/**
 * Mock chuỗi thời gian cho biểu đồ theo từng mốc filter.
 * Toàn bộ giá trị = 0 (chờ API tổng hợp doanh thu).
 */
function buildChartSeries(range: B3RangeKey): { label: string; value: number }[] {
  if (range === "day") {
    return Array.from({ length: 12 }, (_, i) => ({ label: `${i * 2}h`, value: 0 }));
  }
  if (range === "week") {
    return ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => ({ label, value: 0 }));
  }
  if (range === "month") {
    return Array.from({ length: 30 }, (_, i) => ({ label: `${i + 1}`, value: 0 }));
  }
  return Array.from({ length: 12 }, (_, i) => ({ label: `Th ${i + 1}`, value: 0 }));
}

/** Một dòng trong bảng lịch sử `kpi_revenue_history` (migration 0009). */
export interface HistoryRow {
  dashboard_id: string;
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  yearly: number;
  scraped_at: string;
}

/** Trường doanh thu được vẽ cho từng mốc lọc. */
const RANGE_FIELD: Record<B3RangeKey, keyof Omit<HistoryRow, "dashboard_id" | "scraped_at">> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
  quarter: "quarterly",
  year: "yearly",
};

/** Map `timeFilter` (day/week/month/quarter/year) -> key doanh thu trong cột `b3`. */
const TIME_FILTER_TO_B3_KEY: Record<B3RangeKey, keyof B3RevenueData> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
  quarter: "quarterly",
  year: "yearly",
};
/** Alias tương thích ngược với tên hằng cũ. */
const CHART_FILTER_TO_B3_KEY = TIME_FILTER_TO_B3_KEY;

/**
 * Dựng chuỗi LineChart TỪ LỊCH SỬ THẬT (`kpi_revenue_history`) — thay mock zeros.
 *
 * - Mỗi dòng lịch sử chứa đủ 5 mốc; chọn đúng trường theo bộ lọc đang chọn.
 * - Gộp theo "bucket" (giờ / ngày / tháng) và với mỗi xã chỉ giữ bản ghi MỚI
 *   NHẤT trong bucket để không cộng trùng, rồi SUM lại các xã — nên Dashboard
 *   Tỉnh vẽ đúng tổng doanh thu của các xã/phường trực thuộc.
 * - Trả `null` khi chưa có lịch sử để caller fallback về `buildChartSeries`.
 */
function buildHistorySeries(
  rows: HistoryRow[],
  range: B3RangeKey
): { label: string; value: number }[] | null {
  if (rows.length === 0) return null;
  const field = RANGE_FIELD[range];
  const pad = (n: number) => String(n).padStart(2, "0");

  // bucketKey -> (dashboard_id -> bản ghi mới nhất của xã đó trong bucket)
  const buckets = new Map<string, Map<string, { ts: number; value: number }>>();
  const labels = new Map<string, string>();

  for (const row of rows) {
    const ts = Date.parse(row.scraped_at);
    if (!Number.isFinite(ts)) continue;
    const d = new Date(ts);

    let key: string;
    let label: string;
    if (range === "day") {
      key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`;
      label = `${pad(d.getHours())}:00`;
    } else if (range === "year") {
      key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      label = `Th ${d.getMonth() + 1}`;
    } else {
      key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      label = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    }

    labels.set(key, label);
    const perDash = buckets.get(key) ?? new Map<string, { ts: number; value: number }>();
    const prev = perDash.get(row.dashboard_id);
    const value = toNum(row[field]);
    if (!prev || ts >= prev.ts) perDash.set(row.dashboard_id, { ts, value });
    buckets.set(key, perDash);
  }

  const maxPoints = range === "day" ? 12 : range === "week" ? 7 : range === "month" ? 31 : 12;

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-maxPoints)
    .map(([key, perDash]) => ({
      label: labels.get(key) ?? key,
      value: [...perDash.values()].reduce((sum, item) => sum + item.value, 0),
    }));
}

function TopRankRow({
  rank,
  index,
  item,
  max,
  tone,
}: {
  rank: number;
  index: number;
  item: { name: string; revenue: number; growth: number };
  max: number;
  tone: "emerald" | "rose";
}) {
  const pct = max > 0 ? Math.max(4, Math.round((item.revenue / max) * 100)) : 0;
  const bar = tone === "emerald" ? "bg-emerald-500/15" : "bg-rose-500/15";
  const cell = tone === "emerald" ? "bg-emerald-500/10" : "bg-rose-500/10";
  const rankColor = tone === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="border-t border-white/5 transition hover:bg-white/[0.02]"
    >
      <td className={`px-2 py-2.5 font-extrabold ${rankColor}`}>#{rank}</td>
      <td className="max-w-[160px] truncate px-2 py-2.5 text-left font-semibold text-slate-200" title={item.name}>
        {item.name}
      </td>
      <td className="px-2 py-2.5 text-right">
        <span className={`relative inline-block min-w-[110px] overflow-hidden rounded-lg px-2.5 py-1.5 text-right font-bold tabular-nums text-slate-100 ${cell}`}>
          <span className={`pointer-events-none absolute inset-y-0 left-0 ${bar}`} style={{ width: `${pct}%` }} />
          <span className="relative">{numberFmt.format(item.revenue)} VND</span>
        </span>
      </td>
      <td className="px-2 py-2.5 text-right">
        <span className={`inline-flex items-center justify-end gap-1 font-bold tabular-nums ${item.growth > 0 ? "text-emerald-400" : item.growth < 0 ? "text-rose-400" : "text-slate-500"}`}>
          {item.growth > 0 ? (<ArrowUp size={12} />) : item.growth < 0 ? (<ArrowDown size={12} />) : (<Minus size={12} />)}
          {item.growth > 0 ? "+" : ""}{item.growth.toFixed(1)}%
        </span>
      </td>
    </motion.tr>
  );
}

export function B3RevenueSection({  dashboard,
  data,
  metricLinks = {},
  metricIds = {},
  onSaveMetricId,
  isAdmin: isAdminProp,
  onChanged,
  historyDashboardIds,
  communesData = [],
}: B3RevenueSectionProps) {
  const { isAdmin: isAdminAuth } = useAuth();
  /** Quyền Admin: ưu tiên prop truyền từ cha, fallback về AuthContext. */
  const isAdmin = isAdminProp ?? isAdminAuth;
  /** Bộ lọc thời gian chung cho Biểu đồ + Bảng xếp hạng (day/week/month/quarter/year). */
  const [timeFilter, setTimeFilter] = useState<B3RangeKey>("day");
  /** Alias tương thích ngược với tên state cũ `chartFilter` / `range`. */
  const chartFilter = timeFilter;
  const setChartFilter = setTimeFilter;
  const range = timeFilter;
  const setRange = setTimeFilter;
  const [showSetup, setShowSetup] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  /** Modal "Thiết lập ID" cho 1 trong 5 thẻ doanh thu (b3_daily … b3_yearly). */
  const [metricIdTarget, setMetricIdTarget] = useState<{
    key: string;
    label: string;
    id: string;
  } | null>(null);
  // Nút "Cào ngay": gọi luồng PULL (scraper) để đọc lại giá trị từ URL nguồn
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  // Nút "🔄 Làm mới doanh thu" (DASHBOARD TỈNH): mass sync toàn bộ xã/phường.
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();
  // Cập nhật tức thời sau khi lưu "Thiết lập doanh thu" (khỏi chờ refetch dashboard)
  const [sourceOverride, setSourceOverride] = useState<{ maXa?: string; maTinh?: string } | null>(
    null
  );
  // ===== LỊCH SỬ GHI NHẬN (bảng kpi_revenue_history — migration 0009) =====
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  /** Tăng để buộc fetch lại history sau khi "Cào ngay" ghi xong. */
  const [historyVersion, setHistoryVersion] = useState(0);

  // ===== Domain gốc để ghép URL xem trước khi thiết lập ID (giống các khối khác) =====
  const baseDomain = (
    dashboard?.base_domain ||
    dashboard?.metadata?.base_domain ||
    dashboard?.domain_link ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  /** Mở modal "Thiết lập ID" cho 1 thẻ doanh thu, mang theo ID đã lưu (nếu có). */
  const handleOpenId = (key: string, label: string): void => {
    const id = getStoredMetricId(metricIds, key, metricLinks[key]);
    setMetricIdTarget({ key, label, id });
  };

  const isProvince = dashboard?.unit?.type === "PROVINCE";
  const unitName = (dashboard?.unit?.name || dashboard?.title || "").trim();

  // ===== Cấu hình nguồn Push-Data (lưu trong dashboards.settings.revenue) =====
  const savedSource = readRevenueSource(dashboard);
  const maXa = sourceOverride?.maXa || savedSource.ma_xa || defaultMaXa(dashboard);
  const maTinh =
    sourceOverride?.maTinh || savedSource.ma_tinh || (isProvince ? defaultMaXa(dashboard) : "");
  const hasSource = Boolean(maXa);

  // Lắng nghe Supabase Realtime: Xã -> doanh_thu_xa, Tỉnh -> doanh_thu_tinh
  const { liveXa, liveTinh, status, pulse } = useRevenueRealtime({
    maXa: isProvince ? null : maXa || null,
    maTinh: maTinh || null,
  });

  const realtimeValue =
    !isProvince && liveXa
      ? Number(liveXa.gia_tri)
      : liveTinh
        ? Number(liveTinh.gia_tri)
        : null;
  const realtimeConnected = status === "connected";

  /**
   * Nút "Cào ngay" — chủ động gọi luồng PULL để đọc lại `data-value` từ URL
   * nguồn. Giá trị chỉ được ghi khi THAY ĐỔ; lúc đó trigger 0007 tự ghi lịch
   * sử + cộng dồn tỉnh và Realtime sẽ đẩy số mới lên khối B3 (không cần F5).
   */
  const handleScrapeNow = async () => {
    if (scraping || !dashboard?.id) return;
    setScraping(true);
    setScrapeMsg(null);
    try {
      // Gọi API cron-b3 (POST): fetch HTML nguồn -> bóc data-value ->
      // so sánh current_value -> ghi dashboards.b3 + INSERT lịch sử.
      const res = await fetch("/api/v1/metrics/cron-b3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardId: dashboard.id }),
      });
      const payload = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        scanned?: number;
        changed?: number;
        unchanged?: number;
        errors?: number;
        historySaved?: number;
        results?: { error?: string }[];
      } | null;

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const changed = payload.changed ?? 0;
      const scanned = payload.scanned ?? 0;
      const errors = payload.errors ?? 0;

      if (changed > 0) {
        const savedNote = (payload.historySaved ?? 0) > 0 ? " · đã lưu lịch sử" : "";
        setScrapeMsg(`Đã cập nhật ${changed} chỉ số mới${savedNote}`);
      } else if (errors > 0) {
        setScrapeMsg(payload.results?.find((r) => r.error)?.error || "Lỗi đọc dữ liệu nguồn");
      } else if (scanned > 0) {
        setScrapeMsg("Dữ liệu đã là mới nhất");
      } else {
        setScrapeMsg("Chưa có link cào nào được thiết lập");
      }

      // Tải lại lịch sử cho biểu đồ + báo cha refetch 5 thẻ B3.
      setHistoryVersion((v) => v + 1);
      onChanged?.();
    } catch (err) {
      setScrapeMsg(err instanceof Error ? err.message : "Lỗi cào dữ liệu");
    } finally {
      setScraping(false);
      setTimeout(() => setScrapeMsg(null), 5000);
    }
  };

  /**
   * Nút "🔄 Làm mới doanh thu" — CHỈ dành cho Dashboard TỈNH (Admin).
   *
   * Gọi POST /api/v1/metrics/sync-all-b3 để:
   *   fetch web nguồn -> bóc `data-value` -> tính DELTA -> cộng dồn lũy kế
   *   (reset theo ngày/tuần/tháng/quý/năm) -> cập nhật `dashboards.b3`
   *   -> ghi `kpi_revenue_history`.
   *
   * Sau khi API trả 200: `onChanged?.()` kích hoạn `fetchAll()` ở component cha
   * (gọi lại `loadCommunes` để cộng dồn tổng các xã) + `router.refresh()` để đồng
   * bộ dữ liệu server. Cùng cơ chế với luồng "Cào ngay" ở Dashboard Xã.
   */
  const handleSyncAllRevenue = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setScrapeMsg(null);
    try {
      const res = await fetch("/api/v1/metrics/sync-all-b3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Giới hạn phạm vi đúng Tỉnh đang xem.
        body: JSON.stringify({ provinceUnitId: dashboard?.unit_id ?? null }),
      });

      const payload = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        message?: string;
        dashboards?: number;
        scanned?: number;
        changed?: number;
        errors?: number;
        historySaved?: number;
      } | null;

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const changed = payload.changed ?? 0;
      const scanned = payload.scanned ?? 0;
      const errors = payload.errors ?? 0;
      const dashCount = payload.dashboards ?? 0;

      if (changed > 0) {
        setScrapeMsg(`Đã làm mới ${changed}/${scanned} chỉ số trên ${dashCount} xã/phường`);
      } else if (errors > 0) {
        setScrapeMsg(`Đã quét ${scanned} chỉ số, có ${errors} lỗi`);
      } else {
        setScrapeMsg(`Đã đồng bộ ${dashCount} xã/phường — dữ liệu là mới nhất`);
      }

      // Tính lại tổng doanh thu Tỉnh + tải lại biểu đồ lịch sử.
      setHistoryVersion((v) => v + 1);
      onChanged?.();
      router.refresh();
    } catch (err) {
      setScrapeMsg(err instanceof Error ? err.message : "Lỗi đồng bộ doanh thu");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setScrapeMsg(null), 6000);
    }
  };

  // Tiêu đề khối B3 theo cấp đơn vị (Tỉnh vs Xã/Phường)
  const title = isProvince
    ? `B3: DÒNG CHẢY DOANH THU - TỈNH ${unitName.toUpperCase()}`
    : `B3: DÒNG CHẢY DOANH THU - ${unitName}`;

  // YÊU CẦU 1: Dashboard Tỉnh không cài đặt/cào — chỉ hiển thị dòng nhắc nhở.
  const note = isProvince
    ? "(Số liệu được tự động tổng hợp từ tất cả xã/phường trực thuộc)"
    : "Tổng hợp doanh thu của xã/phường đó";

  // ===== Đọc lịch sử `kpi_revenue_history` để vẽ biểu đồ =====
  // Dashboard Xã  -> history của chính nó.
  // Dashboard Tỉnh -> history của TẤT CẢ xã/phường (prop historyDashboardIds) để
  //                   biểu đồ tự cộng dồn khớp với 5 thẻ doanh thu.
  useEffect(() => {
    const ids =
      historyDashboardIds && historyDashboardIds.length > 0
        ? historyDashboardIds
        : dashboard?.id
          ? [dashboard.id]
          : [];

    let cancelled = false;

    if (ids.length === 0) {
      // Không setState đồng bộ trong effect body (react-hooks/set-state-in-effect);
      // đưa sang microtask để tránh render dây chuyền.
      queueMicrotask(() => {
        if (!cancelled) setHistoryRows([]);
      });
      return;
    }
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("kpi_revenue_history")
          .select("dashboard_id, daily, weekly, monthly, quarterly, yearly, scraped_at")
          .in("dashboard_id", ids)
          .order("scraped_at", { ascending: false })
          .limit(300);

        if (cancelled) return;
        if (error) {
          setHistoryRows([]);
          return;
        }
        setHistoryRows((data ?? []) as HistoryRow[]);
      } catch {
        if (!cancelled) setHistoryRows([]);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard?.id, historyDashboardIds?.join(","), historyVersion]);

  // Cron ghi thêm dòng vào `kpi_revenue_history` -> tự nạp lại biểu đồ,
  // không cần bấm tay. Bọc setState trong callback của Realtime (ngoài effect body).
  useEffect(() => {
    const channel = supabase
      .channel(`b3-history:${dashboard?.id ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kpi_revenue_history" },
        () => setHistoryVersion((v) => v + 1)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dashboard?.id]);

  const revenue = useMemo(() => readB3Revenue(data), [data]);
  // Ưu tiên LỊCH SỬ THẬT; khi bảng chưa có dữ liệu thì fallback về biểu đồ
  // mặc định (zeros) để giao diện không trống trước lần cào đầu tiên.
  const chartData = useMemo(
    () => buildHistorySeries(historyRows, range) ?? buildChartSeries(range),
    [historyRows, range]
  );
  const totalRevenue =
    revenue.daily + revenue.weekly + revenue.monthly + revenue.quarterly + revenue.yearly;

  // ===== BXH DOANH THU XÃ/PHƯỜNG (CHỈ Dashboard Tỉnh, 100% dữ liệu thật) =====
  // Tái sử dụng `timeFilter` chung với Biểu đồ: day/week/month/quarter/year.
  interface CommuneRankItem {
    id: string;
    name: string;
    revenue: number;
    growth: number;
  }

  const communeRanking = useMemo<CommuneRankItem[]>(() => {
    if (!isProvince) return [];
    const b3Key = TIME_FILTER_TO_B3_KEY[timeFilter];
    const historyField = RANGE_FIELD[timeFilter];

    // Map dashboard_id -> [bản ghi mới nhất, bản ghi cũ thứ 2] để tính growth thật.
    const historyByDash = new Map<string, HistoryRow[]>();
    for (const row of historyRows) {
      if (!row?.dashboard_id) continue;
      const list = historyByDash.get(row.dashboard_id) ?? [];
      list.push(row);
      historyByDash.set(row.dashboard_id, list);
    }
    for (const list of historyByDash.values()) {
      list.sort(
        (a, b) => Date.parse(b.scraped_at) - Date.parse(a.scraped_at)
      );
    }

    return (communesData ?? [])
      .filter((c) => c?.unit?.type !== "PROVINCE")
      .map((c) => {
        const rawB3 = (c as DashboardRow & { b3?: KpiRow | null }).b3 ?? {};
        const revenueValue = toNum(rawB3[b3Key as string]);
        const name =
          (c?.unit?.name || c?.title || "Chưa đặt tên").trim() ||
          "Chưa đặt tên";

        // Tốc độ tăng trưởng thật từ `kpi_revenue_history`:
        // ((Current - Previous) / Previous) * 100
        // TODO: Connect real history data đầy đủ hơn nếu cần so sánh theo kỳ (tháng trước/quý trước).
        let growth = 0;
        const hist = historyByDash.get(c.id);
        if (hist && hist.length >= 2) {
          const current = toNum(hist[0]?.[historyField]);
          const previous = toNum(hist[1]?.[historyField]);
          if (previous !== 0) {
            const g = ((current - previous) / Math.abs(previous)) * 100;
            growth = Number.isFinite(g) ? g : 0;
          } else if (current > 0) {
            growth = 100;
          }
        }

        return { id: c.id, name, revenue: revenueValue, growth };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [isProvince, communesData, timeFilter, historyRows]);

  /** Top 5 doanh thu CAO nhất. */
  const top5Highest = useMemo(
    () => communeRanking.slice(0, 5),
    [communeRanking]
  );

  /** Top 5 doanh thu THẤP nhất: 5 xã cuối, sắp xếp tăng dần để xã thấp nhất đứng đầu. */
  const top5Lowest = useMemo(() => {
    if (communeRanking.length === 0) return [];
    // Bỏ các xã có doanh thu = 0 để BXH bottom có ý nghĩa hơn (nếu tất cả = 0 thì giữ nguyên).
    const nonZero = communeRanking.filter((c) => c.revenue > 0);
    const source = nonZero.length > 0 ? nonZero : communeRanking;
    return source.slice(-5).reverse();
  }, [communeRanking]);

  const topRankingMax = top5Highest[0]?.revenue ?? 0;
  const bottomRankingMax = useMemo(
    () => top5Lowest.reduce((m, c) => Math.max(m, c.revenue), 0),
    [top5Lowest]
  );

  const cards = [
    { key: "b3_daily", label: "Doanh thu trong ngày", value: revenue.daily, color: "#22d3ee" },
    { key: "b3_weekly", label: "Doanh thu trong tuần", value: revenue.weekly, color: "#38bdf8" },
    { key: "b3_monthly", label: "Doanh thu trong tháng", value: revenue.monthly, color: "#34d399" },
    { key: "b3_quarterly", label: "Doanh thu trong quý", value: revenue.quarterly, color: "#fbbf24" },
    { key: "b3_yearly", label: "Doanh thu trong năm", value: revenue.yearly, color: "#a855f7" },
  ];

  return (
    <section className="mb-6 w-full rounded-2xl border border-cyan-500/20 bg-[#071326] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      {/* ===== TIÊU ĐỀ KHỐI + BỘ LỌC THỜI GIAN CHUNG ===== */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_-4px_rgba(6,182,212,0.5)]">
            <TrendingUp size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold uppercase tracking-wide text-cyan-400 sm:text-lg">
              {title}
            </h3>
            <p className="text-xs text-slate-400">{note}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Badge trạng thái kết nối Realtime */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
              realtimeConnected
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : status === "error"
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                realtimeConnected
                  ? "animate-pulse bg-emerald-400"
                  : status === "error"
                    ? "bg-rose-400"
                    : "bg-amber-400"
              }`}
            />
            {realtimeConnected ? "Realtime" : status === "error" ? "Realtime lỗi" : "Đang kết nối"}
          </span>

          {hasSource ? (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-300"
            >
              <History size={13} /> Lịch sử
            </button>
          ) : null}

          {scrapeMsg ? (
            <span className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300">
              {scrapeMsg}
            </span>
          ) : null}

          {/* ===== DASHBOARD TỈNH (Admin): nút MASS SYNC toàn tỉnh =====
              KHÔNG ảnh hưởng nhánh Dashboard Xã ở trên (giữ nguyên UI/logic). */}
          {isProvince && isAdmin ? (
            <button
              type="button"
              onClick={handleSyncAllRevenue}
              disabled={isSyncing}
              title="Quét lại doanh thu của tất cả xã/phường trực thuộc và cộng dồn lũy kế"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <span aria-hidden>🔄</span>
              )}
              {isSyncing ? "Đang làm mới..." : "Làm mới doanh thu"}
            </button>
          ) : null}

          {/* YÊU CẦU 1: 2 nút chỉ dành cho Dashboard XÃ/PHƯỜNG (Admin).
              Dashboard TỈNH ẩn hoàn toàn — số liệu do loadCommunes cộng dồn. */}
          {!isProvince && isAdmin ? (
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <Settings2 size={13} /> Thiết lập doanh thu
            </button>
          ) : null}

          {!isProvince && isAdmin ? (
            <button
              type="button"
              onClick={handleScrapeNow}
              disabled={scraping}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Zap size={13} className={scraping ? "animate-pulse" : undefined} />
              {scraping ? "Đang cào..." : "⚡ Cào ngay"}
            </button>
          ) : null}

          {/* BỘ LỌC THỜI GIAN CHUNG: điều khiển cả Biểu đồ + BXH Top 5 */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Bộ lọc thời gian B3">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTimeFilter(opt.key)}
                aria-pressed={timeFilter === opt.key}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${
                  timeFilter === opt.key
                    ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300 shadow-[0_0_16px_-6px_rgba(6,182,212,0.8)]"
                    : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== DẢI SỐ LIỆU REALTIME (tự "nhảy số", không cần F5) ===== */}
     

      {/* ===== HÀNG 1: 5 THẺ DOANH THU ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-2xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-gradient-to-b from-slate-900/90 to-[#0c1830]/90 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-500/40"
          >
            <span
              className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-15 blur-2xl"
              style={{ background: card.color }}
            />
            {/* NÚT "THIẾT LẬP ID" (chỉ Admin) — góc trên phải của thẻ */}
            {isAdmin && onSaveMetricId ? (
              <button
                type="button"
                onClick={() => handleOpenId(card.key, card.label)}
                title={`Thiết lập ID: ${card.label}`}
                aria-label={`Thiết lập ID ${card.label}`}
                className="absolute top-2 right-2 z-10 grid h-6 w-6 place-items-center rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 transition hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-300"
              >
                <Link2 size={12} />
              </button>
            ) : null}
            <p className="pr-7 text-[11px] font-medium leading-relaxed text-slate-400 sm:text-xs">
              {card.label}
            </p>
            <p
              className="mt-2 text-xl font-bold tabular-nums sm:text-2xl"
              style={{ color: card.color }}
            >
              {numberFmt.format(card.value)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              VNĐ
            </p>
          </div>
        ))}
      </div>

      {/* ===== HÀNG 2: BIỂU ĐỒ ĐƯỜNG ===== */}
      <div className="mt-5 rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <BarChart3 size={14} className="text-cyan-400" />
            TĂNG TRƯỞNG DOANH THU
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#1e293b" }}
                minTickGap={12}
              />
              <YAxis
                width={52}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#1e293b" }}
                domain={[0, "auto"]}
                allowDecimals={false}
                tickFormatter={(value) => numberFmt.format(Number(value))}
              />
              <Tooltip
                contentStyle={{
                  background: "#071326",
                  border: "1px solid rgba(6,182,212,0.35)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#e2e8f0",
                }}
                labelStyle={{ color: "#67e8f9", fontWeight: 600 }}
                formatter={(value) => [`${numberFmt.format(Number(value))} VNĐ`, "Doanh thu"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="Doanh thu"
                stroke="#22d3ee"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: "#22d3ee", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {totalRevenue === 0 && (
          <p className="mt-3 text-center text-[11px] text-slate-500">
            Chưa có dữ liệu doanh thu — số liệu sẽ được cập nhật khi API tổng hợp hoàn tất.
          </p>
        )}
      </div>

      {/* ===== HÀNG 3: BXH TOP 5 (CHỈ Dashboard Tỉnh) ===== */}
      {isProvince ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <div className="bg-[#0a1830]/50 border border-emerald-500/20 rounded-2xl p-5">
            <h4 className="mb-4 text-sm font-extrabold uppercase tracking-wide text-emerald-400">
              🏆 Top 5 Doanh Thu Cao Nhất
            </h4>
            {top5Highest.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                Chưa có dữ liệu xếp hạng.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="w-10 px-2 py-2">Hạng</th>
                    <th className="px-2 py-2">Xã/Phường</th>
                    <th className="px-2 py-2 text-right">Doanh thu</th>
                    <th className="px-2 py-2 text-right">Tăng trưởng</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {top5Highest.map((item, idx) => (
                      <TopRankRow
                        key={`${timeFilter}-${item.id}`}
                        rank={idx + 1}
                        index={idx}
                        item={item}
                        max={topRankingMax}
                        tone="emerald"
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-[#0a1830]/50 border border-rose-500/20 rounded-2xl p-5">
            <h4 className="mb-4 text-sm font-extrabold uppercase tracking-wide text-rose-400">
              ⚠️ Top 5 Doanh Thu Thấp Nhất
            </h4>
            {top5Lowest.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                Chưa có dữ liệu xếp hạng.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="w-10 px-2 py-2">Hạng</th>
                    <th className="px-2 py-2">Xã/Phường</th>
                    <th className="px-2 py-2 text-right">Doanh thu</th>
                    <th className="px-2 py-2 text-right">Tăng trưởng</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {top5Lowest.map((item, idx) => (
                      <TopRankRow
                        key={`${timeFilter}-${item.id}`}
                        rank={idx + 1}
                        index={idx}
                        item={item}
                        max={bottomRankingMax}
                        tone="rose"
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {/* ===== MODAL: THIẾT LẬP DOANH THU (dành cho Admin) ===== */}
      {showSetup ? (
        <RevenueSetupModal
          dashboard={dashboard}
          onClose={() => setShowSetup(false)}
          onSaved={(info) =>
            setSourceOverride({ maXa: info.maXa, maTinh: info.maTinh ?? undefined })
          }
        />
      ) : null}

      {/* ===== MODAL: LỊCH SỬ BIẾN ĐỘNG data-value ===== */}
      {showHistory ? (
        <Dialog open title="Lịch sử biến động doanh thu" onClose={() => setShowHistory(false)}>
          <RevenueHistoryLog maXa={maXa} />
        </Dialog>
      ) : null}

      {/* ===== MODAL: THIẾT LẬP ID THẺ DOANH THU (b3_daily … b3_yearly) ===== */}
      {metricIdTarget ? (
        <MetricIdModal
          dashboard={dashboard}
          metricKey={metricIdTarget.key}
          metricLabel={metricIdTarget.label}
          label={metricIdTarget.label}
          baseDomain={baseDomain}
          currentId={metricIdTarget.id}
          initialId={metricIdTarget.id}
          onClose={() => setMetricIdTarget(null)}
          onSave={async (k, id) => {
            if (onSaveMetricId) await onSaveMetricId(k, id);
          }}
        />
      ) : null}
    </section>
  );
}

export default B3RevenueSection;