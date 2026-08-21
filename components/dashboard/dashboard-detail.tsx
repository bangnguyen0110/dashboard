"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  FileUp,
  Globe,
  Link2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardRow, KpiRow } from "@/lib/types";
import { LevelMenu, LEVELS, useLevelParam } from "./level-menu";
import { LinkModal } from "./link-modal";
import { ImportPdfModal } from "./import-pdf-modal";
import { CommuneDashboardModal } from "./commune-dashboard-modal";
import { CellQuantityModal } from "./blocks/cell-quantity-modal";
import { B1Section } from "./blocks/b1-section";
import { B2Section } from "./blocks/b2-section";
import { B3Section } from "./blocks/b3-section";
import { B4Section } from "./blocks/b4-section";
import { B5Section } from "./blocks/b5-section";
import { B6Section } from "./blocks/b6-section";
import { B7Section } from "./blocks/b7-section";
import { B8Section } from "./blocks/b8-section";
import { B9Section } from "./blocks/b9-section";
import { Level2View } from "./level-2-view";
import { Level3View } from "./level-3-view";
import { Level4View } from "./level-4-view";
import { Level5View } from "./level-5-view";
import { useAuth } from "@/context/AuthContext";

interface DashboardDetailProps {
  dashboardId: string;
  backHref: string;
}

type ResolvedState = "loading" | "missing" | "ready";

