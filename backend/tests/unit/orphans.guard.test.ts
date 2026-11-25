/**
 * H17 - no route without a screen (orphan guard).
 *
 * Every backend route in `src/routes/*.routes.ts` must be named by some frontend call (a quoted path in `frontend/src`).
 * A route nobody calls is either dead code (delete it whole) or a feature without a screen (build the screen).
 * `orphans.allowlist.json` is the register of routes known to have no caller today. It may only SHRINK:
 *  - a new route with no caller fails this test;
 *  - an allowlisted route that now has a caller (or no longer exists) fails too, so the entry must be deleted, never left to rot.
 * Server-to-server, webhook and token-only routes are listed in `NOT_CALLED_BY_THE_APP` with the reason.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const ROUTES_DIR = path.join(ROOT, 'backend/src/routes');
const FRONT_DIR = path.join(ROOT, 'frontend/src');
const ALLOWLIST = path.join(__dirname, 'orphans.allowlist.json');

/** Routes called by something other than our own screens. Each needs a reason. */
const NOT_CALLED_BY_THE_APP: Array<{ test: RegExp; why: string }> = [
  { test: /\/webhooks?\b/, why: 'payment gateway / provider webhooks call the server, not a screen' },
  { test: /^\/health|^\/ready|^\/live/, why: 'platform health probes' },
];

function walk(dir: string, accept: (f: string) => boolean, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'locales') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, accept, out);
    else if (accept(p)) out.push(p);
  }
  return out;
}

function backendRoutes(): string[] {
  const out = new Set<string>();
  const re = /\brouter\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g;
  for (const f of fs.readdirSync(ROUTES_DIR).filter(n => n.endsWith('.routes.ts'))) {
    const src = fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) out.add(`${m[1].toUpperCase()} ${m[3]}`);
  }
  return [...out].sort();
}

function frontendPaths(): string[] {
  const files = walk(FRONT_DIR, f => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
  const out = new Set<string>();
  const re = /(['"`])(\/[^'"`\n]*)\1/g;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      out.add(m[2].replace(/\$\{[^}]*\}/g, 'X').split('?')[0]);
    }
  }
  return [...out];
}

function toRegex(route: string): RegExp {
  const pattern = route.split('/').map(seg => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/');
  return new RegExp(`^${pattern}$`);
}

function findOrphans(): string[] {
  const paths = frontendPaths();
  const orphans: string[] = [];
  for (const entry of backendRoutes()) {
    const route = entry.slice(entry.indexOf(' ') + 1);
    if (NOT_CALLED_BY_THE_APP.some(r => r.test.test(route))) continue;
    const re = toRegex(route);
    // A client path may carry a trailing variable ("/x/" + id) or a prefix; match on the whole path or on its literal head.
    const called = paths.some(p => re.test(p) || re.test(p.replace(/\/X$/, '')) || (p.endsWith('/') && re.test(p + 'X')));
    if (!called) orphans.push(entry);
  }
  return orphans.sort();
}

describe('orphan guard (H17): every route has a screen that calls it', () => {
  const allow: string[] = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8')).routes;
  const orphans = findOrphans();

  it('finds routes to check', () => {
    expect(backendRoutes().length).toBeGreaterThan(300);
    expect(frontendPaths().length).toBeGreaterThan(300);
  });

  it('no new route ships without a screen that calls it', () => {
    const added = orphans.filter(o => !allow.includes(o));
    expect(added).toEqual([]);
  });

  it('the allowlist only shrinks: remove an entry once its route has a caller or is deleted', () => {
    const stale = allow.filter(a => !orphans.includes(a));
    expect(stale).toEqual([]);
  });
});

if (process.env.WRITE_ORPHAN_ALLOWLIST === '1') {
  fs.writeFileSync(ALLOWLIST, JSON.stringify({ note: 'Routes with no frontend caller. May only shrink (H17). See docs/modules/orphans-ledger.md.', routes: findOrphans() }, null, 2) + '\n');
}
