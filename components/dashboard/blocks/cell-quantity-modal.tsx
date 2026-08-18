"use client";

import { useState } from "react";
import { Dialog } from "../dialog";
import { PdfImportButton } from "../pdf-import";
import type { DashboardRow } from "@/lib/types";
import type { ExtractedMetric } from "@/lib/pdf-parser";

/**
 * Modal "Setup Số lượng" cho một ô chỉ tiêu.
 * - Nhập số lượng thủ công HOẶC tải file PDF để auto-fill giá trị.
 * - Khi lưu, ghi vào đúng cột `field` của bảng KPI (B1 hoặc B2) qua
 *   API /api/v1/metrics/update-value.
 */

interface CellQuantityModalProps {
  dashboard: DashboardRow;
  section: "B1" | "B2";
  field: string;
  label: string;
  currentValue: number;
  /** Từ khoá dùng để khớp chỉ tiêu bóc tách từ PDF (auto-fill). */
  matchTokens?: string[];
  /** (Tuỳ chọn) Danh sách cột DB cần ghi đồng bộ (snake_case + camelCase). */
  fields?: string[];
  /** (Tuỳ chọn) Hàm lưu tuỳ biến — thay thế fetch mặc định tới /api/v1/metrics/update-value. */
  saveHandler?: (fields: string[], value: number) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}

function toNumber(value: number | string): number {
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function CellQuantityModal({
  dashboard,
  section,
  field,
  label,
  currentValue,
  matchTokens = [],
  fields,
  saveHandler,
  onClose,
  onSaved,
}: CellQuantityModalProps) {
  const [value, setValue] = useState(String(currentValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Auto-fill số lượng từ danh sách chỉ tiêu PDF bóc tách được. */
  const handleImported = (extracted: ExtractedMetric[]): void => {
    const lower = (s: string) => s.toLowerCase();
    const tokenMatch = extracted.find((m) =>
      matchTokens.some((t) =>
        lower(m.label).includes(lower(t)) || lower(m.key).includes(lower(t))
      )
    );
    const choose = tokenMatch ?? extracted.find((m) => Number.isFinite(toNumber(m.value)));
    if (choose) {
      setValue(String(toNumber(choose.value)));
      setError(null);
    } else {
      setError("Không tìm thấy giá trị phù hợp trong PDF.");
    }
  };

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const affectedFields = fields && fields.length > 0 ? fields : [field];

      if (saveHandler) {
        // Đường lưu tuỳ biến (vd: handleSaveQuantity trong dashboard-detail).
        await saveHandler(affectedFields, toNumber(value));
      } else {
        const res = await fetch("/api/v1/metrics/update-value", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dashboardId: dashboard.id,
            section,
            field,
            fields: affectedFields,
            value: toNumber(value),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Lỗi lưu số lượng");
        }
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
    <Dialog open title={`Setup số lượng · ${label}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <label htmlFor="cell-quantity" className="mb-1 block text-sm opacity-70">
          Số lượng ({field})
        </label>
        <input
          id="cell-quantity"
          type="number"
          min={0}
          step="1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
          <span className="text-xs opacity-60">Hoặc auto-fill từ PDF:</span>
          <PdfImportButton onImported={handleImported} />
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
            {saving ? "Đang lưu…" : "Lưu số lượng"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}