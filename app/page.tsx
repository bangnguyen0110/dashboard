"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Plus, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardRow } from "@/lib/types";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { ProvinceCard } from "@/components/dashboard/province-card";
import { CreateProvinceModal } from "@/components/dashboard/create-province-modal";
import { LinkModal } from "@/components/dashboard/link-modal";
import { MetricsModal } from "@/components/dashboard/metrics-modal";
import { AuthControls } from "@/components/auth/AuthControls";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [dashboards, setDashboards] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Modal
  const [showCreate, setShowCreate] = useState(false);
  const [linkTarget, setLinkTarget] = useState<DashboardRow | null>(null);
  const [metricsTarget, setMetricsTarget] = useState<DashboardRow | null>(null);

  // Modal sửa Dashboard
  const [editing, setEditing] = useState<DashboardRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchDashboards = useCallback(async () => {
    const { data } = await supabase
      .from("dashboards")
      .select("*, unit:administrative_units(*)")
      .order("created_at", { ascending: false });

    setDashboards((data ?? []) as DashboardRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDashboards();
  }, [fetchDashboards]);

  /** Danh sách Dashboard hiển thị */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return dashboards.filter((dash) => dash.unit?.type === "PROVINCE");
    }
    return dashboards.filter((dash) => {
      const name = dash.unit?.name ?? dash.title;
      return name.toLowerCase().includes(term);
    });
  }, [dashboards, search]);

  const handleOpen = useCallback(
    (dash: DashboardRow): void => {
      if (dash.unit?.type === "COMMUNE") {
        const parentId = dash.unit.parent_id;
        const parentDash = dashboards.find((d) => d.unit_id === parentId);
        if (parentDash) {
          router.push(`/${parentDash.id}/${dash.id}`);
          return;
        }
      }
      router.push(`/${dash.id}`);
    },
    [router, dashboards]
  );

  const openEdit = useCallback((dash: DashboardRow): void => {
    setEditing(dash);
    setEditTitle(dash.title);
    setEditDomain(dash.domain_link ?? "");
  }, []);

  const handleDelete = useCallback(
    async (dash: DashboardRow): Promise<void> => {
      const name = dash.unit?.name ?? dash.title;
      if (
        !confirm(
          `Xóa Dashboard "${name}" và toàn bộ Dashboard Xã/Phường trực thuộc?`
        )
      ) {
        return;
      }

      const res = await fetch("/api/v1/dashboards/delete-province", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dash.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`Lỗi xóa: ${data.error ?? "Không xác định"}`);
        return;
      }
      setNotice(data.message ?? "Đã xóa Dashboard Tỉnh thành công!");
      void fetchDashboards();
    },
    [fetchDashboards]
  );

  const handleUpdate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!editing) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/dashboards/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, domainLink: editDomain }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Lỗi cập nhật");
      }

      setEditing(null);
      setNotice("Cập nhật Dashboard thành công!");
      void fetchDashboards();
    } catch (err) {
      alert(
        `Lỗi cập nhật: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="dashboard-bg" />

      {/* HEADER */}
      <header className="glass-strong sticky top-0 z-40 border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-white shadow-lg shadow-accent/30">
              <BarChart3 size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold sm:text-lg">
                BẢNG ĐIỀU KHIỂN KINH TẾ SỐ
              </h1>
              <p className="truncate text-[11px] opacity-60 sm:text-xs">
                Hệ thống đồng bộ thông số dữ liệu Việt Nam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* NÚT TẠO DASHBOARD TỈNH: Mobile chỉ hiện icon, Desktop hiện chữ */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-blue-600 p-2.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-95"
                title="Tạo dashboard tỉnh"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Tạo dashboard tỉnh</span>
              </button>
            )}

            {/* THÔNG TIN ADMIN: Ẩn trên mobile, hiện trên màn hình sm trở lên */}
            <div className="hidden sm:flex items-center">
              <AuthControls />
            </div>

            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Thông báo */}
        {notice && (
          <div className="glass mb-6 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
            <span className="text-accent">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Đóng thông báo"
              className="rounded-lg p-1 text-foreground/50 transition hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Hero giới thiệu */}
        <section className="glass relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-accent/10 via-transparent to-blue-600/10 p-5 sm:p-8">
          <div className="pointer-events-none absolute -top-16 right-10 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
          <p className="text-xs font-medium uppercase tracking-widest text-accent">
            Nền tảng kinh tế số
          </p>
          <h2 className="mt-2 text-xl font-bold sm:text-3xl">
            Dashboard Kinh tế số địa phương
          </h2>
          <p className="mt-2 max-w-2xl text-xs opacity-70 sm:text-sm">
            Danh sách Dashboard Tỉnh / Thành và Xã / Phường trực thuộc sau sáp
            nhập. Bấm vào thẻ để xem chi tiết cùng 5 tầng nội dung kinh tế số.
          </p>
        </section>

        {/* Tìm kiếm */}
        <div className="relative mb-5 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tra cứu nhanh theo Xã / Phường…"
            className="glass w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Danh sách Dashboard Tỉnh */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="glass h-44 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((dash) => (
              <ProvinceCard
                key={dash.id}
                dashboard={dash}
                onOpen={handleOpen}
                onSetupLink={setLinkTarget}
                onSetupMetrics={setMetricsTarget}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="glass flex flex-col items-center justify-center gap-3 rounded-3xl p-10 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
              <Search size={28} />
            </span>
            <h3 className="text-xl font-bold">Chưa có Dashboard phù hợp</h3>
            <p className="max-w-md text-sm opacity-60">
              Dùng nút “Tạo dashboard tỉnh” để khởi tạo Dashboard cho Tỉnh /
              Thành phố mới cùng toàn bộ Xã / Phường trực thuộc.
            </p>
          </div>
        )}
      </main>

      {/* Modal Tạo Dashboard Tỉnh */}
      {showCreate && (
        <CreateProvinceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setNotice("Tạo Dashboard Tỉnh & Xã trực thuộc thành công!");
            void fetchDashboards();
          }}
        />
      )}

      {/* Modal Thiết lập Link */}
      {linkTarget && (
        <LinkModal
          dashboard={linkTarget}
          onClose={() => setLinkTarget(null)}
          onSaved={() => {
            setNotice("Thiết lập Link thành công!");
            void fetchDashboards();
          }}
        />
      )}

      {/* Modal Thiết lập Số lượng */}
      {metricsTarget && (
        <MetricsModal
          dashboard={metricsTarget}
          onClose={() => setMetricsTarget(null)}
          onSaved={() => {
            setNotice("Lưu số lượng thành công!");
            void fetchDashboards();
          }}
        />
      )}

      {/* Modal Sửa Dashboard */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditing(null)}
            aria-hidden
          />
          <div className="glass-strong relative w-full max-w-md rounded-2xl p-6">
            <h3 className="mb-4 text-lg font-semibold">
              CHỈNH SỬA DASHBOARD TỈNH
            </h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label htmlFor="edit-title" className="mb-1 block text-sm opacity-70">
                  Tiêu đề Dashboard
                </label>
                <input
                  id="edit-title"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label htmlFor="edit-domain" className="mb-1 block text-sm opacity-70">
                  Domain Link Tùy chỉnh
                </label>
                <input
                  id="edit-domain"
                  type="text"
                  value={editDomain}
                  onChange={(event) => setEditDomain(event.target.value)}
                  className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="glass rounded-xl px-4 py-2 text-sm opacity-80 transition hover:opacity-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {savingEdit ? "Đang lưu…" : "Lưu Thay Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}