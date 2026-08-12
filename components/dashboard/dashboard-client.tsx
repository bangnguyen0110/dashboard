"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart3,
  Building2,
  Globe,
  Landmark,
  Layers,
  ScrollText,
  Settings2,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ThemeToggle } from "./theme-toggle";
import { Dialog } from "./dialog";
import { MetricCard, type MetricDef, type MetricValueInfo } from "./metric-card";

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                       */
/* ------------------------------------------------------------------ */

type KpiRow = Record<string, unknown>;

export type DashboardInit = {
  dashboardId: string;
  dashboardTitle: string;
  domainLink: string | null;
  initialBusinessUnits: KpiRow[];
  initialProducts: KpiRow[];
  initialMetricLinks: Array<{ metric_key: string; target_url: string | null }>;
};

type BlockId = "B1" | "B2";

/* ------------------------------------------------------------------ */
/* Cấu hình chỉ số & menu 5 tầng                                      */
/* ------------------------------------------------------------------ */

const B1_METRICS: MetricDef[] = [
  { key: "sme", label: "Doanh nghiệp SME", unit: "DN", color: "#22d3ee" },
  { key: "hkd", label: "Hộ kinh doanh", unit: "hộ", color: "#38bdf8" },
  { key: "htx", label: "Hợp tác xã", unit: "HTX", color: "#818cf8" },
];

const B2_METRICS: MetricDef[] = [
  { key: "ocop-3-sao", label: "OCOP 3 sao", unit: "SP", color: "#34d399" },
  { key: "ocop-4-sao", label: "OCOP 4 sao", unit: "SP", color: "#2dd4bf" },
  { key: "ocop-5-sao", label: "OCOP 5 sao", unit: "SP", color: "#fbbf24" },
  { key: "san-pham-thuong", label: "Sản phẩm thường", unit: "SP", color: "#f472b6" },
  { key: "dich-vu", label: "Dịch vụ", unit: "DV", color: "#a78bfa" },
];

const ALL_METRICS = [...B1_METRICS, ...B2_METRICS];

const MENU_ITEMS = [
  { id: 1, label: "Bộ tiêu chí kinh tế số của địa phương", icon: BarChart3 },
  { id: 2, label: "Tiêu chí nền tảng kinh tế số", icon: Layers },
  { id: 3, label: "Dự án kêu gọi đầu tư – Quy hoạch", icon: Building2 },
  { id: 4, label: "Chính sách & giải đáp kiến nghị", icon: ScrollText },
  { id: 5, label: "Điểm trưng bày & Hội quán (Tài liệu CĐS)", icon: Landmark },
] as const;

const tooltipStyle: CSSProperties = {
  background: "var(--glass-bg-strong)",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  color: "var(--foreground)",
  backdropFilter: "blur(12px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
};

/* ------------------------------------------------------------------ */
/* Helpers xử lý dữ liệu KPI                                           */
/* ------------------------------------------------------------------ */

