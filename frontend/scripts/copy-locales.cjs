// Merges each locale's per-module files (src/locales/<lang>/modules/*.json) into the
// single public/locales/<lang>/translation.json that i18next-http-backend fetches lazily
// at runtime. src/locales/<lang>/modules/ is the real source of truth now - it's split by
// module (grooming.json, pharmacy.json, ...) instead of one ~8,400-line file per locale,
// because a single huge JSON file was unmanageable to edit and one stray comma anywhere
// in it broke every feature's translations for that whole language. This script (and the
// mirrored merge in src/i18n/index.ts for English) is what keeps the RUNTIME shape exactly
// the same as before the split - no t() call site or component changed.
// English stays statically bundled (see src/i18n/index.ts) - it's the fallback language,
// so it must be available with zero network round-trip.
const fs = require('fs');
const path = require('path');

const LANGS = ['hi', 'ta', 'te', 'kn', 'ml'];
const srcDir = path.join(__dirname, '..', 'src', 'locales');
const destDir = path.join(__dirname, '..', 'public', 'locales');

for (const lang of LANGS) {
  const modulesDir = path.join(srcDir, lang, 'modules');
  const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.json')).sort();

  const merged = {};
  for (const file of files) {
    const mod = JSON.parse(fs.readFileSync(path.join(modulesDir, file), 'utf8'));
    for (const key of Object.keys(mod)) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) {
        throw new Error(`[copy-locales] Duplicate top-level key "${key}" in ${lang}/modules/${file} - already defined by another module file. Fix before building.`);
      }
      merged[key] = mod[key];
    }
  }

  const toDir = path.join(destDir, lang);
  fs.mkdirSync(toDir, { recursive: true });
  fs.writeFileSync(path.join(toDir, 'translation.json'), JSON.stringify(merged), 'utf8');
}

console.log(`[copy-locales] Merged modules/ and synced ${LANGS.length} locale(s) to public/locales/`);
