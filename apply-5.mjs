// apply-5.mjs — syncProvinceDirectly (bo cot parent_id/is_province/level) + isProvinceLevel + chunk log
import { readFileSync, writeFileSync } from "node:fs";
const p = "app/api/v1/metrics/refresh-all/route.ts";
let src = readFileSync(p, "utf8");

function replaceExact(oldS, newS) {
  const i = src.indexOf(oldS);
  if (i < 0) throw new Error("Khong thay doan: " + oldS.slice(0, 80));
  src = src.slice(0, i) + newS + src.slice(i + oldS.length);
}

// 1. Thay toàn bo ham syncProvinceDirectly (tru từ "async function syncProvinceDirectly" đến kết thúc "}")
const start = src.indexOf("async function syncProvinceDirectly");
if (start < 0) throw new Error("Khong thay syncProvinceDirectly");
const braceStart = src.indexOf("{", start);
let depth = 0, end = -1;
for (let i = braceStart; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) throw new Error("Khong tim end brace syncProvinceDirectly");

const newSync = `async function syncProvinceDirectly(communeDashboardId?: string) {
  type PlainRow = Record<string, unknown>;
  interface ProvinceRef {
    id: string;
    unit_id: string | null;
  }

  let provDash: ProvinceRef | null = null;

  if (communeDashboardId) {
    // KHONG dung cot dashboards.parent_id (co the chua ton tai): tim qua unit -> parent unit
    const { data: communeDash } = await supabase
      .from("dashboards")
      .select("unit_id, unit:administrative_units(id, name, type, parent_id)")
      .eq("id", communeDashboardId)
      .maybeSingle();
    const cDash = (communeDash ?? {}) as PlainRow;
    const unitId = cDash.unit_id as string | null | undefined;
    const parentUnitId = resolveUnitParentId(cDash.unit ?? null);

    // (a) Theo chuoi don vi hanh chinh: unit (xa) -> parent unit (Tinh) -> dashboard Tinh
    if (!provDash && unitId && parentUnitId) {
      const { data: provByUnit } = await supabase
        .from("dashboards")
        .select("id, unit_id")
        .eq("unit_id", parentUnitId)
        .maybeSingle();
      if (provByUnit) {
        const uDash = provByUnit as PlainRow;
        provDash = { id: String(uDash.id ?? ""), unit_id: (uDash.unit_id as string | null) ?? null };
      }
    }

    // (b) Fallback: dashboard dau tien co unit.type === PROVINCE
    if (!provDash) {
      const { data: provAll } = await supabase
        .from("dashboards")
        .select("id, unit_id, unit:administrative_units(type)")
        .limit(5000);
      const provRow = (provAll ?? []).find((d) => resolveUnitType((d as PlainRow).unit) === "PROVINCE");
      if (provRow) {
        const uDash = provRow as PlainRow;
        provDash = { id: String(uDash.id ?? ""), unit_id: (uDash.unit_id as string | null) ?? null };
      }
    }
  }

  // (c) Dự phòng lan cuoi (goi khong kem communeDashboardId)
  if (!provDash) {
    const { data: fallback } = await supabase
      .from("dashboards")
      .select("id, unit_id, unit:administrative_units(type)")
      .limit(5000);
    const fRow = (fallback ?? []).find((d) => resolveUnitType((d as PlainRow).unit) === "PROVINCE");
    if (fRow) {
      const fDash = fRow as PlainRow;
      provDash = { id: String(fDash.id ?? ""), unit_id: (fDash.unit_id as string | null) ?? null };
    }
  }

  if (provDash && provDash.id) await aggregateAndSyncToProvince(provDash.id, provDash.unit_id || "");
}`;
src = src.slice(0, start) + newSync + src.slice(end + 1);

// 2. isProvinceLevel: chi dua vao unit.type (dash.is_province/level/parent_id co the chua ton tai)
replaceExact(
`    const isProvinceLevel =
      dash.is_province || dash.level === "province" || dash.unit?.type === "PROVINCE" ||
      (!dash.parent_id && dash.level !== "commune" && dash.level !== "district");`,
`    // Chi xac dinh cap Tinh dua vao unit.type (truong is_province/level/parent_id co the chua ton tai)
    const dRow = dash as Record<string, unknown>;
    const isProvinceLevel = resolveUnitType(dRow.unit ?? null) === "PROVINCE";`
);

// 3. Log tien trinh theo chunk trong vòng lặp quét xã
replaceExact(
`      const chunk = communeDashboardIds.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((communeId) => scrapeAndSaveForCommune(communeId, syncEnabled, isTimeUp))
      );
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value) {
          totalChanged += r.value.changed;
          totalTargets += r.value.total;
        }
      });
    }`,
`      const chunk = communeDashboardIds.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((communeId) => scrapeAndSaveForCommune(communeId, syncEnabled, isTimeUp))
      );
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value) {
          totalChanged += r.value.changed;
          totalTargets += r.value.total;
        }
      });
      console.log(\`Đã quét lô \${Math.min(i + chunk.length, communeDashboardIds.length)}/\${communeDashboardIds.length} xã/phường\`);
    }`
);

writeFileSync(p, src, "utf8");
console.log("apply-5 OK - syncProvinceDirectly + isProvinceLevel + chunk log");