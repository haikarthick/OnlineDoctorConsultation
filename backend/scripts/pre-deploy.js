#!/usr/bin/env node
/**
 * Pre-Deployment Validation
 * ─────────────────────────
 * Runs ALL checks before deploying to catch issues early:
 *   1. Backend TypeScript compilation
 *   2. Frontend TypeScript compilation
 *   3. Schema validation (column mismatches)
 *
 * Run: npm run pre-deploy  (from backend/)
 *   or: node backend/scripts/pre-deploy.js (from root)
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;
const failures = [];

function runCheck(name, command, cwd) {
  process.stdout.write(`  ${name} ... `);
  try {
    execSync(command, { cwd, stdio: 'pipe', timeout: 120000 });
    console.log(`${GREEN}✓${RESET}`);
    passed++;
  } catch (err) {
    console.log(`${RED}✗${RESET}`);
    const output = (err.stdout || '').toString().trim() + '\n' + (err.stderr || '').toString().trim();
    // Show first 20 lines of error output
    const lines = output.split('\n').filter(l => l.trim()).slice(0, 20);
    if (lines.length > 0) {
      for (const line of lines) {
        console.log(`    ${DIM}${line}${RESET}`);
      }
    }
    failures.push(name);
    failed++;
  }
}

console.log(`\n${CYAN}━━━ VetCare Pre-Deployment Checks ━━━${RESET}\n`);

// 1. Backend TypeScript
runCheck('Backend TypeScript', 'npx tsc --noEmit', BACKEND);

// 2. Frontend TypeScript
runCheck('Frontend TypeScript', 'npx tsc --noEmit', FRONTEND);

// 3. Schema validation
runCheck('Schema Validation', 'node scripts/schema-check.js', BACKEND);

// 4. E2E route coverage (ensure all routes have tests)
runCheck('E2E Route Coverage', 'node e2e/generate-tests.cjs', FRONTEND);

// Summary
console.log('');
if (failed === 0) {
  console.log(`${GREEN}━━━ ALL ${passed} CHECKS PASSED — Safe to deploy ━━━${RESET}\n`);
} else {
  console.log(`${RED}━━━ ${failed} CHECK(S) FAILED ━━━${RESET}`);
  for (const f of failures) {
    console.log(`  ${RED}✗${RESET} ${f}`);
  }
  console.log(`\n${YELLOW}Fix all errors before pushing to develop/main.${RESET}\n`);
  process.exit(1);
}
