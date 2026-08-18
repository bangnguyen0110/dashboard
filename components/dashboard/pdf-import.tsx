"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import {
  extractTextFromPdf,
  parseMetricsFromText,
  type ExtractedMetric,
} from "@/lib/pdf-parser";

/**
 * Nút "Import từ PDF": đọc nội dung text từ file PDF tải lên, bóc tách
 * các chỉ tiêu dạng "Tên thông số: Giá trị" rồi trả về cho form cha
 * (Auto-fill trước khi bấm Save).
 */

interface PdfImportButtonProps {
  onImported: (metrics: ExtractedMetric[]) => void;
}

export function PdfImportButton({ onImported }: PdfImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;

    setParsing(true);
    setError(null);
    try {
      const text = await extractTextFromPdf(file);
      const metrics = parseMetricsFromText(text);

      if (metrics.length === 0) {
        setError(
          "Không tìm thấy chỉ tiêu nào khớp định dạng 'Tên thông số: Giá trị' trong PDF."
        );
        return;
      }

      onImported(metrics);
    } catch (err) {
      setError(
        `Lỗi đọc file PDF: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <button
        type="button"
        disabled={parsing}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-60"
      >
        <FileUp size={15} />
        {parsing ? "Đang đọc PDF…" : "Import từ PDF"}
      </button>

      {error ? <p className="mt-1.5 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}