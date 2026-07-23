// Fails the build if any emitted JS chunk exceeds a size budget. Catches
// bundle-bloat regressions (e.g. a large dependency or dataset accidentally
// landing in the eager entry chunk) in CI instead of only at code-review time.
//
// Budgets are raw (pre-gzip) bytes, matching what Vite/Rollup reports.
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'dist', 'assets');

// The entry chunk (index-*.js) loads on every single page view, so it gets
// the tightest budget. Everything else is route-level or vendor code that
// only loads when actually needed — 700KB raw is generous headroom over the
// current largest (vendor-react at ~163KB) while still catching real bloat.
const ENTRY_CHUNK_BUDGET = 600 * 1024;
const OTHER_CHUNK_BUDGET = 700 * 1024;

if (!fs.existsSync(ASSETS_DIR)) {
  console.error(`[bundle-budget] ${ASSETS_DIR} not found — run "npm run build" first.`);
  process.exit(1);
}

const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));
let failed = false;

for (const file of files) {
  const size = fs.statSync(path.join(ASSETS_DIR, file)).size;
  const isEntry = /^index-/.test(file);
  const budget = isEntry ? ENTRY_CHUNK_BUDGET : OTHER_CHUNK_BUDGET;
  if (size > budget) {
    failed = true;
    console.error(
      `[bundle-budget] ${file} is ${(size / 1024).toFixed(1)}KB, exceeding the ${(budget / 1024).toFixed(0)}KB budget` +
      (isEntry ? ' (entry chunk — loads on every page view)' : '')
    );
  }
}

if (failed) {
  console.error('[bundle-budget] FAILED — see above. Run "ANALYZE=true npm run build" to inspect what changed.');
  process.exit(1);
}

console.log(`[bundle-budget] OK — ${files.length} chunk(s) checked, all within budget.`);
