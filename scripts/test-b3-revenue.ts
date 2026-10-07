/**
 * ============================================================================
 * scripts/test-b3-revenue.ts — TEST THUẬT TOÁN TIME-BASED ACCUMULATION (Y.C 2)
 * ----------------------------------------------------------------------------
 * Chạy:  npx tsx scripts/test-b3-revenue.ts   (hoặc: npm run test:b3)
 * Kiểm chứng: reset CHỈ đúng kỳ (day/ISO-week/month/quarter/year theo GMT+7),
 * delta = total - last_raw_value (âm -> delta = total), cộng dồn cả 5 thẻ,
 * dữ liệu legacy, chống cộng đúp.
 * ============================================================================
 */
import {
  accumulateB3ScrapedValue,
  applyB3Revenue,
  normalizeB3,
  type B3ApplyResult,
  type B3State,
} from "@/lib/b3-revenue";

let failed = 0;
let passed = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}  ->  ${JSON.stringify(extra)}`);
  }
}

// ===== T1: Lần đầu (fresh) — mọi mốc đều reset rồi cộng delta =====
console.log("T1: fresh state");
let r: B3ApplyResult = accumulateB3ScrapedValue({}, 100, new Date("2026-03-10T04:00:00Z"));
check(
  "cả 5 thẻ = delta = 100",
  r.b3.daily === 100 &&
    r.b3.weekly === 100 &&
    r.b3.monthly === 100 &&
    r.b3.quarterly === 100 &&
    r.b3.yearly === 100,
  r.b3
);
check("delta = 100", r.delta === 100, r.delta);
check("last_raw_value = 100", r.b3.last_raw_value === 100, r.b3.last_raw_value);
check("last_updated được ghi", typeof r.b3.last_updated === "string", r.b3.last_updated);

// ===== T2: Cùng ngày — chỉ cộng delta, không reset gì =====
console.log("T2: cùng ngày (GMT+7)");
const s2 = {
  daily: 100,
  weekly: 500,
  monthly: 2000,
  quarterly: 5000,
  yearly: 20000,
  last_updated: "2026-03-10T02:00:00Z",
  last_raw_value: 100,
};
r = accumulateB3ScrapedValue(s2, 150, new Date("2026-03-10T05:00:00Z"));
check("daily = 150", r.b3.daily === 150, r.b3);
check("weekly = 550", r.b3.weekly === 550, r.b3);
check("monthly = 2050", r.b3.monthly === 2050, r.b3);
check("quarterly = 5050", r.b3.quarterly === 5050, r.b3);
check("yearly = 20050", r.b3.yearly === 20050, r.b3);
check("không reset mốc nào", Object.keys(r.reset).length === 0, r.reset);
check("last_raw_value = 150", r.b3.last_raw_value === 150, r.b3.last_raw_value);

// ===== T3: SANG NGÀY MỚI (cùng tuần) — CHỈ daily reset =====
console.log("T3: sang ngày mới, cùng tuần");
const s3 = {
  daily: 150,
  weekly: 550,
  monthly: 2050,
  quarterly: 5050,
  yearly: 20050,
  last_updated: "2026-03-10T05:00:00Z",
  last_raw_value: 150,
};
r = accumulateB3ScrapedValue(s3, 200, new Date("2026-03-11T05:00:00Z"));
check("daily = 0 + delta(50) = 50", r.b3.daily === 50, r.b3);
check("weekly GIỮ + delta = 600", r.b3.weekly === 600, r.b3);
check("monthly GIỮ + delta = 2100", r.b3.monthly === 2100, r.b3);
check("quarterly GIỮ + delta = 5100", r.b3.quarterly === 5100, r.b3);
check("yearly GIỮ + delta = 20100", r.b3.yearly === 20100, r.b3);
check(
  "CHỈ reset daily",
  r.reset.daily === true &&
    !r.reset.weekly &&
    !r.reset.monthly &&
    !r.reset.quarterly &&
    !r.reset.yearly,
  r.reset
);

// ===== T4: Web nguồn reset số (delta < 0) -> delta = total =====
console.log("T4: delta < 0 (nguồn reset số)");
const s4 = {
  daily: 500,
  weekly: 1000,
  monthly: 3000,
  quarterly: 9000,
  yearly: 40000,
  last_updated: "2026-03-11T06:00:00Z",
  last_raw_value: 500,
};
r = accumulateB3ScrapedValue(s4, 120, new Date("2026-03-11T07:00:00Z"));
check("delta = total = 120", r.delta === 120, r.delta);
check("daily = 500 + 120 = 620", r.b3.daily === 620, r.b3);
check("weekly = 1120", r.b3.weekly === 1120, r.b3);
check("last_raw_value = 120", r.b3.last_raw_value === 120, r.b3.last_raw_value);

// ===== T5: Sang tháng mới (cùng QUÝ, cùng TUẦN ISO) =====
console.log("T5: 31/01 -> 01/02 (cùng Q1, cùng tuần ISO T2..CN)");
const s5 = {
  daily: 100,
  weekly: 700,
  monthly: 3000,
  quarterly: 9000,
  yearly: 40000,
  last_updated: "2026-01-31T03:00:00Z",
  last_raw_value: 100,
};
r = accumulateB3ScrapedValue(s5, 130, new Date("2026-02-01T03:00:00Z"));
check("daily reset -> 30", r.b3.daily === 30, r.b3);
check("weekly GIỮ + 30 = 730 (cùng tuần ISO)", r.b3.weekly === 730, r.b3);
check("monthly reset -> 30", r.b3.monthly === 30, r.b3);
check("quarterly GIỮ + 30 = 9030", r.b3.quarterly === 9030, r.b3);
check("yearly GIỮ + 30 = 40030", r.b3.yearly === 40030, r.b3);
check(
  "reset = daily + monthly",
  r.reset.daily === true &&
    r.reset.monthly === true &&
    !r.reset.weekly &&
    !r.reset.quarterly &&
    !r.reset.yearly,
  r.reset
);

// ===== T6: Sang QUÝ mới (31/03 -> 01/04) — yearly giữ, cùng tuần ISO =====
console.log("T6: sang quý mới Q1 -> Q2");
const s6 = {
  daily: 300,
  weekly: 900,
  monthly: 2500,
  quarterly: 7777,
  yearly: 41000,
  last_updated: "2026-03-31T03:00:00Z",
  last_raw_value: 300,
};
r = accumulateB3ScrapedValue(s6, 50, new Date("2026-04-01T03:00:00Z"));
check("delta = 50 (50 - 300 < 0 -> total)", r.delta === 50, r.delta);
check("daily reset -> 50", r.b3.daily === 50, r.b3);
check("weekly GIỮ + 50 = 950 (cùng tuần ISO)", r.b3.weekly === 950, r.b3);
check("monthly reset -> 50", r.b3.monthly === 50, r.b3);
check("quarterly reset -> 50", r.b3.quarterly === 50, r.b3);
check("yearly GIỮ + 50 = 41050", r.b3.yearly === 41050, r.b3);
check(
  "reset = daily + monthly + quarterly (weekly giữ)",
  !r.reset.weekly &&
    r.reset.daily === true &&
    r.reset.monthly === true &&
    r.reset.quarterly === true &&
    !r.reset.yearly,
  r.reset
);

// ===== T6b: Sang TUẦN ISO mới (CN 29/03 -> T2 30/03) =====
console.log("T6b: sang tuần ISO mới");
const s6b = {
  daily: 200,
  weekly: 1200,
  monthly: 5000,
  quarterly: 15000,
  yearly: 45000,
  last_updated: "2026-03-29T03:00:00Z",
  last_raw_value: 200,
};
r = accumulateB3ScrapedValue(s6b, 260, new Date("2026-03-30T03:00:00Z"));
check("daily reset -> 60", r.b3.daily === 60, r.b3);
check("weekly reset -> 60", r.b3.weekly === 60, r.b3);
check("monthly GIỮ + 60 = 5060", r.b3.monthly === 5060, r.b3);
check("quarterly GIỮ + 60 = 15060", r.b3.quarterly === 15060, r.b3);
check("yearly GIỮ + 60 = 45060", r.b3.yearly === 45060, r.b3);
check(
  "reset = daily + weekly",
  r.reset.daily === true &&
    r.reset.weekly === true &&
    !r.reset.monthly &&
    !r.reset.quarterly &&
    !r.reset.yearly,
  r.reset
);

// ===== T7: RANH GIỚI GMT+7 (17:30Z = 00:30 VN hôm sau) =====
console.log("T7: ranh giới múi giờ GMT+7");
const s7 = {
  daily: 100,
  weekly: 400,
  monthly: 900,
  quarterly: 900,
  yearly: 900,
  last_updated: "2026-03-10T10:00:00Z", // 17:00 VN 10/03
  last_raw_value: 100,
};
r = accumulateB3ScrapedValue(s7, 10, new Date("2026-03-10T17:30:00Z"));
check("daily reset theo GMT+7 -> 10", r.b3.daily === 10, r.b3);
check("weekly GIỮ + 10 = 410", r.b3.weekly === 410, r.b3);
check("monthly GIỮ + 10 = 910", r.b3.monthly === 910, r.b3);

// ===== T8: Sang NĂM mới =====
console.log("T8: sang năm mới");
const s8 = {
  daily: 500,
  weekly: 1500,
  monthly: 6000,
  quarterly: 18000,
  yearly: 300000,
  last_updated: "2026-12-31T10:00:00Z",
  last_raw_value: 500,
};
r = accumulateB3ScrapedValue(s8, 600, new Date("2027-01-01T03:00:00Z"));
check("daily reset -> 100 (600-500)", r.b3.daily === 100, r.b3);
check("yearly reset -> 100", r.b3.yearly === 100, r.b3);
check("yearly reset flag", r.reset.yearly === true, r.reset);

// ===== T9: Dữ liệu legacy (chỉ có last_updated_date) =====
console.log("T9: legacy state -> suy ra last_raw_value = daily");
const legacy = normalizeB3({
  daily: 250,
  weekly: 800,
  monthly: 2500,
  quarterly: 7500,
  yearly: 30000,
  last_updated_date: "2026-03-10T02:00:00Z",
});
check("last_raw_value = daily cũ = 250", legacy.last_raw_value === 250, legacy);
r = accumulateB3ScrapedValue(legacy, 300, new Date("2026-03-10T06:00:00Z"));
check("delta = 50 (300 - 250)", r.delta === 50, r.delta);
check("daily = 300", r.b3.daily === 300, r.b3);
check("weekly = 850", r.b3.weekly === 850, r.b3);

// ===== T10: applyB3Revenue — daily = thuật toán mới; khác daily = gán thẳng =====
console.log("T10: applyB3Revenue");
r = applyB3Revenue(s2, "daily", 170, new Date("2026-03-10T06:00:00Z"));
check("daily dùng accumulate", r.accumulated === true && r.b3.daily === 170, r);
r = applyB3Revenue(s2, "weekly", 999, new Date("2026-03-10T06:00:00Z"));
check(
  "weekly gán thẳng, không đụng raw/updated",
  r.accumulated === false &&
    r.b3.weekly === 999 &&
    r.b3.last_raw_value === 100 &&
    r.b3.last_updated === s2.last_updated,
  r
);

// ===== T11: Cào lại nhiều lần trong ngày -> KHÔNG cộng đúp =====
console.log("T11: chống cộng đúp");
let st: B3State = accumulateB3ScrapedValue({}, 1000, new Date("2026-03-10T01:00:00Z")).b3;
for (let i = 0; i < 10; i++) {
  st = accumulateB3ScrapedValue(st, 1000, new Date("2026-03-10T02:00:00Z")).b3;
}
check("10 lần cào cùng số -> không đổi", st.daily === 1000 && st.weekly === 1000, st);

console.log(`\n==== KẾT QUẢ: ${passed} passed, ${failed} failed ====`);
process.exit(failed > 0 ? 1 : 0);

