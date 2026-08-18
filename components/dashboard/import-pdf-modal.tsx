"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { Dialog } from "./dialog";
import {
  extractTextFromPdf,
  parseMetricsFromText,
  type ExtractedMetric,
} from "@/lib/pdf-parser";
import type { DashboardRow } from "@/lib/types";

/**
 * Modal "Import PDF" — hiển thị trên Header (cạnh nút chuyển sáng/tối).
 * - Cho phép chọn file PDF để bóc tách (parse) các thông số.
 * - Tự động ánh xạ các chỉ tiêu bóc tách được vào từng ô của Khối B1 & B2.
 * - Khi bấm "Lưu", ghi giá trị vào bảng KPI qua API /api/v1/metrics/update-value
 *   (giống hệt luồng lưu số lượng hiện tại của từng ô).
 */

interface ImportPdfModalProps {
  dashboard: DashboardRow;
  onClose: () => void;
  onSaved: () => void;
}

interface TargetField {
  field: string;
  label: string;
  section: "B1" | "B2";
  tokens: string[];
}

/** Danh sách ô chỉ tiêu của Khối B1 & B2 (đúng tên cột trong DB). */
const TARGETS: TargetField[] = [
  { field: "sme_total", label: "SME · Tổng số", section: "B1", tokens: ["sme", "doanh nghiệp vừa và nhỏ", "doanh nghiệp"] },
  { field: "sme_cds", label: "SME · Chuyển đổi số", section: "B1", tokens: ["sme chuyển đổi số", "doanh nghiệp chuyển đổi số"] },
  { field: "hkd_total", label: "HKD · Tổng số", section: "B1", tokens: ["hkd", "hộ kinh doanh"] },
  { field: "hkd_cds", label: "HKD · Chuyển đổi số", section: "B1", tokens: ["hkd chuyển đổi số", "hộ kinh doanh chuyển đổi số"] },
  { field: "htx_total", label: "HTX · Tổng số", section: "B1", tokens: ["htx", "hợp tác xã"] },
  { field: "htx_cds", label: "HTX · Chuyển đổi số", section: "B1", tokens: ["htx chuyển đổi số", "hợp tác xã chuyển đổi số"] },
  { field: "ocop_3star", label: "OCOP 3 sao", section: "B2", tokens: ["ocop 3", "3 sao"] },
  { field: "ocop_4star", label: "OCOP 4 sao", section: "B2", tokens: ["ocop 4", "4 sao"] },
  { field: "ocop_5star", label: "OCOP 5 sao", section: "B2", tokens: ["ocop 5", "5 sao"] },
  { field: "sp_thuong", label: "Sản phẩm thường", section: "B2", tokens: ["sản phẩm thường", "sp thường"] },
  { field: "dich_vu", label: "Dịch vụ", section: "B2", tokens: ["dịch vụ"] },
];

