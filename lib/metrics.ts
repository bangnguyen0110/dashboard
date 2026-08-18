/**
 * Định nghĩa các chỉ tiêu (Metrics) thuộc khối B1 và B2.
 * - B1: các cột trong bảng `kpi_business_units` (total + cds).
 * - B2: các cột trong bảng `kpi_products`.
 */

export interface B1MetricDef {
  key: string;
  label: string;
  unit: string;
  totalKey: string;
  cdsKey: string;
}

export interface B2MetricDef {
  key: string;
  label: string;
  unit: string;
  col: string;
}

export const B1_METRICS: readonly B1MetricDef[] = [
  {
    key: "sme",
    label: "Doanh nghiệp SME",
    unit: "DN",
    totalKey: "sme_total",
    cdsKey: "sme_cds",
  },
  {
    key: "hkd",
    label: "Hộ kinh doanh",
    unit: "hộ",
    totalKey: "hkd_total",
    cdsKey: "hkd_cds",
  },
  {
    key: "htx",
    label: "Hợp tác xã",
    unit: "HTX",
    totalKey: "htx_total",
    cdsKey: "htx_cds",
  },
];

export const B2_METRICS: readonly B2MetricDef[] = [
  { key: "ocop-3-sao", label: "OCOP 3 sao", unit: "SP", col: "ocop_3star" },
  { key: "ocop-4-sao", label: "OCOP 4 sao", unit: "SP", col: "ocop_4star" },
  { key: "ocop-5-sao", label: "OCOP 5 sao", unit: "SP", col: "ocop_5star" },
  { key: "san-pham-thuong", label: "Sản phẩm thường", unit: "SP", col: "sp_thuong" },
  { key: "dich-vu", label: "Dịch vụ", unit: "DV", col: "dich_vu" },
];