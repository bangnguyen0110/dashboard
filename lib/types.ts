/**
 * Các kiểu dữ liệu dùng chung cho toàn hệ thống Dashboard.
 */

export type UnitType = "PROVINCE" | "COMMUNE" | "SPECIAL_ZONE" | string;

export interface AdminUnit {
  id: string;
  code?: string | null;
  name: string;
  type: UnitType;
  parent_id?: string | null;
}

export type MetricValue = number | string;

/** Một chỉ tiêu (Key-Value) của Dashboard. */
export interface MetricKV {
  label: string;
  value: MetricValue;
  unit?: string;
}

/** Dữ liệu JSONB lưu trong cột `metadata` của bảng `dashboards`. */
export interface DashboardMetadata {
  level?: number;
  slug?: string;
  metrics?: Record<string, MetricKV>;
}

export type DashboardSettings = Record<string, unknown>;

/** Một bản ghi trong bảng `dashboards` (bao gồm cả tỉnh và xã/phường). */
export interface DashboardRow {
  id: string;
  unit_id: string;
  title: string;
  domain_link: string | null;
  sync_schedule?: string | null;
  b1_custom_id?: string | null;
  b2_custom_id?: string | null;
  api_key?: string | null;
  metadata?: DashboardMetadata | null;
  settings?: DashboardSettings | null;
  created_at?: string;
  updated_at?: string;
  unit?: AdminUnit | null;
}

export type KpiRow = Record<string, unknown>;