#!/usr/bin/env node
/**
 * Installs a git pre-push hook that runs pre-deploy validation
 * automatically before every `git push`.
 *
 * Run once: node backend/scripts/install-hooks.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const HOOKS_DIR = path.join(ROOT, '.git', 'hooks');
const HOOK_FILE = path.join(HOOKS_DIR, 'pre-push');

const HOOK_CONTENT = `#!/bin/sh
# VetCare pre-push hook — runs schema + TypeScript validation
# Installed by: node backend/scripts/install-hooks.js

echo ""
echo "\\033[36m━━━ Running pre-push validation ━━━\\033[0m"
echo ""

cd "$(git rev-parse --show-toplevel)/backend"
node scripts/pre-deploy.js

if [ $? -ne 0 ]; then
  echo ""
  echo "\\033[31m✗ Push blocked — fix the errors above before pushing.\\033[0m"
  echo ""
  exit 1
fi
`;

try {
  if (!fs.existsSync(HOOKS_DIR)) {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
  }

  fs.writeFileSync(HOOK_FILE, HOOK_CONTENT, { mode: 0o755 });
  console.log('\x1b[32m✓ Git pre-push hook installed\x1b[0m');
  console.log(`  Location: ${HOOK_FILE}`);
  console.log('  Pre-deploy checks will now run automatically before every git push.');
} catch (err) {
  console.error('\x1b[31m✗ Failed to install hook:\x1b[0m', err.message);
  process.exit(1);
}
