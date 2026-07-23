// Copies non-English locale files into public/locales so i18next-http-backend
// can fetch them lazily at runtime instead of them being statically bundled
// into the main JS chunk. src/locales remains the single source of truth —
// this script keeps public/locales in sync with it. English stays statically
// imported in src/i18n/index.ts (small + it's the fallback language, so it
// must be available with zero network round-trip).
const fs = require('fs');
const path = require('path');

const LANGS = ['hi', 'ta', 'te', 'kn', 'ml'];
const srcDir = path.join(__dirname, '..', 'src', 'locales');
const destDir = path.join(__dirname, '..', 'public', 'locales');

for (const lang of LANGS) {
  const from = path.join(srcDir, lang, 'translation.json');
  const toDir = path.join(destDir, lang);
  const to = path.join(toDir, 'translation.json');
  fs.mkdirSync(toDir, { recursive: true });
  fs.copyFileSync(from, to);
}

console.log(`[copy-locales] Synced ${LANGS.length} locale(s) to public/locales/`);
