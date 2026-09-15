// diag9.mjs — Xác minh tổng SUM cấp Tỉnh = SUM các xã sau refresh
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"+|"+$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const PROV = "e1dec74a-eefa-4452-b72d-2ef34e43dc9d";
const PROV_UNIT = "06b6c9da-cac7-44ca-90c7-0bee472f939c";

const { data: kids } = await sb.from("administrative_units").select("id").eq("parent_id", PROV_UNIT).limit(300);
const kidIds = (kids ?? []).map((k) => k.id);
const { data: cd } = await sb.from("dashboards").select("id").in("unit_id", kidIds).limit(300);
const ids = (cd ?? []).map((c) => c.id);
console.log("Số xã/phường: " + ids.length);

const { data: b1 } = await sb.from("kpi_business_units").select("sme_total,hkd_total,htx_total,sme_dx,hkd_dx,htx_dx,updated_at").in("dashboard_id", ids);
let s = 0, h = 0, x = 0, sd = 0, hd = 0, xd = 0;
for (const r of b1 ?? []) { s += r.sme_total || 0; h += r.hkd_total || 0; x += r.htx_total || 0; sd += r.sme_dx || 0; hd += r.hkd_dx || 0; xd += r.htx_dx || 0; }
console.log(`SUM các xã B1: DN=${s} HKD=${h} HTX=${x} | DN CĐS=${sd} HKD CĐS=${hd} HTX CĐS=${xd} (rows=${b1.length})`);

const { data: pb } = await sb.from("kpi_business_units").select("sme_total,hkd_total,htx_total,sme_dx,hkd_dx,htx_dx,updated_at").eq("dashboard_id", PROV).maybeSingle();
console.log("PROVINCE B1: " + JSON.stringify(pb));
const match = pb && pb.sme_total === s && pb.hkd_total === h && pb.htx_total === x;
console.log("SUM KHỚP TỈNH: " + (match ? "✅ ĐÚNG" : "❌ SAI"));

const fresh = (b1 ?? []).filter((r) => r.updated_at > "2026-08-31T18:30").length;
console.log(`Số xã có updated_at sau 18:30 UTC hôm nay: ${fresh}/${b1.length}`);
