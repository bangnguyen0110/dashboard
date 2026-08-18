"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "./dialog";
import { PdfImportButton } from "./pdf-import";
import { MIN_LEVEL, MAX_LEVEL } from "./level-menu";
import type { DashboardRow, MetricKV } from "@/lib/types";
import type { ExtractedMetric } from "@/lib/pdf-parser";

/**
 * Modal "Thiết lập Số lượng": quản lý danh sách chỉ tiêu (Metrics/Key Indicators)
 * dạng Key-Value của Dashboard (Tỉnh / Xã-Phường), lưu vào cột `metadata` (JSONB).
 * Hỗ trợ Import từ PDF để auto-fill số lượng trước khi bấm Save.
 *
 * Component được render có điều kiện (mount khi mở) nên state luôn khởi tạo
 * mới từ `dashboard` mỗi lần mở modal.
 */

interface MetricsModalProps {
  dashboard: DashboardRow;
  onClose: () => void;
  onSaved: () => void;
}

function emptyMetric(): MetricKV {
  return { label: "", value: "" };
}

export function MetricsModal({ dashboard, onClose, onSaved }: MetricsModalProps) {
  const [metrics, setMetrics] = useState<Record<string, MetricKV>>(
    dashboard.metadata?.metrics ?? {}
  );
  const [level, setLevel] = useState(dashboard.metadata?.level ?? MIN_LEVEL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(() => Object.entries(metrics), [metrics]);

  const upsertMetric = (key: string, value: MetricKV): void => {
    setMetrics((prev) => ({ ...prev, [key]: value }));
  };

  const removeMetric = (key: string): void => {
    setMetrics((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /** Gộp danh sách chỉ tiêu bóc tách từ PDF vào form (auto-fill). */
  const handleImported = (extracted: ExtractedMetric[]): void => {
    setMetrics((prev) => {
      const next = { ...prev };
      for (const metric of extracted) {
        next[metric.key] = {
          label: metric.label,
          value: metric.value,
          unit: metric.unit,
        };
      }
      return next;
    });
  };

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    const cleaned: Record<string, MetricKV> = {};
    for (const [key, metric] of entries) {
      const label = metric.label.trim();
      if (!key || !label) continue;
      cleaned[key] = { ...metric, label };
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/dashboards/${dashboard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dashboard.title,
          metadata: { level, metrics: cleaned },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Lỗi lưu số lượng");
      }

      onClose();
      onSaved();
    } catch (err) {
      setError(
        `Lỗi lưu số lượng: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      title={`Thiết lập Số lượng · ${dashboard.unit?.name ?? "Dashboard"}`}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Chọn tầng hiển thị */}
        <div>
          <label htmlFor="metric-level" className="mb-1 block text-sm opacity-70">
            Tầng hiển thị
          </label>
          <select
            id="metric-level"
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
            className="glass w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            {Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => {
              const value = MIN_LEVEL + i;
              return (
                <option key={value} value={value}>
                  Tầng {value}
                </option>
              );
            })}
          </select>
        </div>

        {/* Danh sách chỉ tiêu */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-sm opacity-70">Chỉ tiêu (Key – Value)</label>
            <PdfImportButton onImported={handleImported} />
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center text-xs opacity-50">
                Chưa có chỉ tiêu. Bấm “+ Thêm” hoặc Import từ PDF.
              </p>
            ) : (
              entries.map(([key, metric]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={metric.label}
                    onChange={(event) =>
                      upsertMetric(key, { ...metric, label: event.target.value })
                    }
                    placeholder="Tên chỉ tiêu"
                    className="glass w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="text"
                    value={String(metric.value)}
                    onChange={(event) =>
                      upsertMetric(key, { ...metric, value: event.target.value })
                    }
                    placeholder="Số lượng"
                    className="glass w-28 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="text"
                    value={metric.unit ?? ""}
                    onChange={(event) =>
                      upsertMetric(key, { ...metric, unit: event.target.value })
                    }
                    placeholder="Đơn vị"
                    className="glass w-20 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => removeMetric(key)}
                    aria-label={`Xóa chỉ tiêu ${metric.label}`}
                    className="shrink-0 rounded-lg p-2 text-foreground/50 transition hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => upsertMetric(`metric-${Date.now()}`, emptyMetric())}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium opacity-80 transition hover:opacity-100"
          >
            <Plus size={14} /> Thêm chỉ tiêu
          </button>
        </div>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="glass rounded-xl px-4 py-2 text-sm opacity-80 transition hover:opacity-100"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu Số lượng"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}