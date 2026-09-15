// diag10.mjs — Xác minh luồng tự động ghi metadata giống luồng thủ công
// Cách dùng: node diag10.mjs before|sabotage|after
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"+|"+$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const COMMUNE = "92c587bb-a1f3-4a62-b46d-bc661d703d82"; // Hoà Lạc
const mode = process.argv[2] || "before";

if (mode === "sabotage") {
  const { data: d } = await sb.from("dashboards").select("metadata").eq("id", COMMUNE).maybeSingle();
  const meta = d?.metadata || {};
  meta.metrics = { ...(meta.metrics || {}), b1_sme_total: 99999 };
  meta.b1_sme_total = 99999;
  await sb.from("dashboards").update({ metadata: meta }).eq("id", COMMUNE);
  console.log("SABOTAGED: metadata.metrics.b1_sme_total = 99999");
}

const { data: d2 } = await sb.from("dashboards").select("metadata, level2, level3").eq("id", COMMUNE).maybeSingle();
const m = d2?.metadata || {};
console.log("metadata.metrics.b1_sme_total =", m.metrics?.b1_sme_total);
console.log("metadata.top-level b1_sme_total =", m.b1_sme_total);
console.log("metadata.metrics.b1_hkd_total =", m.metrics?.b1_hkd_total);
console.log("metadata.last_synced_at =", m.last_synced_at);
const mlKeys = Object.keys(m.metrics || {}).length;
console.log("metadata.metrics tổng số key =", mlKeys);
console.log("dashboards.level2 keys =", Object.keys(d2?.level2 || {}).join(","));
