"use client";

import { useMemo, useState } from "react";
import { Dialog } from "../dialog";
import type { DashboardRow } from "@/lib/types";

/**
 * Modal "THIẾT LẬP ID CHỈ SỐ" cho từng ô chỉ tiêu (B1 / B2).
 *
 * - Nhập "Mã ID liên kết" (metric_id) → hiển thị Preview đường dẫn hoàn chỉnh
 *   `[Domain Header Tầng 1]/[ID vừa nhập]`.
 * - Nút "Lưu & Đồng bộ số liệu": gọi `onSave` (do parent cung cấp) để ghi
 *   metric_id, xây URL, cào dữ liệu (scrape-metric) rồi cập nhật chỉ tiêu.
 *
 * Component render có điều kiện (mount khi mở) nên state khởi tạo mới mỗi lần.
 */
export function MetricIdModal({
  dashboard,
  metricKey,
  label,
  baseDomain = "",
  initialId = "",
  onSave,
  onClose,
  onSaved,
}: {
  dashboard: DashboardRow;
  metricKey: string;
  label: string;
  baseDomain?: string;
  initialId?: string;
  onSave: (metricKey: string, metricId: string) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [metricId, setMetricId] = useState(initialId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview đường dẫn hoàn chỉnh: [Domain]/[ID]
  const previewUrl = useMemo(() => {
    const domain = (baseDomain || "").trim().replace(/\/+$/, "");
    const id = metricId.trim();
    if (!id) return "";
    return domain ? `${domain}/${id}` : id;
  }, [baseDomain, metricId]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = metricId.trim();
    if (!id) {
      setError("Vui lòng nhập Mã ID liên kết.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Parent (dashboard-detail / b1 / b2) xử lý toàn bộ:
      // ghi metric_id, xây URL, gọi scrape-metric, cập nhật chỉ tiêu.
      await onSave(metricKey, id);
      onClose();
      onSaved();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title={`Thiết lập ID Chỉ số · ${label}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="metric-id" className="mb-1 block text-sm opacity-70">
            Mã ID liên kết
          </label>
          <input
            id="metric-id"
            type="text"
            value={metricId}
            onChange={(event) => setMetricId(event.target.value)}
            placeholder="Nhập ID, ví dụ: B4HbFf11820eB5C"
            className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {baseDomain ? (
          <div>
            <label className="mb-1 block text-xs opacity-50">
              Preview đường dẫn hoàn chỉnh
            </label>
            <div className="glass w-full rounded-xl px-4 py-2.5 text-sm break-all opacity-80">
              {previewUrl || "Nhập ID để xem preview…"}
            </div>
          </div>
        ) : null}

        {dashboard?.unit?.name && (
          <p className="text-[11px] opacity-50">
            Áp dụng cho: {dashboard.unit.name} · {label}
          </p>
        )}

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="glass rounded-xl px-4 py-2 text-sm opacity-80 transition hover:opacity-100 disabled:opacity-40"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Đang lưu & đồng bộ…" : "Lưu & Đồng bộ số liệu"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}