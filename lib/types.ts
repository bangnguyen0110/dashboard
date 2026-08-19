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
  /** Nguồn chính cho "link Header Tầng 1" (domain/URL đính kèm). */
  base_domain?: string | null;
  metrics?: Record<string, MetricKV>;
}

/** Dữ liệu mỗi dòng trong bảng `metric_links` (theo thiết kế Supabase). */
export interface MetricLinkRow {
  dashboard_id: string;
  metric_key: string;
  target_url: string;
  metric_id?: string | null;   // ID lưu trữ cho tính năng thiết lập ID / scrape
}

/** Metadata cho cột settings JSONB chứa các link thiết lập ID cho từng chỉ tiêu */
export interface MetricLinkSettings {
  /** Map metric_key -> metric_id (ID lưu trữ/nhắc nhở cho việc bóc tách) */
  metric_ids?: Record<string, string | null>;
}

/** Một bản ghi DashboardSettings (dùng cho cột settings JSONB). */
export type DashboardSettings = Record<string, unknown>;

// Các interface/dashboard types

/** Một bản ghi trong bảng `dashboards` (bao gồm cả tỉnh và xã/phường). */
export interface DashboardRow {
  id: string;
  unit_id: string;
  title: string;
    domain_link: string | null;
  /** Cột mới — nguồn chính link Header Tầng 1 (NULL thì dùng metadata/domain_link). */
  base_domain?: string | null;
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