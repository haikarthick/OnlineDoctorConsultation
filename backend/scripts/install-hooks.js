#!/usr/bin/env node
/**
 * Installs git hooks for VetCare:
 *   - pre-push:    runs schema + TypeScript + memory-check validation
 *   - post-commit: auto-logs every commit to memories/repo/auto-commit-log.md
 *
 * Run once: node backend/scripts/install-hooks.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const HOOKS_DIR = path.join(ROOT, '.git', 'hooks');

// ── pre-push hook ────────────────────────────────────────────────────────────
const PRE_PUSH_FILE = path.join(HOOKS_DIR, 'pre-push');
const PRE_PUSH_CONTENT = `#!/bin/sh
# VetCare pre-push hook — runs schema + TypeScript + memory-check validation
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

// ── post-commit hook ─────────────────────────────────────────────────────────
const POST_COMMIT_FILE = path.join(HOOKS_DIR, 'post-commit');
const POST_COMMIT_CONTENT = `#!/bin/sh
# VetCare post-commit hook — auto-logs commit to memories/repo/auto-commit-log.md
# Installed by: node backend/scripts/install-hooks.js

node "$(git rev-parse --show-toplevel)/backend/scripts/post-commit-logger.js"
`;

function installHook(file, content, name) {
  try {
    if (!fs.existsSync(HOOKS_DIR)) fs.mkdirSync(HOOKS_DIR, { recursive: true });
    fs.writeFileSync(file, content, { mode: 0o755 });
    console.log(`\x1b[32m✓ Git ${name} hook installed\x1b[0m`);
    console.log(`  Location: ${file}`);
  } catch (err) {
    console.error(`\x1b[31m✗ Failed to install ${name} hook:\x1b[0m`, err.message);
    process.exit(1);
  }
}

installHook(PRE_PUSH_FILE, PRE_PUSH_CONTENT, 'pre-push');
installHook(POST_COMMIT_FILE, POST_COMMIT_CONTENT, 'post-commit');

console.log('\n\x1b[36mHooks active:\x1b[0m');
console.log('  pre-push:    TypeScript + schema + memory-check → blocks bad pushes');
console.log('  post-commit: auto-logs every commit → memories/repo/auto-commit-log.md');
console.log('\n\x1b[2mTo manually log memory:\x1b[0m');
console.log('  node backend/scripts/log-memory.js bug   "ID" "Title" "Symptom" "Cause" "Fix" "Rule"');
console.log('  node backend/scripts/log-memory.js lesson "ID" "Title" "Context" "Lesson" "Apply-to"');
console.log('  node backend/scripts/log-memory.js feature "Name" "done|planned|dropped" "Description"');
console.log('  node backend/scripts/log-memory.js research "Topic" "Finding" "Context"');