function toNumber(value: number | string): number {
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Tự động tìm chỉ tiêu bóc tách từ PDF khớp với một ô đích. */
function detect(target: TargetField, list: ExtractedMetric[]): ExtractedMetric | undefined {
  const lower = (s: string) => s.toLowerCase();
  return list.find((m) =>
    target.tokens.some((t) =>
      lower(m.label).includes(lower(t)) || lower(m.key).includes(lower(t))
    )
  );
}

export function ImportPdfModal({ dashboard, onClose, onSaved }: ImportPdfModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [extracted, setExtracted] = useState<ExtractedMetric[]>([]);
  /** field -> giá trị (string, cho phép người dùng sửa trước khi lưu). */
  const [mapped, setMapped] = useState<Record<string, string>>({});

  const reset = (): void => {
    setFileName("");
    setExtracted([]);
    setMapped({});
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setParsing(true);
    setError(null);
    reset();
    setFileName(file.name);
    try {
      const text = await extractTextFromPdf(file);
      const metrics = parseMetricsFromText(text);
      if (metrics.length === 0) {
        setError(
          "Không tìm thấy chỉ tiêu nào khớp định dạng 'Tên thông số: Giá trị' trong PDF."
        );
        return;
      }
      setExtracted(metrics);

      const auto: Record<string, string> = {};
      for (const target of TARGETS) {
        const match = detect(target, metrics);
        if (match) auto[target.field] = String(toNumber(match.value));
      }
      setMapped(auto);
    } catch (err) {
      setError(`Lỗi đọc file PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setParsing(false);
    }
  };

  const fillFromOption = (field: string, metricIndex: string): void => {
    const metric = extracted[Number(metricIndex)];
    setMapped((prev) => ({ ...prev, [field]: metric ? String(toNumber(metric.value)) : "" }));
  };

  const updateValue = (field: string, value: string): void => {
    setMapped((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payloads: Array<{
        dashboardId: string;
        section: "B1" | "B2";
        field: string;
        value: number;
      }> = [];

      for (const target of TARGETS) {
        const raw = mapped[target.field];
        if (raw === undefined || raw === null || raw.trim() === "") continue;
        const num = Number(raw.replace(/[^\d.-]/g, ""));
        if (!Number.isFinite(num) || num < 0) continue;
        payloads.push({
          dashboardId: dashboard.id,
          section: target.section,
          field: target.field,
          value: num,
        });
      }

      if (payloads.length === 0) {
        setError("Chưa có ô nào được điền. Hãy nhập số lượng hoặc chọn chỉ tiêu để lưu.");
        return;
      }

      for (const payload of payloads) {
        const res = await fetch("/api/v1/metrics/update-value", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `Lỗi lưu ${payload.field}`);
        }
      }

      onClose();
      onSaved();
    } catch (err) {
      setError(`Lỗi lưu số liệu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title="Import PDF · Tự điền B1 & B2" onClose={onClose}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <div className="space-y-4">
        {/* Chọn file PDF */}
        <button
          type="button"
          disabled={parsing}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent/5 px-4 py-8 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-60"
        >
          {parsing ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Đang đọc PDF…
            </>
          ) : (
            <>
              <Upload size={18} /> {fileName ? fileName : "Chọn file PDF để bóc tách thông số"}
            </>
          )}
        </button>

        {extracted.length > 0 && (
          <>
            <p className="text-xs opacity-60">
              Đã bóc tách {extracted.length} chỉ tiêu từ PDF. Kiểm tra &amp; điều chỉnh giá trị
              từng ô trước khi lưu:
            </p>

            {/* Danh sách ô B1 */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                Khối B1 · Đơn vị kinh doanh
              </p>
              {TARGETS.filter((t) => t.section === "B1").map((target) => (
                <div key={target.field} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 text-xs opacity-80">{target.label}</span>
                  <select
                    onChange={(e) => fillFromOption(target.field, e.target.value)}
                    className="glass w-32 shrink-0 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">— Chỉ tiêu —</option>
                    {extracted.map((_, idx) => (
                      <option key={idx} value={idx}>
                        {extracted[idx].label} — {String(extracted[idx].value)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={mapped[target.field] ?? ""}
                    onChange={(e) => updateValue(target.field, e.target.value)}
                    placeholder="Số lượng"
                    className="glass w-full rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              ))}
            </div>

            {/* Danh sách ô B2 */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Khối B2 · Sản phẩm trên địa bàn
              </p>
              {TARGETS.filter((t) => t.section === "B2").map((target) => (
                <div key={target.field} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 text-xs opacity-80">{target.label}</span>
                  <select
                    onChange={(e) => fillFromOption(target.field, e.target.value)}
                    className="glass w-32 shrink-0 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">— Chỉ tiêu —</option>
                    {extracted.map((_, idx) => (
                      <option key={idx} value={idx}>
                        {extracted[idx].label} — {String(extracted[idx].value)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={mapped[target.field] ?? ""}
                    onChange={(e) => updateValue(target.field, e.target.value)}
                    placeholder="Số lượng"
                    className="glass w-full rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              ))}
            </div>
          </>
        )}

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
            type="button"
            disabled={saving || extracted.length === 0}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
            {saving ? "Đang lưu…" : "Lưu vào B1 & B2"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

