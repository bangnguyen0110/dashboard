"use client";

/**
 * Modal "Bộ lọc và so sánh thông tin" cho Dashboard cấp Tỉnh / Xã-Phường.
 *
 * ⚠️ AN TOÀN HỆ THỐNG (zero regression):
 * - CHỈ ĐỌC dữ liệu KPI từ các bảng hiện có: kpi_business_units, kpi_products,
 *   metric_links, dashboards, administrative_units. KHÔNG ghi/không update gì lên Supabase.
 * - Không gọi bất kỳ API backend nào (refresh-all / sync-live / cron…) => không ảnh hưởng
 *   tới luồng cào dữ liệu và cấu trúc database.
 * - Mốc đối chiếu (kỳ trước) được truy vấn (CHỈ ĐỌC) từ kho lịch sử tập trung
 *   `kpi_history` (migration 0006, do tiến trình độc lập /api/v1/metrics/kpi-history/snapshot
 *   và cron 18:30 chốt mốc). Nếu kho này chưa có/không truy vấn được, tự lùi về
 *   mốc lưu trong localStorage của trình duyệt (`lib/kpi-snapshots.ts`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarRange,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardRow } from "@/lib/types";
import {
  currentMonthKey,
  defaultCompareMonths,
  isValidMonthKey,
  monthKeyOf,
  monthLabel,
  periodKeyOf,
  periodLabelFromMonth,
  periodMonths,
  type PeriodKind,
} from "@/lib/period-utils";
import {
  resolveKpiSnapshot,
  saveKpiSnapshot,
  type ResolvedKpiSnapshot,
} from "@/lib/kpi-snapshots";
import {
  KPI_HISTORY_SELECT,
  isMissingKpiHistoryError,
  pickHistoryMonth,
  scopeHistoryValues,
  type KpiHistoryRow,
} from "@/lib/kpi-history";
import {
  CompareDiffCard,
  CompareEmptyState,
  CompareNotice,
  CompareTableCard,
  type CompareMetricDef,
  type CompareRowResult,
} from "./kpi-compare-panels";

/* ------------------------------------------------------------------ */
/* Định nghĩa chỉ số so sánh (Khối B1 & B2)                             */
/* ------------------------------------------------------------------ */

const B1_COMPARE_METRICS: CompareMetricDef[] = [
  { key: "sme_total", short: "SME", label: "Tổng số doanh nghiệp SME", unit: "DN", color: "#22d3ee" },
  { key: "hkd_total", short: "HKD", label: "Tổng số Hộ kinh doanh", unit: "hộ", color: "#38bdf8" },
  { key: "htx_total", short: "HTX", label: "Tổng số Hợp tác xã", unit: "HTX", color: "#818cf8" },
  { key: "sme_cds", short: "SME CĐS", label: "Tổng số doanh nghiệp SME CĐS", unit: "DN", color: "#06d6a0" },
  { key: "hkd_cds", short: "HKD CĐS", label: "Tổng số Hộ kinh doanh CĐS", unit: "hộ", color: "#2dd4bf" },
  { key: "htx_cds", short: "HTX CĐS", label: "Tổng số Hợp tác xã CĐS", unit: "HTX", color: "#a855f7" },
];

const B2_COMPARE_METRICS: CompareMetricDef[] = [
  { key: "ocop_total", short: "Tổng OCOP", label: "Tổng số sản phẩm OCOP", unit: "SP", color: "#fbbf24" },
  { key: "ocop_3star", short: "OCOP 3★", label: "Sản phẩm OCOP 3 sao", unit: "SP", color: "#34d399" },
  { key: "ocop_4star", short: "OCOP 4★", label: "Sản phẩm OCOP 4 sao", unit: "SP", color: "#2dd4bf" },
  { key: "ocop_5star", short: "OCOP 5★", label: "Sản phẩm OCOP 5 sao", unit: "SP", color: "#f472b6" },
  { key: "sp_thuong", short: "SP thường", label: "Sản phẩm thường", unit: "SP", color: "#60a5fa" },
  { key: "dich_vu", short: "Dịch vụ", label: "Sản phẩm dịch vụ", unit: "DV", color: "#a78bfa" },
];

