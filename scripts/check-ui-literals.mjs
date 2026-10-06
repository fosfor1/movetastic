// UI literal guard: fails when a hardcoded color, palette class or arbitrary size reappears in a view
// that has been moved onto the design tokens (src/styles/global.css) and components (src/components/ui/).
// Checks its own explicit file list and ignores argv, so lint-staged's appended paths change nothing.
// Add a view to FILES once it is cleaned. Zero dependencies on purpose. Run: node scripts/check-ui-literals.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "src/pages/dashboard.astro",
  "src/components/dashboard/DashboardView.astro",
  "src/pages/dev/kitchen-sink/dashboard.astro",
];

// Same pattern as the /10x-ui audit: hex/rgb/hsl/oklch literals, arbitrary px/rem values, Tailwind palette classes.
const LITERAL =
  /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b/g;

let hits = 0;
let missing = 0;

for (const file of FILES) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) {
    console.error(`${file}: missing (renamed or deleted? update FILES in scripts/check-ui-literals.mjs)`);
    missing++;
    continue;
  }
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const match of line.matchAll(LITERAL)) {
      console.error(`${file}:${i + 1}: ${match[0]}`);
      hits++;
    }
  });
}

if (hits > 0 || missing > 0) {
  console.error(
    `lint:ui failed: ${hits} hardcoded literal(s), ${missing} missing file(s). Use role tokens from src/styles/global.css.`,
  );
  process.exit(1);
}

console.log(`lint:ui OK: ${FILES.length} file(s) free of hardcoded UI literals.`);
