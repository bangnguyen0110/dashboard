import { existsSync, readdirSync } from "node:fs";
const candidates = [
  "c:/Users/LAPTOP cua Bang/Downloads/dashboard/assets",
  "c:/Users/LAPTOP cua Bang/Downloads/dashboard",
];
for (const c of candidates) {
  try {
    console.log("DIR:", c, "->", readdirSync(c).filter((n) => /roboto|font|ttf/i.test(n)).join(", ") || "(không có file font)");
  } catch (e) { console.log(c, "ERR", e.message); }
}