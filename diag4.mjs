// diag4.mjs — test fetch + extract thật trên web nguồn; mô phỏng getCommuneMetricTargets
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"+|"+$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const log = (s) => console.log(s);

const { data: unitRow } = await sb.from("administrative_units").select("id").eq("type", "COMMUNE").limit(1).single();
log("UNIT: " + JSON.stringify(unitRow));

const { data: commune, error: ce } = await sb
  .from("dashboards")
  .select("id, title, base_domain, metadata, unit_id, unit:administrative_units(id, name, type, parent_id)")
  .eq("unit_id", unitRow?.id)
  .maybeSingle();
log("COMMUNE ERR: " + (ce?.message ?? "none"));
log("COMMUNE: " + JSON.stringify({ id: commune?.id, title: commune?.title, base_domain: commune?.base_domain, unit: commune?.unit, metric_ids: commune?.metadata?.metric_ids }));

const { data: links } = await sb
  .from("metric_links")
  .select("metric_key, metric_id, target_url")
  .eq("dashboard_id", commune?.id)
  .limit(12);
log("LINKS: " + JSON.stringify(links, null, 2));

const decoder = new TextDecoder("utf-8");
for (const l of (links ?? []).slice(0, 3)) {
  const url = l.target_url;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache" } });
    clearTimeout(t);
    const body = decoder.decode(await resp.arrayBuffer());
    const stripped = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const nums = (body.match(/\d[\d.,]{0,14}/g) || []).slice(0, 15);
    log(`\nURL: ${url} status=${resp.status} len=${body.length}`);
    log(`  first numbers: ${JSON.stringify(nums)}`);
    log(`  text sample: ${stripped.slice(0, 300)}`);
  } catch (err) {
    log(`\nURL: ${url} FETCH ERROR: ${err?.name}: ${err?.message}`);
  }
}
console.log("\nHoàn tất diag4.");