// diag5.mjs — test fetch + extract thật trên web nguồn (xã đã biết)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"+|"+$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const log = (s) => console.log(s);

const COMMUNE_ID = "92c587bb-a1f3-4a62-b46d-bc661d703d82"; // Xã Hoà Lạc

const { data: commune, error: ce } = await sb
  .from("dashboards")
  .select("id, title, base_domain, domain_link, metadata, unit_id, unit:administrative_units(id, name, type, parent_id)")
  .eq("id", COMMUNE_ID)
  .maybeSingle();
log("COMMUNE ERR: " + (ce?.message ?? "none"));
if (commune) {
  log("COMMUNE: " + JSON.stringify({ base_domain: commune.base_domain, domain_link: commune.domain_link, unit: commune.unit, metric_ids: commune.metadata?.metric_ids, last_sync_at: commune.metadata?.last_sync_at, last_synced_at: commune.metadata?.last_synced_at }));
}

const { data: links } = await sb
  .from("metric_links")
  .select("metric_key, metric_id, target_url")
  .eq("dashboard_id", COMMUNE_ID)
  .limit(15);
log("LINKS: " + JSON.stringify(links, null, 2));

const decoder = new TextDecoder("utf-8");
for (const l of (links ?? []).slice(0, 4)) {
  const url = l.target_url;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache" } });
    clearTimeout(t);
    const body = decoder.decode(await resp.arrayBuffer());
    const stripped = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    // Mô phỏng extractNumberFromContent của API (regex đơn giản)
    const directNum = Number(stripped.replace(/,/g, "").trim());
    const firstMatch = body.match(/([\d.,]+)/);
    log(`\nURL: ${url} key=${l.metric_key} status=${resp.status} len=${body.length}`);
    log(`  extract directNum: ${Number.isFinite(directNum) ? directNum : "NaN"}`);
    log(`  extract regex first: ${firstMatch ? firstMatch[1] : null}`);
    log(`  numbers: ${JSON.stringify((body.match(/\d[\d.,]{0,14}/g) || []).slice(0, 15))}`);
    log(`  text: ${stripped.slice(0, 250)}`);
  } catch (err) {
    log(`\nURL: ${url} FETCH ERROR: ${err?.name}: ${err?.message}`);
  }
}
console.log("\nHoàn tất diag5.");