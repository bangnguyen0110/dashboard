/**
 * Module đọc nội dung văn bản từ file PDF (phía Client) và bóc tách
 * các chỉ tiêu dạng "Tên thông số: Giá trị" dựa trên Regex.
 *
 * Lưu ý: pdfjs-dist chỉ được tải bằng dynamic import khi thực sự đọc file
 * (chạy trong trình duyệt) để tránh lỗi khi Next.js prerender trang.
 */

/** Một chỉ tiêu bóc tách được từ PDF. */
export interface ExtractedMetric {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
}

/** Phiên bản pdfjs-dist đang dùng (khớp với file worker trên CDN). */
const PDFJS_VERSION = "6.2.108";

let pdfjsModule: typeof import("pdfjs-dist") | null = null;
let workerConfigured = false;

/** Dynamic import pdfjs-dist (cache lại sau lần đầu). */
async function getPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist");
  }
  return pdfjsModule;
}

/** Cấu hình worker cho pdfjs-dist một lần duy nhất. */
async function ensureWorker(): Promise<void> {
  if (workerConfigured) return;
  const pdfjs = await getPdfJs();
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  workerConfigured = true;
}

/** Đọc toàn bộ văn bản trong file PDF. */
export async function extractTextFromPdf(file: File | Blob): Promise<string> {
  const pdfjs = await getPdfJs();
  await ensureWorker();

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push(pageText);
      page.cleanup();
    }
    return pages.join("\n");
  } finally {
    await loadingTask.destroy();
  }
}

/** Chuẩn hoá chuỗi thành key an toàn (không dấu, lowercase, gạch nối). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Danh sách chỉ tiêu đã biết, ưu tiên khớp theo từ khoá. */
const KNOWN_KEYWORDS: Array<{ key: string; label: string; regex: RegExp }> = [
  {
    key: "population",
    label: "Dân số",
    regex: /(?:dân\s*số|số\s*dân)\s*[:：]?\s*([\d][\d.,]*)\s*(người|triệu|nghìn)?/i,
  },
  {
    key: "area",
    label: "Diện tích",
    regex: /(?:diện\s*tích)\s*[:：]?\s*([\d][\d.,]*)\s*(km2|km²|ha|m2|m²)?/i,
  },
  {
    key: "grdp",
    label: "GRDP",
    regex: /GRDP\s*[:：]?\s*([\d][\d.,]*)\s*(triệu|tỷ)?/i,
  },
  {
    key: "sme",
    label: "Doanh nghiệp SME",
    regex: /(?:doanh\s*nghiệp|sme)\s*(?:vừa\s*và\s*nhỏ)?\s*[:：]?\s*([\d][\d.,]*)\s*(doanh nghiệp|dn)?/i,
  },
  {
    key: "hkd",
    label: "Hộ kinh doanh",
    regex: /(?:hộ\s*kinh\s*doanh|hkd)\s*[:：]?\s*([\d][\d.,]*)\s*(hộ)?/i,
  },
  {
    key: "htx",
    label: "Hợp tác xã",
    regex: /(?:hợp\s*tác\s*xã|htx)\s*[:：]?\s*([\d][\d.,]*)\s*(htx)?/i,
  },
];

/** Đơn vị kèm theo giá trị bóc tách từ dạng "Tên: Giá trị Đơn_vị". */
const GENERIC_LINE =
  /([^\n:：]+?)\s*[:：]\s*([\d][\d.,]*)\s*(%|triệu|tỷ|đồng|km2|km²|m2|m²|người|hộ|doanh nghiệp|htx|sản phẩm|dịch vụ|ha)?\s*$/gm;

/** Chuyển chuỗi số thành `number` nếu hợp lệ, ngược lại giữ nguyên chuỗi. */
function toValue(raw: string): number | string {
  const cleaned = raw.replace(/[.,](?=\d{3})/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : raw;
}

/** Bóc tách danh sách chỉ tiêu từ văn bản PDF. */
export function parseMetricsFromText(text: string): ExtractedMetric[] {
  const result: ExtractedMetric[] = [];
  const seen = new Set<string>();

  for (const kw of KNOWN_KEYWORDS) {
    const match = text.match(kw.regex);
    if (match) {
      result.push({
        key: kw.key,
        label: kw.label,
        value: toValue(match[1]),
        unit: match[2] || undefined,
      });
      seen.add(kw.key);
    }
  }

  let match: RegExpExecArray | null;
  while ((match = GENERIC_LINE.exec(text)) !== null) {
    const label = match[1].trim();
    if (!label || label.length > 40) continue;

    const key = slugify(label);
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      key,
      label,
      value: toValue(match[2]),
      unit: match[3] || undefined,
    });
  }

  return result;
}