#!/usr/bin/env node
/**
 * Pre-Deployment Validation
 * ─────────────────────────
 * Runs ALL checks before deploying to catch issues early:
 *   1. Backend production build
 *   2. Frontend production build (+ bundle budget)
 *   3. Schema validation (column mismatches, static)
 *   4. E2E route coverage
 *   5. Runtime verification - real Postgres, real migrations, real server, real HTTP
 *
 * Checks 1-4 are STATIC. They have never executed a line of SQL. Check 5 exists because that
 * gap let a completely broken feature through with every other check green.
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

function runCheck(name, command, cwd, timeout = 120000, envOverride = null) {
  process.stdout.write(`  ${name} ... `);
  try {
    const env = envOverride ? { ...process.env, ...envOverride } : process.env;
    // windowsHide: these checks shell out to tsc/vitest/vite dozens of times on every push.
    // Without it each one flashes a console window the developer cannot use or dismiss.
    execSync(command, { cwd, stdio: 'pipe', timeout, env, windowsHide: true });
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

// Mirror render-build.sh EXACTLY: it forces NODE_ENV=production for both build commands (a
// deployed app is always a production build, even though the dev SERVICE runs NODE_ENV=development
// at runtime). Building here with the same forced env guarantees the gate produces the same bundle
// Render will - otherwise a dev-ambient env on the build host inflates the entry chunk ~147KB past
// the 600KB bundle-budget and the gate would disagree with the deploy. See [[feedback-deploy-safety]].
const PROD_BUILD = { NODE_ENV: 'production' };

// 1. Backend PRODUCTION BUILD - run exactly what Render's render-build.sh runs (`npm run build`
//    = real `tsc` emit), not just `tsc --noEmit`. Catches any build-time failure before push so
//    it can never reach Render. (Emits to backend/dist; harmless locally.)
runCheck('Backend Build (npm run build)', 'npm run build', BACKEND, 300000, PROD_BUILD);

// 2. Frontend PRODUCTION BUILD - the real Vite build + bundle-budget postbuild that Render runs.
//    `tsc --noEmit` alone (the old check) never bundled, so a Vite/Rollup failure or a bundle-budget
//    breach could pass the gate and then fail the Render deploy. This closes that gap.
runCheck('Frontend Build (npm run build)', 'npm run build', FRONTEND, 300000, PROD_BUILD);

// 3. Schema validation
runCheck('Schema Validation', 'node scripts/schema-check.js', BACKEND);

// 4. E2E route coverage (ensure all routes have tests)
runCheck('E2E Route Coverage', 'node e2e/generate-tests.cjs', FRONTEND);

// 4b. CSS scoping - a page stylesheet applies to the WHOLE app (no CSS modules here), so an
//     unscoped `.form-group input {}` in one page silently restyles every other screen. That is
//     what collapsed the Create-Enterprise "Total Area" input to 28px. Allowlisted violations
//     may only SHRINK; a NEW one fails the push. See docs/DESIGN_SYSTEM.md section 2b.
runCheck('CSS Scoping (page styles stay in their page)', 'node scripts/check-css-scoping.cjs', FRONTEND);

// 5. RUNTIME verification - the only check that actually executes SQL and boots the server.
//    Checks 1-4 are all static: they prove code compiles, links and bundles. They cannot see a
//    constraint violation, a migration that fails on a real DB, or startup code that silently
//    reverts a migration. That blind spot shipped the groomer-registration bug (2026-07-27) -
//    tsc, vitest and the production build were ALL green while the feature was broken for every
//    user. Slow (~2-3 min) and worth every second. See backend/scripts/runtime-verify.js.
runCheck('Runtime Verification (real DB + real server)', 'node scripts/runtime-verify.js', BACKEND, 900000);

// 5. Memory staleness check - warn if code changed but memory wasn't updated
// (non-blocking: only prints warning, doesn't fail the push)
(function checkMemoryStaleness() {
  const { execSync: exec } = require('child_process');
  try {
    // Get commits being pushed (unpushed commits)
    const log = exec('git log @{u}..HEAD --name-only --pretty=format:__COMMIT__',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', windowsHide: true }).trim();
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
      console.log(`${DIM}  (This is a warning only - push is not blocked)${DIM}${RESET}\n`);
    } else if (memoryFiles.length > 0) {
      console.log(`  Memory Check ... ${GREEN}✓${RESET} (${memoryFiles.length} memory file(s) updated)`);
    }
  } catch {
    // No upstream branch yet - skip check
  }
})();

// Summary
console.log('');
if (failed === 0) {
  console.log(`${GREEN}━━━ ALL ${passed} CHECKS PASSED - Safe to deploy ━━━${RESET}\n`);
} else {
  console.log(`${RED}━━━ ${failed} CHECK(S) FAILED ━━━${RESET}`);
  for (const f of failures) {
    console.log(`  ${RED}✗${RESET} ${f}`);
  }
  console.log(`\n${YELLOW}Fix all errors before pushing to develop/main.${RESET}\n`);
  process.exit(1);
}
