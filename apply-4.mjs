// apply-4.mjs — upsert metric_links an toan (fallback khi thieu cot current_value) + getMetricIdAsync chi dung metric_ids
import { readFileSync, writeFileSync } from "node:fs";
const p = "app/api/v1/metrics/refresh-all/route.ts";
let src = readFileSync(p, "utf8");

function replaceExact(oldS, newS) {
  const i = src.indexOf(oldS);
  if (i < 0) throw new Error("Khong thay doan: " + oldS.slice(0, 80));
  src = src.slice(0, i) + newS + src.slice(i + oldS.length);
}

// 1. getMetricIdAsync: chi dung metadata.metric_ids (ID that), bo metadata.metrics (gia tri so)
replaceExact(
`      const subSources = [
        meta.metric_ids,
        meta.metrics,
        meta
      ];`,
`      // CHI dung metadata.metric_ids (ID that). KHONG dung metadata.metrics / metadata
      // vi chua GIA TRI so lieu (input thu cong), khong phai ID.
      const subSources = [
        meta.metric_ids
      ];`
);

// 2. Upsert metric_links an toan: néu cot current_value chua ton tai -> fallback khong kem current_value
replaceExact(
`    if (metricLinksToUpsert.length > 0) {
      await supabase.from("metric_links").upsert(metricLinksToUpsert, { onConflict: "dashboard_id,metric_key" });
    }`,
`    if (metricLinksToUpsert.length > 0) {
      // Ghi an toan: néu cot current_value chua ton tai trong schema cu -> loai bo truoc khi upsert
      const { error: linkErr } = await supabase
        .from("metric_links")
        .upsert(metricLinksToUpsert, { onConflict: "dashboard_id,metric_key" });
      if (linkErr && linkErr.message && linkErr.message.toLowerCase().includes("current_value")) {
        const strippedLinks = (metricLinksToUpsert as Array<Record<string, unknown>>).map(
          ({ current_value: _cv, ...rest }) => rest
        );
        console.warn("metric_links chua co cot current_value -> dang ky khong kem gia tri");
        await supabase.from("metric_links").upsert(strippedLinks, { onConflict: "dashboard_id,metric_key" });
      }
    }`
);

writeFileSync(p, src, "utf8");
console.log("apply-4 OK - upsert fallback + getMetricIdAsync");