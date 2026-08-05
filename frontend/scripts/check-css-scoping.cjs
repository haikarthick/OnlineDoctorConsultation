#!/usr/bin/env node
/**
 * Fails when a page/component stylesheet styles a class name it does not own.
 *
 * There are no CSS modules here: every `import './X.css'` lands in one global stylesheet for
 * the session. A selector in a page's CSS therefore applies to EVERY page from the moment that
 * page is first visited. Auth.css did exactly that with `.form-group input { width: 100% }`,
 * which silently governed form controls across the whole product and collapsed the "Total Area"
 * input on the Create Enterprise screen to 28px. See docs/DESIGN_SYSTEM.md section 2b.
 *
 * Rule: a stylesheet may style bare elements and generic shared class names ONLY inside a
 * selector rooted at a class it owns - ideally `:where(.its-own-root)`, which scopes without
 * changing specificity.
 *
 * Run: node scripts/check-css-scoping.cjs   (from frontend/)
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');

// Stylesheets that legitimately define the shared vocabulary.
const GLOBAL_SHEETS = new Set(['modules.css', 'index.css', 'App.css', 'extracted-inline-styles.css']);

/**
 * The shared vocabulary is DERIVED from modules.css rather than hand-listed, so the rule cannot
 * silently miss a class simply because nobody thought to add it. If the design system defines a
 * name, a page stylesheet must not redefine it unscoped - that is the whole rule.
 * The curated list below is kept as a floor for names that are conventional but not (yet) in
 * modules.css.
 */
function designSystemClasses() {
  const found = new Set();
  try {
    const css = fs.readFileSync(path.join(SRC, 'styles', 'modules.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)) found.add(m[1]);
  } catch { /* fall back to the curated floor below */ }
  return found;
}

// Generic names owned by the design system. A page stylesheet must not target these unscoped.
const SHARED_CLASSES = new Set([
  'form-group', 'form-row', 'form-grid', 'form-actions', 'form-label', 'form-input',
  'btn', 'btn-primary', 'btn-secondary', 'btn-danger', 'btn-success', 'btn-warning',
  'btn-outline', 'btn-sm', 'btn-lg', 'btn-icon', 'btn-loading',
  'card', 'card-header', 'card-body', 'modal', 'modal-content', 'modal-header',
  'modal-body', 'modal-footer', 'modal-overlay', 'badge', 'message', 'alert',
  'spinner', 'loading-container', 'empty-state', 'data-table', 'stat-card',
  'subtitle', 'feature', 'features-list', 'link-btn', 'tabs', 'tab-button',
]);
for (const c of designSystemClasses()) SHARED_CLASSES.add(c);

const BARE_ELEMENTS = /^(input|select|textarea|button|table|th|td|tr|ul|ol|li|a|h[1-6]|p|form|label|img|section|div|span)$/;

// Selectors that are already scoped are fine. A selector is scoped when ANY compound before the
// offending one is a non-shared class (including :where(...)).
function isScoped(selector, offendingIndex, compounds) {
  for (let i = 0; i < offendingIndex; i++) {
    const c = compounds[i];
    if (/^:where\(/.test(c)) return true;
    const cls = c.match(/^\.([A-Za-z0-9_-]+)/);
    if (cls && !SHARED_CLASSES.has(cls[1])) return true;
  }
  return false;
}

const violations = [];

function checkFile(file) {
  const name = path.basename(file);
  if (GLOBAL_SHEETS.has(name)) return;

  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Selector lists: text before '{' that is not an at-rule prelude or a declaration.
  for (const m of css.matchAll(/(^|\}|\{)\s*([^{}@;]+?)\s*\{/g)) {
    const list = m[2];
    if (!list || /:\s*$/.test(list)) continue;
    for (const raw of list.split(',')) {
      const sel = raw.trim();
      if (!sel || /^\d/.test(sel) || /^(from|to)$/.test(sel)) continue;

      const compounds = sel.split(/\s+|\s*>\s*|\s*\+\s*|\s*~\s*/).filter(Boolean);
      for (let i = 0; i < compounds.length; i++) {
        const c = compounds[i];
        const base = c.split(/[:.\[]/)[0];
        const firstClass = c.match(/^\.([A-Za-z0-9_-]+)/);

        const isBare = BARE_ELEMENTS.test(base) && !c.startsWith('.');
        const isShared = firstClass && SHARED_CLASSES.has(firstClass[1]);
        if (!isBare && !isShared) continue;
        if (isScoped(sel, i, compounds)) break;

        violations.push({
          file: path.relative(SRC, file).replace(/\\/g, '/'),
          selector: sel,
          reason: isBare ? `bare element "${base}"` : `shared class ".${firstClass[1]}"`,
        });
        break;
      }
    }
  }
}

(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith('.css')) checkFile(p);
  }
})(SRC);

const ALLOWLIST_FILE = path.join(__dirname, 'css-scoping-allowlist.json');
const allowlist = fs.existsSync(ALLOWLIST_FILE)
  ? new Set(JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8')))
  : new Set();

const fresh = violations.filter(v => !allowlist.has(`${v.file} :: ${v.selector}`));

if (process.argv.includes('--write-allowlist')) {
  const entries = [...new Set(violations.map(v => `${v.file} :: ${v.selector}`))].sort();
  fs.writeFileSync(ALLOWLIST_FILE, JSON.stringify(entries, null, 2) + '\n');
  console.log(`[css-scoping] wrote allowlist with ${entries.length} pre-existing entries`);
  process.exit(0);
}

if (fresh.length === 0) {
  console.log(`[css-scoping] OK - no unscoped shared selectors outside the global sheets` +
              (allowlist.size ? ` (${allowlist.size} pre-existing, allowlist must only SHRINK)` : ''));
  process.exit(0);
}

console.error(`\n[css-scoping] ${fresh.length} unscoped selector(s). A page stylesheet applies to`);
console.error(`the WHOLE app - scope these to a class the file owns, ideally :where(.page-root).`);
console.error(`See docs/DESIGN_SYSTEM.md section 2b.\n`);
for (const v of fresh) console.error(`  ${v.file}\n      ${v.selector}      <- ${v.reason}`);
console.error('');
process.exit(1);
