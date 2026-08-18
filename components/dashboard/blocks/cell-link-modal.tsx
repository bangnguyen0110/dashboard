"use client";

import { useState } from "react";
import { Dialog } from "../dialog";
import type { DashboardRow } from "@/lib/types";

/**
 * Modal "Thiết lập Link" cho từng ô chỉ tiêu (SME/HKD/HTX/OCOP/SP Thường/Dịch vụ).
 * Ghi `target_url` vào bảng `metric_links` theo `metric_key`.
 */

interface CellLinkModalProps {
  dashboard: DashboardRow;
  metricKey: string;
  label: string;
  initialUrl?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CellLinkModal({
  dashboard,
  metricKey,
  label,
  initialUrl = "",
  onClose,
  onSaved,
}: CellLinkModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/metrics/set-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: dashboard.id,
          metricKey,
          targetUrl: url,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Lỗi lưu link");
      }

      onClose();
      onSaved();
    } catch (err) {
      setError(`Lỗi lưu link: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title={`Thiết lập link · ${label}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="cell-link-url" className="mb-1 block text-sm opacity-70">
            URL chuyển hướng khi bấm vào ô
          </label>
          <input
            id="cell-link-url"
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/chi-tiet"
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
            Huỷ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu link"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}