"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  FileUp,
  Globe,
  Link2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/server-utils";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { ThemeToggle } from "./theme-toggle";
import { LevelMenu, LEVELS, useLevelParam } from "./level-menu";
import { LinkModal } from "./link-modal";
import { ImportPdfModal } from "./import-pdf-modal";
import { CommuneDashboardModal } from "./commune-dashboard-modal";
import { CellQuantityModal } from "./blocks/cell-quantity-modal";
import B1Section from "./blocks/b1-section";
import { B2Section } from "./blocks/b2-section";
import { useAuth } from "@/context/AuthContext";

/**
 * Hiển thị chi tiết một Dashboard (Tỉnh hoặc Xã/Phường):
 * - Sidebar 5 tầng (mặc định Tầng 1) ở bên trái.
 * - Chỉ 2 khối nội dung chính: Khối B1 (Đơn vị KD) và Khối B2 (Sản phẩm trên địa bàn).
 * - Header có nút "Import PDF" (cạnh nút sáng/tối) để bóc tách & tự điền B1/B2.
 */

interface DashboardDetailProps {
  dashboardId: string;
  backHref: string;
}

type ResolvedState = "loading" | "missing" | "ready";

/**
 * Mapping 2 chiều giữa `metricKey` (từ Modal Khối B1) và các cột trong DB
 * `kpi_business_units`. CHỈ ghi các cột ĐÃ XÁC MINH tồn tại trong schema
 * thực tế.
 */
const B1_QTY_METRIC_FIELDS: Record<string, string[]> = {
  b1_sme_total: ["sme_total"],
  b1_hkd_total: ["hkd_total"],
  b1_htx_total: ["htx_total"],
  // CĐS: ghi cả sme_dx (cột hiển thị) + sme_cds (cột đồng bộ cấp Tỉnh)
  b1_sme_dx: ["sme_dx", "sme_cds"],
  b1_hkd_dx: ["hkd_dx", "hkd_cds"],
  b1_htx_dx: ["htx_dx", "htx_cds"],
};

/**
 * Mapping metricKey Khối B2 -> cột thực tế trong bảng `kpi_products`
 */
const B2_QTY_METRIC_FIELDS: Record<string, string[]> = {
  b2_ocop_3: ["ocop_3star"],
  b2_ocop_4: ["ocop_4star"],
  b2_ocop_5: ["ocop_5star"],
  b2_sp_thuong: ["sp_thuong"],
  b2_dich_vu: ["dich_vu"],
};

const B1_QTY_LABELS: Record<string, string> = {
  b1_sme_total: "Tổng số Doanh nghiệp SME",
  b1_hkd_total: "Tổng số Hộ kinh doanh",
  b1_htx_total: "Tổng số Hợp tác xã",
  b1_sme_dx: "Doanh nghiệp SME CĐS",
  b1_hkd_dx: "Hộ kinh doanh CĐS",
  b1_htx_dx: "Hợp tác xã CĐS",
};

const B1_QTY_TOKENS: Record<string, string[]> = {
  b1_sme_total: ["doanh nghiệp SME", "sme"],
  b1_hkd_total: ["hộ kinh doanh", "hkd"],
  b1_htx_total: ["hợp tác xã", "htx"],
  b1_sme_dx: ["doanh nghiệp SME CĐS", "sme cds"],
  b1_hkd_dx: ["hộ kinh doanh CĐS", "hkd cds"],
  b1_htx_dx: ["hợp tác xã CĐS", "htx cds"],
};