const COMPARE_METRIC_KEYS = [...B1_COMPARE_METRICS, ...B2_COMPARE_METRICS].map((def) => def.key);

/**
 * Tên cột trong DB cho từng chỉ số.
 * Lưu ý: backend ghi song song các cột tương đương (`sme_cds` & `sme_dx`,
 * `sp_thuong` & `normal_product`, `dich_vu` & `services_count`) nên lấy giá trị lớn hơn
 * để không bỏ sót số liệu.
 */
const B1_FIELD_ALIASES: Record<string, string[]> = {
  sme_total: ["sme_total"],
  hkd_total: ["hkd_total"],
  htx_total: ["htx_total"],
  sme_cds: ["sme_cds", "sme_dx"],
  hkd_cds: ["hkd_cds", "hkd_dx"],
  htx_cds: ["htx_cds", "htx_dx"],
};

const B2_FIELD_ALIASES: Record<string, string[]> = {
  ocop_3star: ["ocop_3star"],
  ocop_4star: ["ocop_4star"],
  ocop_5star: ["ocop_5star"],
  sp_thuong: ["sp_thuong", "normal_product"],
  dich_vu: ["dich_vu", "services_count"],
};

/** metric_key trong bảng metric_links -> chỉ số so sánh tương ứng. */
const LINK_METRIC_TO_FIELD: Record<string, string> = {
  b1_sme_total: "sme_total",
  b1_hkd_total: "hkd_total",
  b1_htx_total: "htx_total",
  b1_sme_dx: "sme_cds",
  b1_sme_cds: "sme_cds",
  b1_hkd_dx: "hkd_cds",
  b1_hkd_cds: "hkd_cds",
  b1_htx_dx: "htx_cds",
  b1_htx_cds: "htx_cds",
  b2_ocop_3: "ocop_3star",
  b2_ocop_4: "ocop_4star",
  b2_ocop_5: "ocop_5star",
  b2_sp_thuong: "sp_thuong",
  b2_dich_vu: "dich_vu",
};

const KIND_OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: "month", label: "Lọc theo tháng" },
  { value: "quarter", label: "Lọc theo quý" },
  { value: "year", label: "Lọc theo năm" },
];

/* ------------------------------------------------------------------ */
/* Helpers đọc & chuẩn hoá số liệu (chỉ đọc)                            */
/* ------------------------------------------------------------------ */

function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof raw === "object") {
    const nested = (raw as { value?: unknown }).value;
    return nested === undefined || nested === null ? null : toNumber(nested);
  }
  return null;
}

function pickAlias(row: Record<string, unknown>, aliases: string[]): number {
  let best = 0;
  for (const alias of aliases) {
    const parsed = toNumber(row[alias]);
    if (parsed !== null && parsed > best) best = parsed;
  }
  return best;
}

interface ScopedValuesResult {
  values: Record<string, number>;
  /** Có bản ghi KPI thật trong DB hay không (phân biệt "dữ liệu 0" và "không có dữ liệu"). */
  hasData: boolean;
}

/**
 * Đọc KPI (B1 + B2) của một nhóm dashboard và cộng dồn thành một bộ giá trị duy nhất.
 * Hoàn toàn READ-ONLY, không đi qua API route nào.
 */
