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

// 5. Memory staleness check — warn if code changed but memory wasn't updated
// (non-blocking: only prints warning, doesn't fail the push)
(function checkMemoryStaleness() {
  const { execSync: exec } = require('child_process');
  try {
    // Get commits being pushed (unpushed commits)
    const log = exec('git log @{u}..HEAD --name-only --pretty=format:__COMMIT__', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
    if (!log) return; // nothing to check

    const files = log.split('\n').filter(l => l && l !== '__COMMIT__');
    const codeFiles = files.filter(f =>
      (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.sql') || f.endsWith('.sh')) &&
      !f.startsWith('memories/')
    );
    const memoryFiles = files.filter(f => f.startsWith('memories/'));

    if (codeFiles.length > 0 && memoryFiles.length === 0) {
      console.log(`${YELLOW}⚠ Memory Check: ${codeFiles.length} code file(s) changed but no memory files updated.${RESET}`);
      console.log(`${YELLOW}  Consider running: node backend/scripts/log-memory.js bug|lesson|feature ...${RESET}`);
      console.log(`${DIM}  (This is a warning only — push is not blocked)${DIM}${RESET}\n`);
    } else if (memoryFiles.length > 0) {
      console.log(`  Memory Check ... ${GREEN}✓${RESET} (${memoryFiles.length} memory file(s) updated)`);
    }
  } catch {
    // No upstream branch yet — skip check
  }
})();

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
