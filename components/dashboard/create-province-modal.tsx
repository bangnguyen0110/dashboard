"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Dialog } from "./dialog";
import { supabase } from "@/lib/supabase";
import type { AdminUnit } from "@/lib/types";

/**
 * Modal tạo Dashboard Tỉnh mới.
 * Khi tạo thành công, hệ thống tự sinh Dashboard cho toàn bộ Xã/Phường
 * trực thuộc (xem API /api/v1/dashboards/create-province).
 */

interface CreateProvinceModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProvinceModal({ onClose, onCreated }: CreateProvinceModalProps) {
  const [provinces, setProvinces] = useState<AdminUnit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<AdminUnit | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [domainLink, setDomainLink] = useState("");
  const [syncSchedule, setSyncSchedule] = useState("0 0 * * *");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProvinces = useCallback(async (): Promise<void> => {
    const { data } = await supabase
      .from("administrative_units")
      .select("*")
      .eq("type", "PROVINCE")
      .order("name", { ascending: true });
    setProvinces(data ?? []);
  }, []);

  // Modal được render có điều kiện ở HomePage ({showCreate && <CreateProvinceModal />})
  // nên state luôn tươi mỗi lần mở — không cần reset trong effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch danh sách tỉnh khi modal mount (setState sau await)
    void loadProvinces();
  }, [loadProvinces]);

  const filtered = useMemo(
    () =>
      provinces.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [provinces, searchQuery]
  );

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!selected) {
      setError("Vui lòng chọn Tỉnh / Thành phố!");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/dashboards/create-province", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provinceId: selected.id,
          domainLink,
          syncSchedule,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi tạo Dashboard");

      onClose();
      onCreated();
    } catch (err) {
      setError(
        `Không thể tạo Dashboard: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open title="Tạo Dashboard Tỉnh" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Chọn Tỉnh */}
        <div>
          <label className="mb-1 block text-sm font-medium opacity-80">
            Chọn Tỉnh / Thành phố (34 tỉnh/thành sau sáp nhập)
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="glass flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              <span className={selected ? undefined : "opacity-50"}>
                {selected?.name ?? "-- Tìm & Chọn Tỉnh/Thành phố --"}
              </span>
              <ChevronDown size={16} className="opacity-60" />
            </button>

            {dropdownOpen && (
              <div className="glass-strong absolute top-full left-0 z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl p-2 shadow-glass">
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-60" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Gõ tên tỉnh để tìm…"
                    className="w-full rounded-lg border border-white/10 bg-transparent py-1.5 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {filtered.map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setSelected(prov);
                      setDropdownOpen(false);
                      setSearchQuery("");
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      selected?.id === prov.id
                        ? "bg-accent/20 text-accent"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span>{prov.name}</span>
                    {selected?.id === prov.id && <Check size={14} />}
                  </button>
                ))}

                {filtered.length === 0 && (
                  <p className="px-3 py-2 text-xs opacity-50">
                    Không tìm thấy tỉnh phù hợp.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="create-domain" className="mb-1 block text-sm font-medium opacity-80">
            Link Domain (URL tùy chỉnh / slug)
          </label>
          <input
            id="create-domain"
            type="text"
            value={domainLink}
            onChange={(event) => setDomainLink(event.target.value)}
            placeholder="kinhteso.kiengiang.gov.vn"
            className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="create-schedule" className="mb-1 block text-sm font-medium opacity-80">
            Thời gian đồng bộ dữ liệu (Sync interval)
          </label>
          <input
            id="create-schedule"
            type="text"
            value={syncSchedule}
            onChange={(event) => setSyncSchedule(event.target.value)}
            className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="glass rounded-xl px-4 py-2 text-sm opacity-80 transition hover:opacity-100"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? "Đang khởi tạo…" : "Tạo Dashboard"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
