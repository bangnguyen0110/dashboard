"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AdminUnit } from "@/lib/types";
import { DashboardDetail } from "@/components/dashboard/dashboard-detail";

/**
 * Trang Chi tiết Dashboard Tỉnh (`/[provinceId]`).
 * Nếu id truy cập thuộc Xã/Phường thì tự động chuyển hướng về
 * route lồng `/[provinceId]/[communeId]`.
 */

type RouteState = "loading" | "ready" | "redirecting";

type DashRow = { id: string; unit: AdminUnit | null };

export default function ProvincePage() {
  const params = useParams();
  const router = useRouter();
  const provinceId = params.provinceId as string;

  const [routeState, setRouteState] = useState<RouteState>("loading");

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase
        .from("dashboards")
        .select("id, unit:administrative_units(*)")
        .eq("id", provinceId)
        .maybeSingle();

      if (!active) return;
      const dash = data as DashRow | null;

      if (!dash) {
        // DashboardDetail sẽ hiển thị trạng thái "không tìm thấy"
        setRouteState("ready");
        return;
      }

      if (dash.unit?.type === "COMMUNE") {
        // Chuyển hướng Xã/Phường tới route lồng /[provinceId]/[communeId]
        const parentId = dash.unit.parent_id;
        let target = "/";
        if (parentId) {
          const { data: parentDash } = await supabase
            .from("dashboards")
            .select("id")
            .eq("unit_id", parentId)
            .maybeSingle();
          if (parentDash) target = `/${parentDash.id}/${provinceId}`;
        }
        if (!active) return;
        setRouteState("redirecting");
        router.replace(target);
        return;
      }

      setRouteState("ready");
    })();

    return () => {
      active = false;
    };
  }, [provinceId, router]);

  if (routeState === "ready") {
    return (
      <DashboardDetail key={provinceId} dashboardId={provinceId} backHref="/" />
    );
  }

  // loading / redirecting
  return (
    <div className="relative min-h-screen">
      <div className="dashboard-bg" />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="glass h-40 animate-pulse rounded-3xl" />
      </main>
    </div>
  );
}