const B1_QTY_METRIC_FIELDS: Record<string, string[]> = {
  b1_sme_total: ["sme_total"],
  b1_hkd_total: ["hkd_total"],
  b1_htx_total: ["htx_total"],
  b1_sme_dx: ["sme_dx", "sme_cds"],
  b1_hkd_dx: ["hkd_dx", "hkd_cds"],
  b1_htx_dx: ["htx_dx", "htx_cds"],
};

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
  const [isSyncing, setIsSyncing] = useState(false);

  // Dữ liệu Tầng 1
  const [b1, setB1] = useState<KpiRow>({});
  const [b2, setB2] = useState<KpiRow>({});
  const [b3, setB3] = useState<KpiRow>({});
  const [b4, setB4] = useState<KpiRow>({});
  const [b5, setB5] = useState<KpiRow>({});
  const [b6, setB6] = useState<KpiRow>({});
  const [b7, setB7] = useState<KpiRow>({});
  const [b8, setB8] = useState<KpiRow>({});
  const [b9, setB9] = useState<KpiRow>({});

  // Dữ liệu Tầng 2, 3, 4
  const [level2Data, setLevel2Data] = useState<KpiRow>({});
  const [level3Data, setLevel3Data] = useState<KpiRow>({});
  const [level4Data, setLevel4Data] = useState<KpiRow>({});
  const [level5Data, setLevel5Data] = useState<KpiRow>({});

  const [metricLinks, setMetricLinks] = useState<Record<string, string>>({});
  const [communes, setCommunes] = useState<DashboardRow[]>([]);
  const [communeKpi, setCommuneKpi] = useState<Record<string, { b1?: KpiRow; b2?: KpiRow }>>({});
  const [parentProvince, setParentProvince] = useState<DashboardRow | null>(null);

  const [level, setLevel] = useLevelParam(1);
  const currentLevel = Number(level) || 1; // Ép kiểu số an toàn tuyệt đối

  const [showLink, setShowLink] = useState(false);
  const [showImportPdf, setShowImportPdf] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [b1QtyTarget, setB1QtyTarget] = useState<{
    metricKey: string;
    fields: string[];
    label: string;
    current: number;
    matchTokens: string[];
  } | null>(null);

  const [showCommuneList, setShowCommuneList] = useState(false);
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

    const communeIds = communeRows.map((c) => c.id);
    if (communeIds.length > 0) {
      const [{ data: b1Data }, { data: b2Data }] = await Promise.all([
        supabase.from("kpi_business_units").select("*").in("dashboard_id", communeIds),
        supabase.from("kpi_products").select("*").in("dashboard_id", communeIds),
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
      supabase.from("metric_links").select("metric_key, target_url").eq("dashboard_id", row.id),
    ]);

    setB1(b1res.data ?? {});
    setB2(b2res.data ?? {});
    setB3((row as any).b3 ?? {});
    setB4((row as any).b4 ?? {});
    setB5((row as any).b5 ?? {});
    setB6((row as any).b6 ?? {});
    setB7((row as any).b7 ?? {});
    setB8((row as any).b8 ?? {});
    setB9((row as any).b9 ?? {});

    setLevel2Data((row as any).level2 ?? (row as any).l2 ?? {});
    setLevel3Data((row as any).level3 ?? (row as any).l3 ?? {});
    setLevel4Data((row as any).level4 ?? (row as any).l4 ?? {});
    setLevel5Data((row as any).level5 ?? (row as any).l5 ?? {});

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

  /** LIVE SYNC QUÉT SỐ LIỆU TỰ ĐỘNG TỪ WEB LIÊN KẾT */
  const handleLiveSync = useCallback(
    async (silent = false) => {
      if (!dashboard?.id) return;
      if (!silent) setIsSyncing(true);

      try {
        const res = await fetch("/api/v1/metrics/sync-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dashboardId: dashboard.id }),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.success) {
          await refetchAfterSave();
          if (!silent) {
            alert(data?.message || "Đã đồng bộ số liệu mới nhất từ website liên kết!");
          }
        } else if (!silent) {
          alert(data?.error || "Không thể đồng bộ số liệu");
        }
      } catch (e) {
        console.error("Lỗi Live Sync:", e);
        if (!silent) alert("Lỗi kết nối khi đồng bộ dữ liệu");
      } finally {
        if (!silent) setIsSyncing(false);
      }
    },
    [dashboard?.id, refetchAfterSave]
  );

  useEffect(() => {
    if (state === "ready" && dashboard?.id) {
      const timer = setTimeout(() => {
        void handleLiveSync(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, dashboard?.id, handleLiveSync]);

  /** LƯU SỐ LƯỢNG THỦ CÔNG (B1 -> B9, L2, L3, L4) */
  const handleSaveQuantity = useCallback(
    async (metricKey: string, newValue: number) => {
      const currentDashId = dashboard?.id;
      if (!currentDashId) return;

      const val = Number(newValue) || 0;
      const isB1 = metricKey.startsWith("b1_");
      const isB2 = metricKey.startsWith("b2_");
      const prefix = metricKey.split("_")[0];

      // Lưu các tầng L2, L3, L4
      if (prefix === "l2" || prefix === "l3" || prefix === "l4" || prefix === "l5") {
        const levelField = prefix === "l2" ? "level2" : prefix === "l3" ? "level3" : prefix === "l4" ? "level4" : "level5";
        const fieldName = metricKey.replace(`${prefix}_`, "");

  if (prefix === "l2") setLevel2Data((prev) => ({ ...prev, [fieldName]: val }));
  if (prefix === "l3") setLevel3Data((prev) => ({ ...prev, [fieldName]: val }));
  if (prefix === "l4") setLevel4Data((prev) => ({ ...prev, [fieldName]: val }));
  if (prefix === "l5") setLevel5Data((prev) => ({ ...prev, [fieldName]: val }));

  const currentSectionData = { ...((dashboard as any)[levelField] || {}) };
  currentSectionData[fieldName] = val;

  const { error } = await supabase
    .from("dashboards")
    .update({ [levelField]: currentSectionData })
    .eq("id", currentDashId);

  if (error) throw error;
  return;
      }

      // Lưu các khối B3 -> B9
      if (["b3", "b4", "b5", "b6", "b7", "b8", "b9"].includes(prefix)) {
        const fieldName = metricKey.replace(`${prefix}_`, "");
        const setters: Record<string, any> = {
          b3: setB3, b4: setB4, b5: setB5, b6: setB6, b7: setB7, b8: setB8, b9: setB9,
        };

        if (setters[prefix]) {
          setters[prefix]((prev: any) => ({ ...prev, [fieldName]: val }));
        }

        const currentSectionData = { ...((dashboard as any)[prefix] || {}) };
        currentSectionData[fieldName] = val;

        const { error } = await supabase
          .from("dashboards")
          .update({ [prefix]: currentSectionData })
          .eq("id", currentDashId);

        if (error) throw error;
        return;
      }

      // Lưu B1, B2
      let fields: string[] = [];
      if (isB1) fields = B1_QTY_METRIC_FIELDS[metricKey] ?? [];
      else if (isB2) fields = B2_QTY_METRIC_FIELDS[metricKey] ?? [];
      if (fields.length === 0) return;

      try {
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
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
      } catch (error: any) {
        alert(`Không thể lưu số liệu: ${error?.message || "Lỗi kết nối DB"}`);
        throw error;
      }
    },
    [dashboard]
  );

  /** LƯU DOMAIN HEADER */
  const handleSaveBaseDomain = useCallback(
    async (newDomain: string, slug?: string): Promise<void> => {
      if (!dashboard?.id) return;
      const cleanDomain = (newDomain ?? "").trim().replace(/\/+$/, "");

      try {
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
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

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

        alert("Đã lưu liên kết Header thành công!");
      } catch (error: any) {
        alert(`Lỗi lưu liên kết: ${error?.message || "Lỗi cập nhật Dashboard"}`);
      }
    },
    [dashboard]
  );

  /** LƯU ID & BÓC TÁCH SỐ LIỆU TỰ ĐỘNG */
  /** LƯU ID & BÓC TÁCH SỐ LIỆU TỰ ĐỘNG */
const handleSaveMetricId = useCallback(
  async (metricKey: string, metricId: string): Promise<void> => {
    const currentId = dashboard?.id;
    if (!currentId) throw new Error("Không tìm thấy dashboard");

    const cleanId = (metricId ?? "").trim();
    const base = (
      dashboard?.base_domain ||
      dashboard?.metadata?.base_domain ||
      dashboard?.domain_link ||
      ""
    ).trim().replace(/\/+$/, "");

    const fullUrl = base ? `${base}/${cleanId}` : cleanId;

    // Gọi API Set-Link (Server sẽ tự động lưu link + bóc tách số liệu + ghi vào Database)
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
    if (!linkRes.ok) throw new Error(linkData?.error || "Lỗi lưu ID");

    // Cập nhật State Link trên Client
    setMetricLinks((prev) => ({ ...prev, [metricKey]: fullUrl }));

    // Tải lại toàn bộ dữ liệu mới nhất từ Database
    await refetchAfterSave();

    if (linkData?.value !== undefined && linkData?.value !== null) {
      alert(`✅ Đã đồng bộ số liệu thành công: ${linkData.value}`);
    } else {
      alert("✅ Đã lưu link thành công!");
    }
  },
  [dashboard, refetchAfterSave]
);

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
  const activeLevel = LEVELS.find((item) => item.level === currentLevel) ?? LEVELS[0];

  if (state === "loading") {
    return (
      <div className="relative min-h-screen">
        <div className="dashboard-bg" />
        <main className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
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
          <p className="mt-2 text-sm opacity-60">Dashboard không tồn tại hoặc đã bị xóa.</p>
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

  const headerLink = dashboard?.base_domain ?? dashboard?.metadata?.base_domain ?? dashboard?.domain_link ?? "";

  return (
    <div className="relative min-h-screen">
      <div className="dashboard-bg" />

      {/* SIDEBAR CỐ ĐỊNH */}
      <LevelMenu
        value={currentLevel}
        onChange={setLevel}
        variant="sidebar"
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileFooter={
          isAdmin ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowImportPdf(true)}
                className="glass inline-flex items-center justify-center gap-1.5 rounded-[15px] border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
              >
                <FileUp size={14} />
                <span>Import PDF</span>
              </button>
            </div>
          ) : undefined
        }
      />

      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "md:pl-20" : "md:pl-64"}`}>
        {/* HEADER */}
        <header className="glass-strong sticky top-0 z-40 border-b border-white/5">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
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
                <h1 className="truncate text-base font-bold sm:text-lg">{dashboard.title}</h1>
                <p className="truncate text-xs opacity-60">{dashboard.unit?.name ?? ""}, Việt Nam</p>
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

              {/* NÚT LÀM MỚI SỐ LIỆU LIVE */}
              <button
                type="button"
                onClick={() => handleLiveSync(false)}
                disabled={isSyncing}
                className="glass inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50"
                title="Lấy số liệu mới nhất từ các website liên kết"
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin text-cyan-400" : ""} />
                <span className="hidden sm:inline">{isSyncing ? "Đang cập nhật..." : "Làm mới số liệu"}</span>
              </button>

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
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          {/* ================= TẦNG 1 ================= */}
          {currentLevel === 1 ? (
            <div className="space-y-6">
              {/* Banner điều hành */}
              <section className="botron glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-xl font-bold sm:text-2xl">{activeLevel.title}</h2>
                    <p className="mt-1 text-xs opacity-60">{isProvince ? "Dashboard Tỉnh" : "Dashboard Xã/Phường"}</p>
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
                        <Building2 size={14} /> Danh sách dashboard xã phường ({communes.length})
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* LƯỚI TẦNG 1 (B1 - B9) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                {/* 1. KHỐI B1: RỘNG 100% */}
                <div className="w-full xl:col-span-2">
                  <B1Section
                    dashboard={dashboard}
                    b1={b1}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onOpenQtyModal={handleOpenB1Qty}
                    onSaveMetricId={handleSaveMetricId}
                  />
                </div>

                {/* 2. KHỐI B2: RỘNG 100% */}
                <div className="w-full xl:col-span-2">
                  <B2Section
                    dashboard={dashboard}
                    b2={b2}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                  />
                </div>

                {/* 3. KHỐI B3 & B4 */}
                <div className="w-full flex flex-col">
                  <B3Section
                    dashboard={dashboard}
                    data={b3}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>
                <div className="w-full flex flex-col">
                  <B4Section
                    dashboard={dashboard}
                    data={b4}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>

                {/* 4. KHỐI B5 & B6 */}
                <div className="w-full flex flex-col">
                  <B5Section
                    dashboard={dashboard}
                    data={b5}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>
                <div className="w-full flex flex-col">
                  <B6Section
                    dashboard={dashboard}
                    data={b6}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>

                {/* 5. KHỐI B7 & B8 */}
                <div className="w-full flex flex-col">
                  <B7Section
                    dashboard={dashboard}
                    data={b7}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>
                <div className="w-full flex flex-col">
                  <B8Section
                    dashboard={dashboard}
                    data={b8}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>

                {/* 6. KHỐI B9: RỘNG 100% */}
                <div className="w-full xl:col-span-2">
                  <B9Section
                    dashboard={dashboard}
                    data={b9}
                    metricLinks={metricLinks}
                    onChanged={refetchAfterSave}
                    onSaveMetricId={handleSaveMetricId}
                    onSaveQuantity={handleSaveQuantity}
                  />
                </div>
              </div>

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
          ) : currentLevel === 2 ? (
            /* ================= TẦNG 2 ================= */
            <div className="space-y-6">
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-xl font-bold sm:text-2xl">{activeLevel.title}</h2>
                    <p className="mt-1 text-xs opacity-60">Bộ tiêu chí Hệ sinh thái địa phương (Nhóm A - E)</p>
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
                  </div>
                </div>
              </section>

              <Level2View
                dashboard={dashboard}
                data={level2Data}
                metricLinks={metricLinks}
                onChanged={refetchAfterSave}
                onSaveMetricId={handleSaveMetricId}
                onSaveQuantity={handleSaveQuantity}
              />
            </div>
          ) : currentLevel === 3 ? (
            /* ================= TẦNG 3 ================= */
            <div className="space-y-6">
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-xl font-bold sm:text-2xl">{activeLevel.title}</h2>
                    <p className="mt-1 text-xs opacity-60">Dự án kêu gọi đầu tư & Thông tin quy hoạch địa phương</p>
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
                  </div>
                </div>
              </section>

              <Level3View
                dashboard={dashboard}
                data={level3Data}
                metricLinks={metricLinks}
                onChanged={refetchAfterSave}
                onSaveMetricId={handleSaveMetricId}
                onSaveQuantity={handleSaveQuantity}
              />
            </div>
          ) : currentLevel === 4 ? (
            /* ================= TẦNG 4 ================= */
            <div className="space-y-6">
              <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-6">
                <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
                    <h2 className="mt-1 text-xl font-bold sm:text-2xl">{activeLevel.title}</h2>
                    <p className="mt-1 text-xs opacity-60">Chính sách hỗ trợ & Tình hình giải đáp kiến nghị</p>
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
                  </div>
                </div>
              </section>

              <Level4View
                dashboard={dashboard}
                data={level4Data}
                metricLinks={metricLinks}
                onChanged={refetchAfterSave}
                onSaveMetricId={handleSaveMetricId}
                onSaveQuantity={handleSaveQuantity}
              />
            </div>
          
        ) : currentLevel === 5 ? (
  /* ================= TẦNG 5 ================= */
  <div className="space-y-6">
    <section className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-6">
      <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-accent">· {activeLevel.label}</p>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">{activeLevel.title}</h2>
          <p className="mt-1 text-xs opacity-60">Điểm trưng bày / Hội quán & Hiệu quả thương mại O2O</p>
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
        </div>
      </div>
    </section>

    <Level5View
      dashboard={dashboard}
      data={level5Data}
      metricLinks={metricLinks}
      onChanged={refetchAfterSave}
      onSaveMetricId={handleSaveMetricId}
      onSaveQuantity={handleSaveQuantity}
    />
  </div>
) :  (
            /* ================= CÁC TẦNG KHÁC ================= */
            <section className="glass flex flex-col items-center justify-center gap-3 rounded-3xl p-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
                <activeLevel.icon size={28} />
              </span>
              <h3 className="text-xl font-bold">{activeLevel.title}</h3>
              <p className="max-w-md text-sm opacity-60">
                Nội dung tầng này đang được xây dựng. Giao diện & dữ liệu sẽ được bổ sung trong các phiên bản tiếp theo.
              </p>
              <span className="glass mt-2 rounded-full px-4 py-1.5 text-xs font-medium text-accent">
                Đang phát triển
              </span>
            </section>
          ) }
        </main>
      </div>

      {/* MODALS QUẢN TRỊ */}
      {showLink && (
        <LinkModal
          dashboard={dashboard}
          onClose={() => setShowLink(false)}
          onSaved={refetchAfterSave}
          onSave={(domain, slug) => handleSaveBaseDomain(domain, slug)}
        />
      )}

      {showImportPdf && (
        <ImportPdfModal
          dashboard={dashboard}
          onClose={() => setShowImportPdf(false)}
          onSaved={refetchAfterSave}
        />
      )}

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

      {communeLinkTarget && (
        <LinkModal
          dashboard={communeLinkTarget}
          onClose={() => setCommuneLinkTarget(null)}
          onSaved={refetchAfterSave}
        />
      )}

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

export default DashboardDetail;