/** Chuẩn hoá chuỗi: bỏ dấu, lower-case, gạch nối (sme / ocop-3-sao...) */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lấy "tên" của 1 bản ghi KPI từ các cột key-ish phổ biến */
function extractKey(row: KpiRow): string {
  for (const field of ["metric_key", "key", "code", "slug", "name", "label", "title"]) {
    const value = row[field];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

/** Đọc số từ các cột value-ish phổ biến */
function toNumber(row: KpiRow, fields: string[]): number | null {
  for (const field of fields) {
    const raw = row[field];
    if (raw === null || raw === undefined) continue;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

/** Tìm thông tin hiển thị (value/goal) của 1 chỉ số trong danh sách bản ghi KPI */
function findMetricInfo(metric: MetricDef, rows: KpiRow[]): MetricValueInfo {
  let best: KpiRow | null = null;
  let bestTime = "";

  for (const row of rows) {
    const key = extractKey(row);
    if (!key) continue;
    const normalizedKey = normalize(key);
    const matches =
      normalizedKey === normalize(metric.key) ||
      normalizedKey === normalize(metric.label) ||
      key.trim().toLowerCase() === metric.label.toLowerCase();

    if (!matches) continue;

    const time = typeof row.created_at === "string" ? row.created_at : "";
    if (!best || time >= bestTime) {
      best = row;
      bestTime = time;
    }
  }

  if (!best) return { value: 0, goal: null, count: 0 };

  const value =
    toNumber(best, ["value", "total", "count", "so_luong", "gia_tri", "so"]) ?? 0;
  const goal = toNumber(best, ["goal", "target", "muc_tieu", "chi_tieu"]);

  return { value, goal, count: 1 };
}

/** Loại bỏ bản ghi trùng id khi realtime push thêm hàng */
function dedupeRows(rows: KpiRow[]): KpiRow[] {
  const seen = new Set<string>();
  const result: KpiRow[] = [];
  for (const row of rows) {
    const id = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : "";
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    result.push(row);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Component chính                                                     */
/* ------------------------------------------------------------------ */

export function DashboardClient(init: DashboardInit) {
  const { dashboardId, dashboardTitle, domainLink } = init;

  const domainHost = useMemo(() => {
    if (!domainLink) return null;
    try {
      return new URL(domainLink).hostname.replace(/^www\./, "");
    } catch {
      return domainLink;
    }
  }, [domainLink]);

  const [activeMenu, setActiveMenu] = useState(1);
  const [b1Id, setB1Id] = useState("");
  const [b2Id, setB2Id] = useState("");

  // Dữ liệu KPI + link chuyển hướng
  const [businessUnits, setBusinessUnits] = useState<KpiRow[]>(init.initialBusinessUnits);
  const [products, setProducts] = useState<KpiRow[]>(init.initialProducts);
  const [links, setLinks] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const item of init.initialMetricLinks) {
      if (item.target_url) map.set(item.metric_key, item.target_url);
    }
    return map;
  });

  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "offline">(
    "connecting",
  );
  const [flashKey, setFlashKey] = useState(0);

  // Dialog
  const [bEditor, setBEditor] = useState<{ block: BlockId; id: string } | null>(null);
  const [linkEditor, setLinkEditor] = useState<{ metric: MetricDef; url: string } | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  /* ---------------- Realtime Engine ---------------- */
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-realtime-${dashboardId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "kpi_business_units",
          filter: `dashboard_id=eq.${dashboardId}`,
        },
        (payload) => {
          setBusinessUnits((prev) => dedupeRows([...prev, payload.new as unknown as KpiRow]));
          setFlashKey((n) => n + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "kpi_products",
          filter: `dashboard_id=eq.${dashboardId}`,
        },
        (payload) => {
          setProducts((prev) => dedupeRows([...prev, payload.new as unknown as KpiRow]));
          setFlashKey((n) => n + 1);
        },
      )
      .subscribe((status) => {
        setRealtimeStatus(
          status === "SUBSCRIBED"
            ? "connected"
            : status === "CHANNEL_ERROR"
              ? "offline"
              : "connecting",
        );
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dashboardId]);

  /* ---------------- Handlers ---------------- */

  const blockIdOf = (block: BlockId) => (block === "B1" ? b1Id : b2Id);
  const setBlockIdOf = (block: BlockId, value: string) =>
    block === "B1" ? setB1Id(value) : setB2Id(value);

  /** Lưu link chuyển hướng của chỉ số qua API POST /api/v1/metrics/set-link */
  const saveMetricLink = async (metricKey: string, targetUrl: string) => {
    setSavingLink(true);
    try {
      const res = await fetch("/api/v1/metrics/set-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardId, metricKey, targetUrl }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setLinks((prev) => {
        const next = new Map(prev);
        if (targetUrl.trim()) next.set(metricKey, targetUrl.trim());
        else next.delete(metricKey);
        return next;
      });
    } catch (error) {
      alert(`Không thể lưu link: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSavingLink(false);
    }
  };

  /* ---------------- Dữ liệu hiển thị ---------------- */

  const b1Infos = useMemo(
    () => Object.fromEntries(B1_METRICS.map((m) => [m.key, findMetricInfo(m, businessUnits)])),
    [businessUnits],
  );

  const b2Infos = useMemo(
    () => Object.fromEntries(B2_METRICS.map((m) => [m.key, findMetricInfo(m, products)])),
    [products],
  );

  const pieData = useMemo(
    () =>
      ALL_METRICS.filter((m) => {
        const info = b1Infos[m.key] ?? b2Infos[m.key];
        return info && info.value > 0;
      }).map((m) => ({
        name: m.label,
        value: (b1Infos[m.key] ?? b2Infos[m.key]).value,
        color: m.color,
      })),
    [b1Infos, b2Infos],
  );

  const barData = useMemo(
    () =>
      ALL_METRICS.map((m, index) => {
        const info = b1Infos[m.key] ?? b2Infos[m.key];
        return {
          name: m.label,
          short: `M${index + 1}`,
          value: info.value,
          goal: info.goal ?? info.value,
        };
      }),
    [b1Infos, b2Infos],
  );

  const totalValue = useMemo(
    () => ALL_METRICS.reduce((sum, m) => sum + (b1Infos[m.key] ?? b2Infos[m.key]).value, 0),
    [b1Infos, b2Infos],
  );

  /* ---------------- Dialog handlers ---------------- */

  const openBEditor = (block: BlockId) => setBEditor({ block, id: blockIdOf(block) });

  const saveBlockId = () => {
    if (!bEditor) return;
    setBlockIdOf(bEditor.block, bEditor.id.trim());
    setBEditor(null);
  };

  const openLinkEditor = (metric: MetricDef) =>
    setLinkEditor({ metric, url: links.get(metric.key) ?? "" });

  const submitLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!linkEditor) return;
    await saveMetricLink(linkEditor.metric.key, linkEditor.url);
    setLinkEditor(null);
  };

  const removeLink = async () => {
    if (!linkEditor) return;
    await saveMetricLink(linkEditor.metric.key, "");
    setLinkEditor(null);
  };

  /* ---------------- UI helpers ---------------- */

  const realtimePill = (
    <span
      className={`glass inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ${
        realtimeStatus === "connected"
          ? "text-accent"
          : realtimeStatus === "offline"
            ? "text-red-400"
            : "text-yellow-400"
      }`}
    >
      {realtimeStatus === "connected" ? (
        <Wifi size={14} />
      ) : realtimeStatus === "offline" ? (
        <WifiOff size={14} />
      ) : (
        <span className="h-3 w-3 animate-pulse rounded-full bg-yellow-400" />
      )}
      <span className="hidden sm:inline">
        Realtime{" "}
        {realtimeStatus === "connected"
          ? "đang kết nối"
          : realtimeStatus === "offline"
            ? "mất kết nối"
            : "đang kết nối…"}
      </span>
    </span>
  );

  const renderBlock = (block: BlockId) => {
    const isB1 = block === "B1";
    const metrics = isB1 ? B1_METRICS : B2_METRICS;
    const infos = isB1 ? b1Infos : b2Infos;
    const blockId = blockIdOf(block);

    return (
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
              <Layers size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold sm:text-lg">
                {isB1 ? "Khối B1 – Tổ chức sản xuất kinh doanh" : "Khối B2 – Sản phẩm & dịch vụ số"}
              </h2>
              <p className="text-xs opacity-60">
                {isB1 ? "Doanh nghiệp, hộ kinh doanh, hợp tác xã" : "OCOP, sản phẩm thường và dịch vụ số"}
              </p>
            </div>
          </div>

          {/* Nút Thiết lập: popup nhập ID cho khối */}
          <button
            type="button"
            onClick={() => openBEditor(block)}
            className="glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-foreground transition hover:text-accent"
          >
            <Settings2 size={15} />
            Thiết lập
            {blockId ? (
              <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[11px] text-accent">
                {blockId}
              </span>
            ) : null}
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard
              key={`${metric.key}-${flashKey}`}
              metric={metric}
              info={infos[metric.key]}
              targetUrl={links.get(metric.key) ?? ""}
              onEditLink={() => openLinkEditor(metric)}
            />
          ))}
        </div>
      </section>
    );
  };

  const renderCharts = (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h3 className="text-base font-semibold">Biểu đồ cơ cấu</h3>
        <p className="text-xs opacity-60">Cơ cấu chỉ tiêu kinh tế số hiện tại</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={90}
                paddingAngle={2}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="glass rounded-3xl p-5 sm:p-6">
        <h3 className="text-base font-semibold">Tỉ lệ CĐS so mục tiêu</h3>
        <p className="text-xs opacity-60">Giá trị đạt được so với mục tiêu của từng chỉ số</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis
                dataKey="short"
                tick={{ fontSize: 12, fill: "var(--foreground)", opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--foreground)", opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
                iconType="circle"
              />
              <Bar dataKey="value" name="Giá trị" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              <Bar dataKey="goal" name="Mục tiêu" fill="#818cf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );

  const activeItem = MENU_ITEMS.find((item) => item.id === activeMenu) ?? MENU_ITEMS[0];

  return (
    <div className="relative min-h-screen">
      <div className="dashboard-bg" />
      <header className="glass-strong sticky top-0 z-40 border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-white shadow-lg shadow-accent/30">
              <BarChart3 size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">{dashboardTitle}</h1>
              <p className="truncate text-xs opacity-60">
                Bảng điều khiển kinh tế số · {dashboardId.slice(0, 8)}…
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {domainHost ? (
              <a
                href={domainLink ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="glass hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-foreground/70 transition hover:text-accent md:inline-flex"
                title={domainLink ?? ""}
              >
                <Globe size={14} />
                {domainHost}
              </a>
            ) : null}
            {realtimePill}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Menu 5 tầng */}
        <nav className="glass sticky top-20 z-30 mb-6 flex gap-1 overflow-x-auto rounded-2xl p-1.5">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeMenu;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMenu(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition sm:text-sm ${
                  active
                    ? "bg-gradient-to-r from-accent/25 to-blue-600/25 text-accent shadow-inner"
                    : "text-foreground/60 hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <Icon size={15} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {activeMenu === 1 ? (
          <section className="space-y-6">
            {/* Hero Tầng 1 */}
            <div className="glass relative overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-6 sm:p-8">
              <div className="pointer-events-none absolute -top-16 right-10 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
              <p className="text-xs font-medium uppercase tracking-widest text-accent">
                Tầng 1 · Bộ tiêu chí
              </p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                Bộ tiêu chí kinh tế số của địa phương
              </h2>
              <p className="mt-2 max-w-2xl text-sm opacity-70">
                Tổng quan các chỉ tiêu phát triển kinh tế số gồm Khối B1 (tổ chức sản xuất kinh
                doanh) và Khối B2 (sản phẩm &amp; dịch vụ số). Dữ liệu được đồng bộ tự động qua
                Webhook và cập nhật trực tiếp qua Realtime.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="glass rounded-2xl px-4 py-3">
                  <p className="text-xs opacity-60">Tổng giá trị chỉ tiêu</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {totalValue.toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="glass rounded-2xl px-4 py-3">
                  <p className="text-xs opacity-60">Chỉ số đang theo dõi</p>
                  <p className="text-2xl font-bold tabular-nums">{ALL_METRICS.length}</p>
                </div>
                <div className="glass rounded-2xl px-4 py-3">
                  <p className="text-xs opacity-60">Bản ghi KPI đã đồng bộ</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {businessUnits.length + products.length}
                  </p>
                </div>
              </div>
            </div>

            {renderBlock("B1")}
            {renderBlock("B2")}
            {renderCharts}
          </section>
        ) : (
          <section className="glass relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl p-10 text-center">
            <div className="pointer-events-none absolute -top-12 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
              <activeItem.icon size={28} />
            </span>
            <h2 className="text-xl font-bold">{activeItem.label}</h2>
            <p className="max-w-md text-sm opacity-60">
              Nội dung tầng này đang được xây dựng. Giao diện &amp; dữ liệu sẽ được bổ sung trong
              các phiên bản tiếp theo.
            </p>
            <span className="glass mt-2 rounded-full px-4 py-1.5 text-xs font-medium text-accent">
              Đang phát triển
            </span>
          </section>
        )}

        {/* Dialog: Thiết lập ID cho Khối B1/B2 (nút "Thiết lập") */}
        <Dialog
          open={bEditor !== null}
          title={`Thiết lập ID · Khối ${bEditor?.block ?? ""}`}
          onClose={() => setBEditor(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveBlockId();
            }}
            className="space-y-4"
          >
            <label htmlFor="block-id" className="block text-sm opacity-70">
              Nhập ID đơn vị hành chính cho Khối:
            </label>
            <input
              id="block-id"
              value={bEditor?.id ?? ""}
              onChange={(event) =>
                setBEditor(bEditor ? { ...bEditor, id: event.target.value } : bEditor)
              }
              placeholder="VD: 01/dashboard"
              autoFocus
              className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBEditor(null)}
                className="glass rounded-xl px-4 py-2 text-sm opacity-80 transition hover:opacity-100"
              >
                Huỷ
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
              >
                Lưu ID
              </button>
            </div>
          </form>
        </Dialog>

        {/* Dialog: Nhập / sửa URL cho từng chỉ số (icon bánh răng ⚙️) */}
        <Dialog
          open={linkEditor !== null}
          title={`Link chuyển hướng · ${linkEditor?.metric.label ?? ""}`}
          onClose={() => setLinkEditor(null)}
        >
          <form onSubmit={submitLink} className="space-y-4">
            <label htmlFor="link-url" className="block text-sm opacity-70">
              URL đích khi bấm vào thẻ chỉ số:
            </label>
            <input
              id="link-url"
              type="text"
              value={linkEditor?.url ?? ""}
              onChange={(event) =>
                setLinkEditor(linkEditor ? { ...linkEditor, url: event.target.value } : linkEditor)
              }
              placeholder="https://..."
              autoFocus
              className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={removeLink}
                className="rounded-xl border border-red-400/40 px-4 py-2 text-sm text-red-400 transition hover:bg-red-400/10"
              >
                Xoá link
              </button>
              <button
                type="button"
                onClick={() => setLinkEditor(null)}
                className="glass rounded-xl px-4 py-2 text-sm opacity-80 transition hover:opacity-100"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={savingLink}
                className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {savingLink ? "Đang lưu…" : "Lưu link"}
              </button>
            </div>
          </form>
        </Dialog>
      </main>
    </div>
  );
}