// apply-12.mjs — VA1: helpers + resolveCommuneDashboardIds + getCommuneMetricTargets
import { readFileSync, writeFileSync } from "node:fs";
const p = "app/api/v1/metrics/refresh-all/route.ts";
let src = readFileSync(p, "utf8");

function replaceFn(fnName, newBody) {
  const start = src.indexOf("function " + fnName);
  if (start < 0) throw new Error("Khong thay ham " + fnName);
  const braceStart = src.indexOf("{", start);
  let depth = 0, end = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error("Khong tim end brace " + fnName);
  src = src.slice(0, start) + newBody + src.slice(end + 1);
}
function replaceExact(oldS, newS) {
  const i = src.indexOf(oldS);
  if (i < 0) throw new Error("Khong thay doan: " + oldS.slice(0, 60));
  src = src.slice(0, i) + newS + src.slice(i + oldS.length);
}

// 1. Them helpers sau toNum
replaceExact(
`function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}`,
`function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Tra ve loai don vi (PROVINCE/COMMUNE/...) tu embedded administrative_units. */
function resolveUnitType(raw: unknown): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw as Array<Record<string, unknown>>)[0]?.type as string | null ?? null;
  return (raw as Record<string, unknown>).type as string | null ?? null;
}

/** Tra ve parent_id cua embedded administrative_units. */
function resolveUnitParentId(raw: unknown): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw as Array<Record<string, unknown>>)[0]?.parent_id as string | null ?? null;
  return (raw as Record<string, unknown>).parent_id as string | null ?? null;
}`
);

// 2. Thay resolveCommuneDashboardIds (bo cot level/is_province)
replaceFn("resolveCommuneDashboardIds", `async function resolveCommuneDashboardIds(provinceDashboardId: string, provinceUnitId?: string): Promise<string[]> {
  let ids: string[] = [];

  if (provinceUnitId) {
    const { data: childUnits } = await supabase
      .from("administrative_units")
      .select("id")
      .eq("parent_id", provinceUnitId);
    const unitIds = (childUnits ?? []).map((u) => u.id);
    if (unitIds.length > 0) {
      const { data: cDashboards } = await supabase
        .from("dashboards")
        .select("id")
        .in("unit_id", unitIds);
      ids = (cDashboards ?? []).map((d) => d.id);
    }
  }

  // Fallback an toan: loc theo unit.type (COMMUNE) thay vi cot level/is_province
  if (ids.length === 0) {
    const { data: fallbackDash } = await supabase
      .from("dashboards")
      .select("id, unit:administrative_units(type)")
      .limit(5000);
    ids = (fallbackDash ?? [])
      .filter((d) => d.id !== provinceDashboardId && resolveUnitType((d as Record<string, unknown>).unit) === "COMMUNE")
      .map((d) => d.id);
  }

  return ids;
}`);

writeFileSync(p, src, "utf8");
console.log("apply-12 OK - helpers + resolveCommuneDashboardIds");