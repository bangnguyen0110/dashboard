// diag7.mjs — Lấy ID dashboard Tỉnh + xã mẫu + số liệu trước refresh (để test API)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"+|"+$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: provs } = await sb.from("dashboards").select("id,title,unit_id,unit:administrative_units(type)").limit(2000);
const prov = (provs ?? []).find((d) => d.unit && d.unit.type === "PROVINCE");
console.log("PROVINCE_DASH_ID=" + prov.id);

const { data: kids } = await sb.from("administrative_units").select("id").eq("parent_id", prov.unit_id).limit(300);
const kidIds = (kids ?? []).map((k) => k.id);
const { data: cd } = await sb.from("dashboards").select("id,title").in("unit_id", kidIds).limit(3);
console.log("COMMUNES=" + JSON.stringify(cd));

const { data: lks } = await sb.from("metric_links").select("dashboard_id,metric_key,target_url,metric_id").eq("dashboard_id", cd[0].id);
console.log("SAMPLE_LINKS=" + JSON.stringify(lks).slice(0, 800));

const { data: b1 } = await sb.from("kpi_business_units").select("dashboard_id,sme_total,hkd_total,htx_total,sme_dx,hkd_dx,htx_dx,updated_at").in("dashboard_id", cd.map((c) => c.id));
console.log("B1_BEFORE=" + JSON.stringify(b1));
const { data: pb1 } = await sb.from("kpi_business_units").select("dashboard_id,sme_total,hkd_total,htx_total,updated_at").eq("dashboard_id", prov.id).maybeSingle();
console.log("PROV_B1_BEFORE=" + JSON.stringify(pb1));