async function fetchScopedKpiValues(dashboardIds: string[]): Promise<ScopedValuesResult> {
  const values: Record<string, number> = {};
  if (dashboardIds.length === 0) return { values, hasData: false };

  const [b1Res, b2Res, linkRes] = await Promise.all([
    supabase.from("kpi_business_units").select("*").in("dashboard_id", dashboardIds),
    supabase.from("kpi_products").select("*").in("dashboard_id", dashboardIds),
    supabase
      .from("metric_links")
      .select("dashboard_id, metric_key, current_value")
      .in("dashboard_id", dashboardIds),
  ]);

  const perDashboard = new Map<string, Record<string, number>>();
  const bucketFor = (id: string): Record<string, number> => {
    const existing = perDashboard.get(id);
    if (existing) return existing;
    const created: Record<string, number> = {};
    perDashboard.set(id, created);
    return created;
  };

  for (const row of (b1Res.data ?? []) as Record<string, unknown>[]) {
    const bucket = bucketFor(String(row.dashboard_id));
    for (const [key, aliases] of Object.entries(B1_FIELD_ALIASES)) {
      bucket[key] = pickAlias(row, aliases);
    }
  }

  for (const row of (b2Res.data ?? []) as Record<string, unknown>[]) {
    const bucket = bucketFor(String(row.dashboard_id));
    for (const [key, aliases] of Object.entries(B2_FIELD_ALIASES)) {
      bucket[key] = pickAlias(row, aliases);
    }
  }

  // Bổ sung giá trị bóc tách mới nhất trong metric_links (chỉ đọc, không ghi ngược lại DB)
  for (const link of (linkRes.data ?? []) as {
    dashboard_id: string;
    metric_key: string;
    current_value: unknown;
  }[]) {
    const field = LINK_METRIC_TO_FIELD[link.metric_key];
    if (!field) continue;
    const parsed = toNumber(link.current_value);
    if (parsed === null) continue;
    const bucket = bucketFor(link.dashboard_id);
    if (parsed > 0 || !bucket[field]) bucket[field] = parsed;
  }

  for (const bucket of perDashboard.values()) {
    bucket.ocop_total =
      (bucket.ocop_3star ?? 0) + (bucket.ocop_4star ?? 0) + (bucket.ocop_5star ?? 0);
    for (const key of COMPARE_METRIC_KEYS) {
      values[key] = (values[key] ?? 0) + (bucket[key] ?? 0);
    }
  }

  const hasData =
    (b1Res.data?.length ?? 0) + (b2Res.data?.length ?? 0) + (linkRes.data?.length ?? 0) > 0;

  return { values, hasData };
}

function buildRows(
  defs: CompareMetricDef[],
  current: Record<string, number> | null,
  previous: Record<string, number> | null
): CompareRowResult[] {
  return defs.map((def) => {
    const currentValue = current?.[def.key] ?? 0;
    if (!previous) {
      return { def, current: currentValue, previous: null, diff: null };
    }
    const previousValue = previous[def.key] ?? 0;
    return {
      def,
      current: currentValue,
      previous: previousValue,
      diff: currentValue - previousValue,
    };
  });
}

function sumValues(values: Record<string, number> | null): number {
  if (!values) return 0;
  return COMPARE_METRIC_KEYS.reduce((total, key) => total + (values[key] ?? 0), 0);
}

/* ------------------------------------------------------------------ */
/* Component chính                                                      */
/* ------------------------------------------------------------------ */

export interface KpiFilterCompareModalProps {
  open: boolean;
  dashboard: DashboardRow;
  onClose: () => void;
}

interface QueryResultState {
  currentValues: Record<string, number> | null;
  compareValues: Record<string, number> | null;
  hasData: boolean;
  scopeLabel: string;
  capturedPeriod: string | null;
  compareSnapshot: ResolvedKpiSnapshot | null;
  /** Nguồn của mốc đối chiếu: db = bảng kpi_history, local = localStorage dự phòng. */
  compareSource: "db" | "local" | null;
  /** true = bảng kpi_history chưa tồn tại (chưa chạy migration 0006). */
  historyMissing: boolean;
}