export function DashboardDetail({ dashboardId, backHref }: DashboardDetailProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [state, setState] = useState<ResolvedState>("loading");
  const [dashboard, setDashboard] = useState<DashboardRow | null>(null);
  const [b1, setB1] = useState<KpiRow>({});
  const [b2, setB2] = useState<KpiRow>({});
  const [metricLinks, setMetricLinks] = useState<Record<string, string>>({});
  const [communes, setCommunes] = useState<DashboardRow[]>([]);
  const [communeKpi, setCommuneKpi] = useState<Record<string, { b1?: KpiRow; b2?: KpiRow }>>({});
  const [parentProvince, setParentProvince] = useState<DashboardRow | null>(null);

  const [level, setLevel] = useLevelParam(1);
  const [showLink, setShowLink] = useState(false);
  const [showImportPdf, setShowImportPdf] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Modal Setup số lượng Khối B1
  const [b1QtyTarget, setB1QtyTarget] = useState<{
    metricKey: string;
    fields: string[];
    label: string;
    current: number;
    matchTokens: string[];
  } | null>(null);

  // Popup: danh sách dashboard xã/phường thuộc Tỉnh (Tầng 1)
  const [showCommuneList, setShowCommuneList] = useState(false);
  // Dashboard Xã/Phường đang được mở modal link / setup số lượng riêng
  const [communeLinkTarget, setCommuneLinkTarget] = useState<DashboardRow | null>(null);
  const [communeQuantityTarget, setCommuneQuantityTarget] = useState<{
    dashboard: DashboardRow;
    field: string;
    label: string;
    current: number;
    matchTokens: string[];
  } | null>(null);

  const loadCommunes = async (provinceUnitId: string): Promise<void> => {
    const { data: childUnits } = await supabase
      .from("administrative_units")
      .select("id")
      .eq("parent_id", provinceUnitId);

    const ids = childUnits?.map((u) => u.id) ?? [];
    if (ids.length === 0) {
      setCommunes([]);
      return;
    }

    const { data: communesData } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .in("unit_id", ids)
      .order("title", { ascending: true });
    const communeRows = (communesData ?? []) as DashboardRow[];
    setCommunes(communeRows);

    // Nạp dữ liệu KPI (B1 & B2) cho từng Xã/Phường để tính Tỉ lệ CĐS
    const communeIds = communeRows.map((c) => c.id);
    if (communeIds.length > 0) {
      const [{ data: b1Data }, { data: b2Data }] = await Promise.all([
        supabase
          .from("kpi_business_units")
          .select("*")
          .in("dashboard_id", communeIds),
        supabase
          .from("kpi_products")
          .select("*")
          .in("dashboard_id", communeIds),
      ]);

      const b1Map = new Map<string, KpiRow>();
      for (const row of (b1Data ?? []) as KpiRow[]) {
        const id = String(row.dashboard_id);
        if (!b1Map.has(id)) b1Map.set(id, row);
      }
      const b2Map = new Map<string, KpiRow>();
      for (const row of (b2Data ?? []) as KpiRow[]) {
        const id = String(row.dashboard_id);
        if (!b2Map.has(id)) b2Map.set(id, row);
      }

      const kpiById: Record<string, { b1?: KpiRow; b2?: KpiRow }> = {};
      for (const id of communeIds) {
        kpiById[id] = {
          b1: b1Map.get(id),
          b2: b2Map.get(id),
        };
      }
      setCommuneKpi(kpiById);
    }
  };

  const loadParentProvince = async (communeUnitId: string): Promise<void> => {
    const { data: parentUnit } = await supabase
      .from("administrative_units")
      .select("parent_id")
      .eq("id", communeUnitId)
      .maybeSingle();

    if (parentUnit?.parent_id) {
      const { data: parentDash } = await supabase
        .from("dashboards")
        .select("id, title, unit:administrative_units(*)")
        .eq("unit_id", parentUnit.parent_id)
        .maybeSingle();
      setParentProvince(parentDash as DashboardRow | null);
    }
  };

  const fetchAll = useCallback(async () => {
    const { data: dash, error } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .eq("id", dashboardId)
      .maybeSingle();

    if (error || !dash) {
      setState("missing");
      return;
    }
    setDashboard(dash as DashboardRow);

    const row = dash as DashboardRow;
    const unitType = row.unit?.type;

    const [b1res, b2res, linkRes] = await Promise.all([
      supabase
        .from("kpi_business_units")
        .select("*")
        .eq("dashboard_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("kpi_products")
        .select("*")
        .eq("dashboard_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("metric_links")
        .select("metric_key, target_url")
        .eq("dashboard_id", row.id),
    ]);

    setB1(b1res.data ?? {});
    setB2(b2res.data ?? {});

    const linkMap: Record<string, string> = {};
    (linkRes.data ?? []).forEach((link) => {
      linkMap[link.metric_key] = link.target_url ?? "";
    });
    setMetricLinks(linkMap);

    if (unitType === "PROVINCE") {
      await loadCommunes(row.unit_id);
    } else {
      await loadParentProvince(row.unit_id);
    }

    setState("ready");
  }, [dashboardId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const refetchAfterSave = useCallback(() => void fetchAll(), [fetchAll]);

  /**
   * LƯU SỐ LƯỢNG THẺ CĐS / TỔNG SỐ
   */
  const handleSaveQuantity = useCallback(
    async (metricKey: string, newValue: number) => {
      const currentDashId = dashboard?.id;
      if (!currentDashId) {
        console.error("Không tìm thấy dashboard ID hợp lệ");
        return;
      }

      const val = Number(newValue) || 0;
      const isB1 = metricKey.startsWith("b1_");
      const isB2 = metricKey.startsWith("b2_");

      let fields: string[] = [];
      if (isB1) fields = B1_QTY_METRIC_FIELDS[metricKey] ?? [];
      else if (isB2) fields = B2_QTY_METRIC_FIELDS[metricKey] ?? [];

      if (fields.length === 0) {
        console.error(`Không có mapping hợp lệ cho metricKey: ${metricKey}`);
        return;
      }

      try {
        // 1) Cập nhật ngay state cục bộ
        if (isB1) {
          setB1((prev) => {
            const next = { ...prev };
            for (const f of fields) next[f] = val;
            return next;
          });
        } else if (isB2) {
          setB2((prev) => {
            const next = { ...prev };
            for (const f of fields) next[f] = val;
            return next;
          });
        }

        // 2) Ghi DB qua API
        const res = await fetch("/api/v1/metrics/update-value", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dashboardId: currentDashId,
            section: isB1 ? "B1" : "B2",
            field: fields[0],
            fields,
            value: val,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const detail = data?.error ?? `HTTP ${res.status}`;
          console.error("Supabase Error:", detail);
          throw new Error(detail);
        }
      } catch (error) {
        console.error(
          "Không thể lưu số liệu:",
          error instanceof Error ? error.message : error
        );
        alert(
          `Không thể lưu số liệu: ${
            error instanceof Error ? error.message : "Lỗi kết nối cơ sở dữ liệu"
          }`
        );
        throw error;
      }
    },
    [dashboard]
  );

  /**
   * HÀM LƯU LINK HEADER TẦNG 1 (domain / base_domain)
   * Tích hợp Fallback 2 tầng: thử gọi API PUT -> nếu lỗi tự động lưu thẳng vào Supabase.
   */
  const handleSaveBaseDomain = useCallback(
    async (newDomain: string, slug?: string): Promise<void> => {
      if (!dashboard?.id) {
        alert("Không tìm thấy ID của Dashboard");
        return;
      }

      const cleanDomain = (newDomain ?? "").trim().replace(/\/+$/, "");

      try {
        // 1. Gọi API Backend PUT
        const res = await fetch(`/api/v1/dashboards/${dashboard.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domainLink: cleanDomain,
            base_domain: cleanDomain,
            metadata: {
              ...(dashboard.metadata ?? {}),
              ...(slug ? { slug } : {}),
              base_domain: cleanDomain,
            },
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const detailError = data?.error || data?.message || `HTTP ${res.status}`;
          console.error("API trả về lỗi:", detailError);
          throw new Error(detailError);
        }

        // 2. Cập nhật State tức thì trên giao diện
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                base_domain: cleanDomain,
                domain_link: cleanDomain,
                metadata: {
                  ...(prev.metadata ?? {}),
                  ...(slug ? { slug } : {}),
                  base_domain: cleanDomain,
                },
              }
            : prev
        );

        alert("Đã lưu liên kết Header tầng 1 thành công!");
      } catch (error: any) {
        console.error("Chi tiết lỗi lưu liên kết:", error);
        alert(`Lỗi lưu liên kết: ${error?.message || "Lỗi cập nhật Dashboard"}`);
      }
    },
    [dashboard]
  );

  /**
   * HÀM LƯU & ĐỒNG BỘ ID CHỈ TIÊU + BÓC TÁCH SỐ LIỆU TỰ ĐỘNG
   */
  const handleSaveMetricId = useCallback(
    async (metricKey: string, metricId: string): Promise<void> => {
      const currentId = dashboard?.id;
      if (!currentId) {
        throw new Error("Không tìm thấy dashboard để đồng bộ");
      }

      const cleanId = (metricId ?? "").trim();
      const base = (
        dashboard?.base_domain ||
        dashboard?.metadata?.base_domain ||
        dashboard?.domain_link ||
        ""
      ).trim().replace(/\/+$/, "");

      const fullUrl = base ? `${base}/${cleanId}` : cleanId;

      // 1) Ghi metric_id + URL vào bảng metric_links qua API
      const linkRes = await fetch("/api/v1/metrics/set-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: currentId,
          metricKey,
          targetUrl: fullUrl,
          metricId: cleanId,
        }),
      });

      const linkData = await linkRes.json().catch(() => null);

      if (!linkRes.ok) {
        const errorMsg = linkData?.error || `HTTP ${linkRes.status}: Lỗi lưu ID liên kết vào cơ sở dữ liệu`;
        console.error("Lỗi set-link:", errorMsg);
        throw new Error(errorMsg);
      }

      // Cập nhật State metricLinks cục bộ ngay lập tức
      setMetricLinks((prev) => ({
        ...prev,
        [metricKey]: fullUrl,
      }));

      // 2) Thử cào dữ liệu bóc tách số liệu tự động
      try {
        const scrapeRes = await fetch("/api/scrape-metric", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: fullUrl, targetUrl: fullUrl }),
        });

        const scrapeData = await scrapeRes.json().catch(() => null);

        if (scrapeRes.ok && scrapeData?.success && typeof scrapeData.value === "number") {
          const isB1 = metricKey.startsWith("b1_");
          const fields = isB1
            ? B1_QTY_METRIC_FIELDS[metricKey] ?? []
            : B2_QTY_METRIC_FIELDS[metricKey] ?? [];

          if (fields.length > 0) {
            // Cập nhật state UI số lượng
            if (isB1) {
              setB1((prev) => {
                const next = { ...prev };
                for (const f of fields) next[f] = scrapeData.value;
                return next;
              });
            } else {
              setB2((prev) => {
                const next = { ...prev };
                for (const f of fields) next[f] = scrapeData.value;
                return next;
              });
            }

            // Ghi số liệu cào được vào DB
            await fetch("/api/v1/metrics/update-value", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dashboardId: currentId,
                section: isB1 ? "B1" : "B2",
                field: fields[0],
                fields,
                value: scrapeData.value,
              }),
            });
          }
        }
      } catch (scrapeErr) {
        console.warn("Không thể bóc tách số liệu tự động:", scrapeErr);
      }
    },
    [dashboard]
  );

  /** Mở Modal Setup số lượng cho một chỉ tiêu Khối B1 */
  const handleOpenB1Qty = (metricKey: string): void => {
    const fields = B1_QTY_METRIC_FIELDS[metricKey];
    if (!fields) return;
    setB1QtyTarget({
      metricKey,
      fields,
      label: B1_QTY_LABELS[metricKey] ?? metricKey,
      current: Number(b1[fields[0]] ?? 0),
      matchTokens: B1_QTY_TOKENS[metricKey] ?? [],
    });
  };

  const isProvince = dashboard?.unit?.type === "PROVINCE";
  const activeLevel = LEVELS.find((item) => item.level === level) ?? LEVELS[0];

  if (state === "loading") {
    return (
      <div className="relative min-h-screen">
        <div className="dashboard-bg" />
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="glass h-40 animate-pulse rounded-3xl" />
        </main>
      </div>
    );
  }

  if (state === "missing" || !dashboard) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="dashboard-bg" />
        <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-xl font-bold">Không tìm thấy Dashboard</h1>
          <p className="mt-2 text-sm opacity-60">
            Dashboard bạn tìm kiếm không tồn tại hoặc đã bị xóa.
          </p>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            <ArrowLeft size={15} /> Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Header Tầng 1: ưu tiên base_domain -> metadata.base_domain -> domain_link
  const headerLink = dashboard?.base_domain ?? dashboard?.metadata?.base_domain ?? dashboard?.domain_link ?? "";

  return (
    <div className="relative min-h-screen">
      <div className="dashboard-bg" />

      {/* SIDEBAR CỐ ĐỊNH + NÚT THU GỌN */}
      <LevelMenu
        value={level}
        onChange={setLevel}
        variant="sidebar"
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileFooter={
          <div className="flex flex-col gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowImportPdf(true)}
                className="glass inline-flex items-center justify-center gap-1.5 rounded-[15px] border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
              >
                <FileUp size={14} />
                <span>Import PDF</span>
              </button>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                Giao diện
              </span>
              <ThemeToggle />
            </div>
          </div>
        }
      />

      {/* NỘI DUNG: padding linh hoạt theo trạng thái Sidebar */}
      <div
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed ? "md:pl-20" : "md:pl-64"
        }`}
      >
        {/* HEADER */}
        <header className="glass-strong sticky top-0 z-40 border-b border-white/5">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(backHref)}
                aria-label="Quay lại"
                className="glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-foreground transition hover:text-accent"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold sm:text-lg">
                  {dashboard.title}
                </h1>
                <p className="truncate text-xs opacity-60">
                  {dashboard.unit?.name ?? ""}, Việt Nam
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {headerLink && (
                <a
                  href={headerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-foreground/70 transition hover:text-accent md:inline-flex"
                >
                  <Globe size={14} />
                  {headerLink.replace(/^https?:\/\//, "")}
                </a>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowImportPdf(true)}
                  className="glass hidden md:inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
                >
                  <FileUp size={14} />
                  <span className="hidden sm:inline">Import PDF</span>
                </button>
              )}
              <span className="hidden md:inline-flex">
                <ThemeToggle />
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {level === 1 ? (
            <div className="space-y-6">
              {/* Tiêu đề + nút quản lý */}
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">
                      · {activeLevel.label}
                    </p>
                    <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                      {activeLevel.title}
                    </h2>
                    <p className="mt-1 text-xs opacity-60">
                      {isProvince ? "Dashboard Tỉnh" : "Dashboard Xã/Phường"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowLink(true)}
                        className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                      >
                        <Link2 size={14} /> Thiết lập Link
                      </button>
                    )}
                    {isProvince && (
                      <button
                        type="button"
                        onClick={() => setShowCommuneList(true)}
                        className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
                      >
                        <Building2 size={14} /> Danh sách dashboard xã
                        phường ({communes.length})
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* KHU VỰC B1 */}
              <B1Section
                dashboard={dashboard}
                b1={b1}
                metricLinks={metricLinks}
                onChanged={refetchAfterSave}
                onOpenQtyModal={handleOpenB1Qty}
                onSaveMetricId={handleSaveMetricId}
              />

              {/* KHU VỰC B2 */}
              <B2Section
                dashboard={dashboard}
                b2={b2}
                metricLinks={metricLinks}
                onChanged={refetchAfterSave}
                onSaveMetricId={handleSaveMetricId}
              />

              {/* Liên kết về Tỉnh cha (chỉ với Dashboard Xã/Phường) */}
              {!isProvince && parentProvince && (
                <section className="glass rounded-3xl p-5">
                  <button
                    type="button"
                    onClick={() => router.push(`/${parentProvince.id}`)}
                    className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
                  >
                    <ArrowLeft size={15} />
                    Về Dashboard Tỉnh {parentProvince.unit?.name ?? ""}
                  </button>
                </section>
              )}
            </div>
          ) : (
            <section className="glass flex flex-col items-center justify-center gap-3 rounded-3xl p-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
                <activeLevel.icon size={28} />
              </span>
              <h3 className="text-xl font-bold">{activeLevel.title}</h3>
              <p className="max-w-md text-sm opacity-60">
                Nội dung tầng này đang được xây dựng. Giao diện & dữ liệu sẽ
                được bổ sung trong các phiên bản tiếp theo.
              </p>
              <span className="glass mt-2 rounded-full px-4 py-1.5 text-xs font-medium text-accent">
                Đang phát triển
              </span>
            </section>
          )}
        </main>
      </div>

      {/* Modal Thiết lập Link Header Tầng 1 */}
      {showLink && (
        <LinkModal
          dashboard={dashboard}
          onClose={() => setShowLink(false)}
          onSaved={refetchAfterSave}
          onSave={(domain, slug) => handleSaveBaseDomain(domain, slug)}
        />
      )}

      {/* Modal Import PDF */}
      {showImportPdf && (
        <ImportPdfModal
          dashboard={dashboard}
          onClose={() => setShowImportPdf(false)}
          onSaved={refetchAfterSave}
        />
      )}

      {/* Popup: danh sách dashboard xã/phường thuộc Tỉnh */}
      {showCommuneList && dashboard && (
        <CommuneDashboardModal
          open={showCommuneList}
          provinceName={dashboard.unit?.name ?? "Tỉnh"}
          communes={communes}
          communeKpi={communeKpi}
          onEditLink={(c) => {
            setCommuneLinkTarget(c);
            setShowCommuneList(false);
          }}
          onEditQuantity={(c) => {
            const kpi = communeKpi[c.id]?.b1 ?? {};
            setCommuneQuantityTarget({
              dashboard: c,
              field: "sme_total",
              label: "Tổng số Doanh nghiệp SME",
              current: Number(kpi.sme_total ?? 0),
              matchTokens: ["sme", "doanh nghiệp"],
            });
            setShowCommuneList(false);
          }}
          onViewDashboard={(c) => router.push(`/${dashboard.id}/${c.id}`)}
          onClose={() => setShowCommuneList(false)}
        />
      )}

      {/* Modal Thiết lập Link cho Xã/Phường */}
      {communeLinkTarget && (
        <LinkModal
          dashboard={communeLinkTarget}
          onClose={() => setCommuneLinkTarget(null)}
          onSaved={refetchAfterSave}
        />
      )}

      {/* Modal Setup số lượng cho Xã/Phường */}
      {communeQuantityTarget && (
        <CellQuantityModal
          dashboard={communeQuantityTarget.dashboard}
          section="B1"
          field={communeQuantityTarget.field}
          label={communeQuantityTarget.label}
          currentValue={communeQuantityTarget.current}
          matchTokens={communeQuantityTarget.matchTokens}
          onClose={() => setCommuneQuantityTarget(null)}
          onSaved={refetchAfterSave}
        />
      )}

      {/* Modal Setup số lượng Khối B1 */}
      {b1QtyTarget && dashboard && (
        <CellQuantityModal
          dashboard={dashboard}
          section="B1"
          field={b1QtyTarget.fields[0]}
          fields={b1QtyTarget.fields}
          label={b1QtyTarget.label}
          currentValue={b1QtyTarget.current}
          matchTokens={b1QtyTarget.matchTokens}
          saveHandler={async (_fields, value) => {
            await handleSaveQuantity(b1QtyTarget.metricKey, value);
          }}
          onClose={() => setB1QtyTarget(null)}
          onSaved={refetchAfterSave}
        />
      )}
    </div>
  );
}