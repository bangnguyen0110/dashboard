// diag8.mjs — Test upsert/update trên kpi_business_units & kpi_products
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"+|"+$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const log = (s) => console.log(s);
const COMMUNE = "92c587bb-a1f3-4a62-b46d-bc661d703d82";
const PROV = "e1dec74a-eefa-4452-b72d-2ef34e43dc9d";
const nowIso = new Date().toISOString();

// 1. Upsert kpi_business_units với onConflict dashboard_id (cùng giá trị cũ + updated_at mới)
const { data: cur } = await sb.from("kpi_business_units").select("*").eq("dashboard_id", COMMUNE).maybeSingle();
log("CURRENT updated_at: " + cur?.updated_at);
const payload = { dashboard_id: COMMUNE, updated_at: nowIso, sme_total: cur?.sme_total ?? 0, hkd_total: cur?.hkd_total ?? 0, htx_total: cur?.htx_total ?? 0 };
const { error: upErr } = await sb.from("kpi_business_units").upsert(payload, { onConflict: "dashboard_id" });
log("UPSERT onConflict dashboard_id => " + (upErr ? "ERR: " + upErr.message : "OK"));

const { data: after } = await sb.from("kpi_business_units").select("updated_at").eq("dashboard_id", COMMUNE).maybeSingle();
log("AFTER UPSERT updated_at: " + after?.updated_at + (after?.updated_at !== cur?.updated_at ? " (ĐỔI)" : " (KHÔNG ĐỔI!)"));

// 2. Update thường
const { error: upErr2 } = await sb.from("kpi_business_units").update({ updated_at: nowIso }).eq("dashboard_id", COMMUNE);
log("UPDATE .eq(dashboard_id) => " + (upErr2 ? "ERR: " + upErr2.message : "OK"));
const { data: after2 } = await sb.from("kpi_business_units").select("updated_at").eq("dashboard_id", COMMUNE).maybeSingle();
log("AFTER UPDATE updated_at: " + after2?.updated_at);

// 3. Đếm số dòng trùng dashboard_id
const { data: rows, count } = await sb.from("kpi_business_units").select("id", { count: "exact" }).eq("dashboard_id", COMMUNE);
log("ROWS kpi_business_units cho xã: " + count);
const { count: c2 } = await sb.from("kpi_products").select("id", { count: "exact" }).eq("dashboard_id", COMMUNE);
log("ROWS kpi_products cho xã: " + c2);
const { count: c3 } = await sb.from("kpi_business_units").select("id", { count: "exact" }).eq("dashboard_id", PROV);
log("ROWS kpi_business_units cho tỉnh: " + c3);

// 4. Kiểm tra giá trị cào thực tế từ web nguồn so với DB (thẻ b1_sme_total)
const { data: link } = await sb.from("metric_links").select("metric_key,target_url").eq("dashboard_id", COMMUNE).eq("metric_key", "b1_sme_total").maybeSingle();
if (link) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(link.target_url + (link.target_url.includes("?") ? "&" : "?") + "_nocache=" + Date.now(), { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    clearTimeout(t);
    const body = await resp.text();
    const stripped = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    log("WEB b1_sme_total (" + link.target_url + "): status=" + resp.status + " text=" + stripped.slice(0, 150));
  } catch (e) { log("WEB FETCH ERR: " + e.message); }
} else log("Không có link b1_sme_total cho xã mẫu");
