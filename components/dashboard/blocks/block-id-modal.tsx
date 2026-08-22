"use client";

import { useState } from "react";
import { Dialog } from "../dialog";
import type { DashboardRow } from "@/lib/types";

/**
 * Modal "Thiết lập" khối (B1 / B2): nhập ID tùy chỉnh của khối, lưu vào
 * cột `b1_custom_id` / `b2_custom_id` trên bảng `dashboards`.
 */

interface BlockIdModalProps {
  dashboard: DashboardRow;
  section: "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7" | "B8" | "B9" | "L3" | "L4" | "L5" | "L2";
  currentId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function BlockIdModal({
  dashboard,
  section,
  currentId = "",
  onClose,
  onSaved,
}: BlockIdModalProps) {
  const [blockId, setBlockId] = useState(currentId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/dashboards/${dashboard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dashboard.title,
          ...(section === "B1"
            ? { b1CustomId: blockId }
            : { b2CustomId: blockId }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Lỗi lưu ID khối");
      }

      onClose();
      onSaved();
    } catch (err) {
      setError(`Lỗi lưu ID khối: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title={`Thiết lập khối ${section}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="block-id" className="mb-1 block text-sm opacity-70">
            ID của khối {section}
          </label>
          <input
            id="block-id"
            type="text"
            value={blockId}
            onChange={(event) => setBlockId(event.target.value)}
            placeholder={`custom-id-${section.toLowerCase()}`}
            className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="mt-1 text-[11px] opacity-50">
            ID tùy chỉnh dùng để liên kết khối với dữ liệu bên ngoài.
          </p>
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
            {saving ? "Đang lưu…" : "Lưu thiết lập"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}