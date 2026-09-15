// apply-2b.mjs — thay getCommuneMetricTargets (bỏ cột url/parent_id/is_province/level)
import { readFileSync, writeFileSync } from "node:fs";
const p = "app/api/v1/metrics/refresh-all/route.ts";
let src = readFileSync(p, "utf8");

const start = src.indexOf("async function getCommuneMetricTargets");
if (start < 0) throw new Error("Khong thay getCommuneMetricTargets");
const braceStart = src.indexOf("{", start);
let depth = 0, end = -1;
for (let i = braceStart; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) throw new Error("Khong tim end brace getCommuneMetricTargets");

const newTargets = `async function getCommuneMetricTargets(communeDashboardId: string): Promise<Array<{ metricKey: string; targetUrl: string; hasExplicitId: boolean }>> {
  const map = new Map<string, { targetUrl: string; hasExplicitId: boolean }>();

  // KHONG select cot url/parent_id (co the chua ton tai trong schema cu)
  const { data: dash } = await supabase
    .from("dashboards")
    .select("base_domain, domain_link, metadata, unit_id, unit:administrative_units(parent_id, type)")
    .eq("id", communeDashboardId)
    .maybeSingle();
  const cDash = (dash ?? {}) as Record<string, unknown>;
  const metaObj = cDash.metadata as Record<string, unknown> | null | undefined;

  const parentUnitId = resolveUnitParentId(cDash.unit ?? null);
  let base = (
    cDash.base_domain || cDash.domain_link ||
    metaObj?.base_domain || metaObj?.domain || metaObj?.url || metaObj?.website || ""
  ).trim().replace(/\\/+$/, "");

  // Lay base tu dashboard cha (Tinh) qua chuoi don vi hanh chinh
  if (!base && parentUnitId) {
    const { data: parentDash } = await supabase
      .from("dashboards")
      .select("base_domain, domain_link, metadata")
      .eq("unit_id", parentUnitId)
      .maybeSingle();
    base = (parentDash?.base_domain || parentDash?.domain_link || (parentDash?.metadata as Record<string, unknown> | null)?.base_domain || "").trim().replace(/\\/+$/, "");
  }

  // Fallback: base cua dashboard cap Tinh (unit.type === PROVINCE)
  if (!base) {
    const { data: provAll } = await supabase
      .from("dashboards")
      .select("base_domain, domain_link, metadata, unit:administrative_units(type)")
      .limit(5000);
    const provRow = (provAll ?? []).find((d) => resolveUnitType((d as Record<string, unknown>).unit) === "PROVINCE");
    base = (provRow?.base_domain || provRow?.domain_link || (provRow?.metadata as Record<string, unknown> | null)?.base_domain || "").trim().replace(/\\/+$/, "");
  }

  if (base && !base.startsWith("http://") && !base.startsWith("https://")) base = "https://" + base;

  const resolveTarget = (rawTarget: string): string | null => {
    const trimmed = (rawTarget || "").trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const urlObj = new URL(trimmed);
        if (!urlObj.hostname.includes(".") && base) return null;
      } catch {
        return null;
      }
      return trimmed;
    }

    if (!base) return null;
    return base + "/" + trimmed.replace(/^\\/+/, "");
  };

  // Chi dung metadata.metric_ids (ID that). KHONG dung metadata.metrics (la gia tri so lieu).
  const metaMetricIds = metaObj?.metric_ids as Record<string, unknown> | null | undefined;
  if (metaMetricIds) {
    for (const [k, v] of Object.entries(metaMetricIds)) {
      if (v !== null && v !== undefined && v !== "") {
        const rawId = String(v).trim();
        if (rawId) {
          const resolvedUrl = resolveTarget(rawId);
          if (resolvedUrl) map.set(k, { targetUrl: resolvedUrl, hasExplicitId: true });
        }
      }
    }
  }

  const { data: links } = await supabase
    .from("metric_links")
    .select("metric_key, target_url, metric_id")
    .eq("dashboard_id", communeDashboardId);

  if (links && links.length > 0) {
    for (const l of links) {
      if (!l.metric_key) continue;
      const rawKey = l.metric_key.trim();
      if (rawKey.toLowerCase().includes("sync") || rawKey.toLowerCase().includes("action") || rawKey.toLowerCase().includes("refresh")) continue;

      const rawTarget = String(l.target_url || l.metric_id || "").trim();
      if (!rawTarget) continue;

      const resolvedUrl = resolveTarget(rawTarget);
      if (resolvedUrl) {
        const existing = map.get(rawKey);
        const hasId = existing ? existing.hasExplicitId : !!l.metric_id || !!l.target_url;
        map.set(rawKey, { targetUrl: resolvedUrl, hasExplicitId: hasId });
      }
    }
  }

  return Array.from(map.entries()).map(([metricKey, val]) => ({ metricKey, targetUrl: val.targetUrl, hasExplicitId: val.hasExplicitId }));
}`;

src = src.slice(0, start) + newTargets + src.slice(end + 1);
writeFileSync(p, src, "utf8");
console.log("apply-2b OK - getCommuneMetricTargets");