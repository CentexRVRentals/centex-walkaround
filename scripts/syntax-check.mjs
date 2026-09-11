// esbuild parse of every source file. Fast first gate; ESLint follows for undefined identifiers.
import { transform } from "esbuild";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src", "tests", "scripts"];
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(f)) files.push(p); } };
roots.forEach(walk);
let failed = 0;
for (const f of files) {
  try { await transform(readFileSync(f, "utf8"), { loader: f.endsWith("x") ? "jsx" : "js", sourcefile: f }); }
  catch (e) { failed++; console.error(`✗ ${f}\n  ${e.errors ? e.errors.map((x) => `${x.text} (line ${x.location && x.location.line})`).join("\n  ") : e.message}`); }
}
console.log(failed ? `${failed} of ${files.length} files failed to parse` : `✓ ${files.length} files parse`);
process.exit(failed ? 1 : 0);
