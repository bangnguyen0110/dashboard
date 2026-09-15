// diag6.mjs — Kiểm tra schema Supabase live khớp với truy vấn trong refresh-all/route.ts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"+|"+$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const log = (s) => console.log(s);
const showErr = (label, error) => log(`${label} => ${error ? "ERR: " + error.message : "OK"}`);

// 1. Cột dashboards: phiên bản cũ select url/parent_id -> có lỗi không?
{
  const { error } = await sb.from("dashboards").select("base_domain, domain_link, url, metadata, unit_id, parent_id").limit(1);
  showErr("dashboards.select(url, parent_id) [cũ]", error);
}
// 2. Cột dashboards: phiên bản mới (an toàn) + embed administrative_units
{
  const { data, error } = await sb.from("dashboards").select("base_domain, domain_link, metadata, unit_id, unit:administrative_units(parent_id, type)").limit(1);
  showErr("dashboards.select(base_domain, domain_link, metadata, unit_id, unit:administrative_units(parent_id, type)) [mới]", error);
  if (!error && data?.[0]) log("  sample keys: " + JSON.stringify(Object.keys(data[0])));
}
// 3. Toàn bộ cột của dashboards (limit 1, select *)
{
  const { data, error } = await sb.from("dashboards").select("*").limit(1);
  showErr("dashboards.select(*)", error);
  if (data?.[0]) log("  dashboards columns: " + Object.keys(data[0]).join(", "));
}
// 4. Toàn bộ cột của administrative_units
{
  const { data, error } = await sb.from("administrative_units").select("*").limit(1);
  showErr("administrative_units.select(*)", error);
  if (data?.[0]) log("  administrative_units columns: " + Object.keys(data[0]).join(", "));
}
// 5. Toàn bộ cột của metric_links
{
  const { data, error } = await sb.from("metric_links").select("*").limit(1);
  showErr("metric_links.select(*)", error);
  if (data?.[0]) log("  metric_links columns: " + Object.keys(data[0]).join(", ") + "\n  sample: " + JSON.stringify(data[0]).slice(0, 400));
}
// 6. kpi_business_units / kpi_products
{
  const { data, error } = await sb.from("kpi_business_units").select("*").limit(1);
  showErr("kpi_business_units.select(*)", error);
  if (data?.[0]) log("  kpi_business_units columns: " + Object.keys(data[0]).join(", "));
  const r2 = await sb.from("kpi_products").select("*").limit(1);
  showErr("kpi_products.select(*)", r2.error);
  if (r2.data?.[0]) log("  kpi_products columns: " + Object.keys(r2.data[0]).join(", "));
}
// 7. Unique constraint (dashboard_id, metric_key) cho upsert metric_links?
{
  const { data: anyLink } = await sb.from("metric_links").select("dashboard_id, metric_key, target_url, metric_id").limit(1);
  if (anyLink?.[0]) {
    const row = anyLink[0];
    const { error } = await sb.from("metric_links").upsert(
      { dashboard_id: row.dashboard_id, metric_key: row.metric_key, target_url: row.target_url ?? "", metric_id: row.metric_id ?? "" },
      { onConflict: "dashboard_id,metric_key" }
    );
    showErr("metric_links.upsert(onConflict dashboard_id,metric_key) [re-upsert giá trị cũ - an toàn]", error);
  } else {
    log("metric_links rỗng -> không test được upsert conflict");
  }
}
// 8. Thống kê unit types + quan hệ Tỉnh -> Xã
{
  const { data: units } = await sb.from("administrative_units").select("id, name, type, parent_id").limit(2000);
  const counts = {};
  for (const u of units ?? []) counts[u.type ?? "null"] = (counts[u.type ?? "null"] || 0) + 1;
  log("administrative_units counts by type: " + JSON.stringify(counts));
  const { data: provs } = await sb.from("dashboards").select("id, title, unit_id, unit:administrative_units(type)").limit(2000);
  const provDash = (provs ?? []).find((d) => d.unit?.type === "PROVINCE");
  if (provDash) {
    const { data: children } = await sb.from("administrative_units").select("id").eq("parent_id", provDash.unit_id);
    log(`Dashboard Tỉnh: ${provDash.title} (unit_id=${provDash.unit_id}) -> số unit con: ${(children ?? []).length}`);
    const childIds = (children ?? []).map((c) => c.id);
    if (childIds.length > 0) {
      const { data: cDash } = await sb.from("dashboards").select("id").in("unit_id", childIds);
      log(`-> số dashboard xã/phường resolve được: ${(cDash ?? []).length}`);
    }
  } else {
    log("Không tìm thấy dashboard cấp Tỉnh (unit.type = PROVINCE)");
  }
}
console.log("\nHoàn tất diag6.");