export function KpiFilterCompareModal({ open, dashboard, onClose }: KpiFilterCompareModalProps) {
  const isProvince = dashboard.unit?.type === "PROVINCE";

  const [kind, setKind] = useState<PeriodKind>("month");
  const [unitFilter, setUnitFilter] = useState("");
  const [communes, setCommunes] = useState<DashboardRow[]>([]);
  const [communesLoading, setCommunesLoading] = useState(false);
  const [baseLoaded, setBaseLoaded] = useState(false);

  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<QueryResultState | null>(null);

  const requestRef = useRef(0);

  /** Tháng của lần đồng bộ dữ liệu gần nhất (mốc "kỳ hiện tại" mặc định). */
  const dataMonthKey = useMemo(() => {
    const meta = (dashboard.metadata ?? {}) as Record<string, unknown>;
    const raw = meta.last_sync_at ?? meta.last_synced_at ?? dashboard.updated_at;
    return monthKeyOf(raw as string) ?? currentMonthKey();
  }, [dashboard]);

  /**
   * Nạp danh sách xã/phường trực thuộc (CHỈ ĐỌC).
   * Component được mount lại mỗi lần mở popup nên state luôn khởi tạo sạch —
   * không cần reset thủ công trong effect.
   */
  useEffect(() => {
    if (!open) return;
    let active = true;

    void (async () => {
      if (isProvince && dashboard.unit_id) {
        setCommunesLoading(true);
        const { data: childUnits } = await supabase
          .from("administrative_units")
          .select("id")
          .eq("parent_id", dashboard.unit_id);
        const childIds = (childUnits ?? []).map((unit) => unit.id);

        if (childIds.length > 0) {
          const { data: communeRows } = await supabase
            .from("dashboards")
            .select("id, unit_id, title, metadata, unit:administrative_units(*)")
            .in("unit_id", childIds)
            .order("title", { ascending: true });
          // Truy vấn Supabase trả về `unit` dạng mảng (schema không được sinh type),
          // nên ép kiểu tường minh qua `unknown` giống các truy vấn hiện có trong dự án.
          if (active) setCommunes((communeRows ?? []) as unknown as DashboardRow[]);
        }
        if (active) setCommunesLoading(false);
      }

      if (!active) return;
      const defaults = defaultCompareMonths("month", dataMonthKey);
      setFromMonth(defaults.from);
      setToMonth(defaults.to);
      setBaseLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [open, isProvince, dashboard.unit_id, dataMonthKey]);

  /* ---------------- Chạy 1 lượt lọc + đối chiếu (chỉ đọc) ---------------- */
  const runQuery = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setLoadError(null);

    try {
      const isWholeProvince = isProvince && !unitFilter;
      const selectedCommune = unitFilter ? communes.find((c) => c.id === unitFilter) ?? null : null;

      const sourceDashboards: DashboardRow[] = isWholeProvince
        ? communes
        : selectedCommune
          ? [selectedCommune]
          : [dashboard];

      const sourceIds = sourceDashboards.map((item) => item.id);
      let scoped = await fetchScopedKpiValues(sourceIds);

      // Dự phòng cho cấp Tỉnh: nếu chưa tổng hợp được từ xã/phường thì dùng số liệu của chính Tỉnh.
      if (isWholeProvince && (!scoped.hasData || sumValues(scoped.values) === 0)) {
        const own = await fetchScopedKpiValues([dashboard.id]);
        if (own.hasData && (sumValues(own.values) > 0 || !scoped.hasData)) scoped = own;
      }

      // Kỳ hiện tại & kỳ so sánh
      const currentPeriodKey = periodKeyOf(kind, toMonth);
      const comparePeriodKey = periodKeyOf(kind, fromMonth);
      const samePeriodFlag = currentPeriodKey === comparePeriodKey;
      const compareMonths = periodMonths(kind, comparePeriodKey);

      const scopeKey = isWholeProvince
        ? `province:${dashboard.unit_id ?? dashboard.id}`
        : `unit:${sourceDashboards[0]?.unit_id ?? dashboard.unit_id ?? dashboard.id}`;

      const scopeLabel = isWholeProvince
        ? `Toàn tỉnh (tổng hợp ${sourceDashboards.length} xã/phường)`
        : `${sourceDashboards[0]?.unit?.name ?? dashboard.unit?.name ?? dashboard.title}`;

      const scopeMeta = (isWholeProvince
        ? dashboard.metadata ?? {}
        : sourceDashboards[0]?.metadata ?? {}) as Record<string, unknown>;
      const scopeSyncAt = scopeMeta.last_sync_at ?? scopeMeta.last_synced_at;
      const capturePeriod = monthKeyOf(scopeSyncAt as string) ?? dataMonthKey;

      // Ghi nhận thêm mốc vào localStorage (dự phòng khi kho lịch sử DB chưa có kỳ)
      let capturedPeriod: string | null = null;
      if (scoped.hasData) {
        const entry = saveKpiSnapshot(scopeKey, capturePeriod, scoped.values);
        capturedPeriod = entry?.period ?? null;
      }

      /* ----- Đối chiếu: ƯU TIÊN kho lịch sử DB (`kpi_history`), -----
         ----- fallback về localStorage khi DB chưa có dữ liệu kỳ đó. ----- */
      let compareSnapshot: ResolvedKpiSnapshot | null = null;
      let compareSource: "db" | "local" | null = null;
      let historyMissing = false;

      if (!samePeriodFlag && compareMonths.length > 0) {
        let historyRows: KpiHistoryRow[] | null = null;
        try {
          const { data, error } = await supabase
            .from("kpi_history")
            .select(KPI_HISTORY_SELECT)
            .in("dashboard_id", sourceIds);
          if (!error) {
            historyRows = (data ?? []) as unknown as KpiHistoryRow[];
          } else if (isMissingKpiHistoryError(error)) {
            historyMissing = true;
          }
        } catch {
          historyRows = null;
        }

        if (historyRows) {
          // Chọn tháng có mốc trong kỳ so sánh (quý/năm: lấy tháng gần nhất có dữ liệu)
          const matchedMonth = pickHistoryMonth(historyRows, compareMonths);
          const values = matchedMonth
            ? scopeHistoryValues(historyRows, matchedMonth, {
                // Ưu tiên dòng đã tổng hợp sẵn của chính Tỉnh (nếu đang xem toàn tỉnh)
                preferDashboardId: isWholeProvince ? dashboard.id : null,
                scopeDashboardIds: sourceIds,
              })
            : null;
          if (values) {
            compareSnapshot = {
              entry: {
                period: matchedMonth as string,
                capturedAt: "",
                values,
              },
              matchedPeriod: matchedMonth as string,
              exact: true,
            };
            compareSource = "db";
          }
        }

        // Fallback localStorage (kể cả khi kho DB thiếu kỳ này)
        if (!compareSnapshot) {
          const localSnapshot = resolveKpiSnapshot(scopeKey, compareMonths, compareMonths[0]);
          if (localSnapshot) {
            compareSnapshot = localSnapshot;
            compareSource = "local";
          }
        }
      }

      if (requestRef.current !== requestId) return;

      setResult({
        currentValues: scoped.hasData ? scoped.values : null,
        compareValues: compareSnapshot ? compareSnapshot.entry.values : null,
        hasData: scoped.hasData,
        scopeLabel,
        capturedPeriod,
        compareSnapshot,
        compareSource,
        historyMissing,
      });
    } catch (error) {
      if (requestRef.current !== requestId) return;
      console.error("Lỗi bộ lọc so sánh thông tin:", error);
      setLoadError("Không thể đọc dữ liệu KPI. Vui lòng kiểm tra kết nối và thử lại.");
      setResult(null);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [communes, dashboard, dataMonthKey, fromMonth, isProvince, kind, toMonth, unitFilter]);

  /* Tự chạy lại khi mở popup, đổi bộ lọc, hoặc bấm nút "Lọc" */
  useEffect(() => {
    if (!open || !baseLoaded) return;
    if (!isValidMonthKey(fromMonth) || !isValidMonthKey(toMonth)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc dữ liệu KPI (chỉ đọc) theo bộ lọc; setState nằm sau await
    void runQuery();
  }, [open, baseLoaded, fromMonth, toMonth, unitFilter, kind, refreshToken, runQuery]);

  /* Đóng popup bằng phím ESC */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleKindChange = useCallback(
    (next: PeriodKind) => {
      if (next === kind) return;
      const defaults = defaultCompareMonths(next, dataMonthKey);
      setKind(next);
      setToMonth(defaults.to);
      setFromMonth(defaults.from);
    },
    [dataMonthKey, kind]
  );

  /* ---------------- Giá trị dẫn xuất ---------------- */
  const currentValues = result?.currentValues ?? null;
  const compareValues = result?.compareValues ?? null;

  const b1Rows = useMemo(
    () => buildRows(B1_COMPARE_METRICS, currentValues, compareValues),
    [currentValues, compareValues]
  );
  const b2Rows = useMemo(
    () => buildRows(B2_COMPARE_METRICS, currentValues, compareValues),
    [currentValues, compareValues]
  );

  const samePeriod =
    isValidMonthKey(fromMonth) &&
    isValidMonthKey(toMonth) &&
    periodKeyOf(kind, fromMonth) === periodKeyOf(kind, toMonth);

  const currentPeriodText = isValidMonthKey(toMonth) ? periodLabelFromMonth(kind, toMonth) : "—";
  const comparePeriodText = isValidMonthKey(fromMonth) ? periodLabelFromMonth(kind, fromMonth) : "—";
  const compareColumnLabel = result?.compareSnapshot
    ? `Mốc đối chiếu · ${monthLabel(result.compareSnapshot.matchedPeriod)}${
        result.compareSource === "local" ? "" : ""
      }`
    : `Mốc đối chiếu · ${comparePeriodText}`;
  const currentColumnLabel = `Kỳ hiện tại · ${currentPeriodText}`;

  const hasData = result?.hasData ?? false;
  const missingCompareData = !loading && !!result && !result.compareSnapshot;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-2 sm:p-4">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="glass-strong relative z-50 flex h-[95vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl p-3.5 shadow-2xl sm:p-6">
        {/* Header */}
        <div className="mb-3 flex shrink-0 items-start justify-between gap-3 border-b border-white/5 pb-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-accent sm:text-base">
              <SlidersHorizontal size={17} className="shrink-0" />
              <span className="truncate">Bộ lọc và so sánh thông tin</span>
            </h3>
            <p className="mt-0.5 truncate text-[11px] opacity-60 sm:text-xs">
              {dashboard.unit?.name ?? dashboard.title} ·{" "}
              {isProvince ? "Dashboard cấp Tỉnh" : "Dashboard cấp Xã/Phường"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-foreground/60 transition hover:bg-white/10 hover:text-foreground"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Vùng nội dung cuộn */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          <FilterBar
            kind={kind}
            onKindChange={handleKindChange}
            isProvince={isProvince}
            communes={communes}
            communesLoading={communesLoading}
            unitFilter={unitFilter}
            onUnitFilterChange={setUnitFilter}
            fromMonth={fromMonth}
            toMonth={toMonth}
            onFromMonthChange={setFromMonth}
            onToMonthChange={setToMonth}
            onRun={() => setRefreshToken((token) => token + 1)}
            loading={loading}
            scopeLabel={result?.scopeLabel ?? (communesLoading ? "Đang tải xã/phường…" : "—")}
            capturedPeriod={result?.capturedPeriod ?? null}
          />

          <div className="mt-3 space-y-2">
            {loadError && <CompareNotice tone="error">{loadError}</CompareNotice>}

            {!loadError && samePeriod && (
              <CompareNotice tone="warning">
                Mốc <strong>Từ</strong> và <strong>Đến</strong> đang thuộc cùng một kỳ (
                {currentPeriodText}). Vui lòng chọn hai kỳ khác nhau để so sánh.
              </CompareNotice>
            )}

            {!loadError && missingCompareData && !samePeriod && (
              <CompareNotice tone="warning">
                Chưa có mốc dữ liệu cho kỳ so sánh ({comparePeriodText}). Hệ thống đã ghi nhận mốc{" "}
                {result?.capturedPeriod ? monthLabel(result.capturedPeriod) : "hiện tại"} cho{" "}
                {result?.scopeLabel ?? "phạm vi này"}; số liệu đối chiếu sẽ xuất hiện khi kỳ tiếp
                theo được ghi nhận.
              </CompareNotice>
            )}

            {!loadError &&
              result?.compareSnapshot &&
              !result.compareSnapshot.exact &&
              !samePeriod && (
                <CompareNotice tone="info">
                  Kỳ so sánh chưa có mốc đúng kỳ, đang dùng mốc gần nhất:{" "}
                  <strong>{monthLabel(result.compareSnapshot.matchedPeriod)}</strong>.
                </CompareNotice>
              )}

           
          </div>

          <div className="mt-4 space-y-4">
            {loading ? (
              <>
                <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                  <CompareTableCard
                    title="Bảng so sánh · Khối Doanh nghiệp, Hộ kinh doanh & Hợp tác xã (KPI B1)"
                    rows={b1Rows}
                    compareLabel={compareColumnLabel}
                    currentLabel={currentColumnLabel}
                    loading
                  />
                  <CompareDiffCard
                    title="Chênh lệch & Biểu đồ · Doanh nghiệp, HKD & HTX (KPI B1)"
                    rows={b1Rows}
                    loading
                  />
                </div>
                <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                  <CompareTableCard
                    title="Bảng so sánh · Khối Sản phẩm & Dịch vụ (KPI B2)"
                    rows={b2Rows}
                    compareLabel={compareColumnLabel}
                    currentLabel={currentColumnLabel}
                    loading
                  />
                  <CompareDiffCard
                    title="Chênh lệch & Biểu đồ · Sản phẩm & Dịch vụ (KPI B2)"
                    rows={b2Rows}
                    loading
                  />
                </div>
              </>
            ) : !hasData ? (
              <CompareEmptyState
                title="Không có dữ liệu trong khoảng thời gian tra cứu"
                description={`Chưa ghi nhận số liệu KPI cho ${
                  result?.scopeLabel ?? "phạm vi đã chọn"
                }. Hãy chọn đơn vị khác, đổi mốc thời gian hoặc đồng bộ dữ liệu từ Dashboard rồi thử lại.`}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                  <CompareTableCard
                    title="Bảng so sánh · Khối Doanh nghiệp, Hộ kinh doanh & Hợp tác xã (KPI B1)"
                    subtitle={`Đối chiếu ${compareColumnLabel.replace(
                      "Mốc đối chiếu · ",
                      ""
                    )} và ${currentPeriodText} · ${result?.scopeLabel ?? ""}`}
                    rows={b1Rows}
                    compareLabel={compareColumnLabel}
                    currentLabel={currentColumnLabel}
                    loading={false}
                  />
                  <CompareDiffCard
                    title="Chênh lệch & Biểu đồ · Doanh nghiệp, HKD & HTX (KPI B1)"
                    subtitle="Mũi tên xanh = tăng, đỏ = giảm; biểu đồ cột thể hiện mức chênh lệch từng chỉ số."
                    rows={b1Rows}
                    loading={false}
                  />
                </div>

                <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                  <CompareTableCard
                    title="Bảng so sánh · Khối Sản phẩm & Dịch vụ (KPI B2)"
                    subtitle={`Đối chiếu sản phẩm OCOP và sản phẩm/dịch vụ · ${
                      result?.scopeLabel ?? ""
                    }`}
                    rows={b2Rows}
                    compareLabel={compareColumnLabel}
                    currentLabel={currentColumnLabel}
                    loading={false}
                  />
                  <CompareDiffCard
                    title="Chênh lệch & Biểu đồ · Sản phẩm & Dịch vụ (KPI B2)"
                    subtitle="Mũi tên xanh = tăng, đỏ = giảm; biểu đồ cột thể hiện mức chênh lệch từng chỉ số."
                    rows={b2Rows}
                    loading={false}
                  />
                </div>
              </>
            )}
          </div>

          <p className="mt-4 text-[10px] leading-relaxed opacity-50 sm:text-[11px]">
            📌 Số liệu <strong>kỳ hiện tại</strong> được đọc trực tiếp (chỉ đọc) từ bảng KPI{" "}
            kpi_business_units / kpi_products / metric_links. <strong>Mốc đối chiếu ưu tiên lấy từ
            kho lịch sử tập trung</strong> (bảng <code>kpi_history</code> — được tiến trình chốt mốc
            độc lập lưu sau mỗi lần đồng bộ, xem <code>/api/v1/metrics/kpi-history/snapshot</code> và
            cron 18:30 trên Vercel); nếu kho này chưa có kỳ cần so sánh, hệ thống tự dùng mốc lưu tại
            trình duyệt này (đánh dấu “máy này”). Toàn bộ tính năng chỉ đọc, không đụng tới luồng cào
            và đồng bộ dữ liệu.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thanh điều khiển bộ lọc (Top Filter Bar)                             */
/* ------------------------------------------------------------------ */

interface FilterBarProps {
  kind: PeriodKind;
  onKindChange: (next: PeriodKind) => void;
  isProvince: boolean;
  communes: DashboardRow[];
  communesLoading: boolean;
  unitFilter: string;
  onUnitFilterChange: (value: string) => void;
  fromMonth: string;
  toMonth: string;
  onFromMonthChange: (value: string) => void;
  onToMonthChange: (value: string) => void;
  onRun: () => void;
  loading: boolean;
  scopeLabel: string;
  capturedPeriod: string | null;
}

function FilterBar({
  kind,
  onKindChange,
  isProvince,
  communes,
  communesLoading,
  unitFilter,
  onUnitFilterChange,
  fromMonth,
  toMonth,
  onFromMonthChange,
  onToMonthChange,
  onRun,
  loading,
  scopeLabel,
  capturedPeriod,
}: FilterBarProps) {
  return (
    <div className="glass rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Nhóm nút chuyển nhanh */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onKindChange(option.value)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                kind === option.value
                  ? "bg-accent text-white shadow"
                  : "text-foreground/70 hover:text-accent"
              }`}
              aria-pressed={kind === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Dropdown đơn vị — chỉ hiển thị ở Dashboard cấp Tỉnh */}
        {isProvince && (
          <label className="relative block">
            <Building2
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
            />
            <select
              value={unitFilter}
              onChange={(event) => onUnitFilterChange(event.target.value)}
              className="glass w-full max-w-[280px] appearance-none rounded-xl py-2 pl-8 pr-8 text-[11px] outline-none focus:ring-2 focus:ring-accent sm:text-xs"
              aria-label="Lọc theo đơn vị xã/phường trực thuộc"
            >
              <option value="">
                {communesLoading ? "Đang tải xã/phường…" : "Lọc theo đơn vị (tất cả xã/phường)"}
              </option>
              {communes.map((commune) => (
                <option key={commune.id} value={commune.id}>
                  {commune.unit?.name ?? commune.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
            />
          </label>
        )}

        {/* Mốc so sánh: Từ / Đến */}
        <div className="glass flex flex-wrap items-center gap-1.5 rounded-xl px-2.5 py-1.5">
          <CalendarRange size={14} className="shrink-0 opacity-60" />
          <span className="text-[10px] uppercase tracking-wider opacity-60">Từ</span>
          <input
            type="month"
            value={fromMonth}
            max={toMonth || undefined}
            onChange={(event) => onFromMonthChange(event.target.value)}
            className="bg-transparent text-[11px] outline-none sm:text-xs"
            aria-label="Mốc so sánh từ tháng"
          />
          <span className="text-[10px] uppercase tracking-wider opacity-60">Đến</span>
          <input
            type="month"
            value={toMonth}
            onChange={(event) => onToMonthChange(event.target.value)}
            className="bg-transparent text-[11px] outline-none sm:text-xs"
            aria-label="Mốc so sánh đến tháng"
          />
        </div>

        {/* Nút thực thi */}
        <button
          type="button"
          onClick={onRun}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-[11px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <SlidersHorizontal size={14} />}
          <span>{loading ? "Đang lọc…" : "Lọc"}</span>
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] opacity-70 sm:text-[11px]">
        <span>
          Phạm vi: <strong className="font-semibold">{scopeLabel}</strong>
        </span>
        <span className="hidden opacity-40 sm:inline">•</span>
        <span>
          Kỳ so sánh: <strong className="font-semibold">{periodLabelText(kind, fromMonth)}</strong>
        </span>
        <span className="hidden opacity-40 sm:inline">•</span>
        <span>
          Kỳ hiện tại: <strong className="font-semibold">{periodLabelText(kind, toMonth)}</strong>
        </span>
        {capturedPeriod && (
          <>
            <span className="hidden opacity-40 sm:inline">•</span>
            <span className="text-cyan-600 dark:text-cyan-400">
              Đã ghi nhận mốc {monthLabel(capturedPeriod)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function periodLabelText(kind: PeriodKind, monthKey: string): string {
  return isValidMonthKey(monthKey) ? periodLabelFromMonth(kind, monthKey) : "—";
}