#!/usr/bin/env node
/**
 * Post-deploy smoke test: drives the DEPLOYED app (not a fresh local database) through real
 * WRITE paths. This is the check that would have caught "column state of relation
 * marketplace_listings does not exist" before a farmer did: every static check and the local
 * runtime check run against a database built from scratch, and only the deployed database can
 * be behind.
 *
 *   node scripts/post-deploy-smoke.js https://vetcare-dev.onrender.com
 *
 * Exit 1 = a deployed write path is broken (fail the pipeline). Exit 0 with a warning = could not
 * sign in with the seeded demo user (e.g. a demo environment with changed passwords).
 */
const base = (process.argv[2] || process.env.SMOKE_URL || '').replace(/\/$/, '');
if (!base) { console.error('usage: post-deploy-smoke.js <base-url>'); process.exit(2); }
const api = `${base}/api/v1`;
const TECH = /column "|relation "|violates .* constraint|duplicate key|syntax error|ECONN|status code \d{3}|Cannot read propert|Internal Server Error/i;

async function call(method, url, body, token) {
  const r = await fetch(url, {
    method, signal: AbortSignal.timeout(45000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status, json };
}

(async () => {
  const problems = [];
  let health;
  for (let i = 0; i < 12; i++) {
    try { health = await call('GET', `${api}/health`); if (health.json?.checks?.schemaContract) break; } catch { /* waking up */ }
    await new Promise(r => setTimeout(r, 15000));
  }
  const checks = health?.json?.checks || {};
  console.log('health:', health?.status, JSON.stringify(checks));
  if (checks.schemaContract === 'drift') problems.push(`database is missing what the migrations promise: ${JSON.stringify(checks.schemaMissing)}`);
  if (!checks.schemaContract) console.warn('WARN: deployed build does not report schemaContract yet (old build still serving)');

  const login = await call('POST', `${api}/auth/login`, { email: 'tom.wilson@example.com', password: 'Demo@123' });
  const token = login.json?.data?.token;
  if (!token) { console.warn(`WARN: seeded demo sign-in unavailable (HTTP ${login.status}) - write-path smoke skipped`); finish(problems); return; }

  // Write path 1: publish a marketplace listing with every structured place field.
  const created = await call('POST', `${api}/marketplace/listings`, {
    title: `Smoke test ${Date.now()}`, description: 'post-deploy smoke test - deleted right away', category: 'feed',
    listingType: 'fixed_price', price: 1, quantity: 1, unit: 'kg', contactPhone: '9876543210',
    state: 'Kerala', district: 'Thrissur', pincode: '680001', latitude: 10.52, longitude: 76.21,
  }, token);
  const id = created.json?.data?.id || created.json?.data?.listing?.id;
  if (created.status >= 300 || !id) {
    problems.push(`publish listing failed: HTTP ${created.status} ${JSON.stringify(created.json || {}).slice(0, 300)}`);
  } else {
    const del = await call('DELETE', `${api}/marketplace/listings/${id}`, null, token);
    if (del.status >= 300) problems.push(`cleanup of the smoke listing failed: HTTP ${del.status}`);
  }
  if (TECH.test(JSON.stringify(created.json || {}))) problems.push('technical text reached the client in the publish response');
  finish(problems);
})().catch(e => { console.error('smoke crashed:', e.message); process.exit(1); });

function finish(problems) {
  if (problems.length) { console.error('SMOKE FAILED:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log('Post-deploy smoke OK');
}
