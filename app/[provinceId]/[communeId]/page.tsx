"use client";

import { useParams } from "next/navigation";
import { DashboardDetail } from "@/components/dashboard/dashboard-detail";

/**
 * Trang Chi tiết Dashboard Xã/Phường (`/[provinceId]/[communeId]`).
 * Dùng chung component `DashboardDetail` với Dashboard Tỉnh (kèm Sidebar 5 tầng).
 */

export default function CommunePage() {
  const params = useParams();
  const provinceId = params.provinceId as string;
  const communeId = params.communeId as string;

  return (
    <DashboardDetail
      key={communeId}
      dashboardId={communeId}
      backHref={`/${provinceId}`}
    />
  );
}