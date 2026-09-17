import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = [
  "c:/Users/LAPTOP cua Bang/Downloads/dashboard/public",
  "c:/Users/LAPTOP cua Bang/Downloads/dashboard/assets",
  "c:/Users/LAPTOP cua Bang/Downloads/dashboard/lib",
  "c:/Users/LAPTOP cua Bang/Downloads/dashboard/node_modules/lucide-react",
  "c:/Users/LAPTOP cua Bang/Downloads/dashboard/node_modules/@fontsource",
  "c:/Users/LAPTOP cua Bang/Downloads/dashboard/node_modules/roboto-fontface",
];

function walk(dir, depth = 0, out = []) {
  if (depth > 4 || !existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === ".next" || name === "node_modules" && depth > 0) continue;
    const p = join(dir, name);
    try {
      const st = statSync(p);
      if (st.isDirectory()) walk(p, depth + 1, out);
      else if (/\.(ttf|otf)$/i.test(name)) out.push(p);
    } catch {}
  }
  return out;
}

for (const root of roots) {
  const found = walk(root);
  if (found.length) {
    console.log("ROOT:", root);
    found.slice(0, 15).forEach((f) => console.log("  ", f));
  }
}