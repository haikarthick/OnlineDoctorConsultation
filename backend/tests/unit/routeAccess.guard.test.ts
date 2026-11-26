import * as fs from 'fs';
import * as path from 'path';

/**
 * HARNESS RULE H15 - no one reaches another person's data (owner rule 2026-11-22).
 *
 * Every route that takes an ANIMAL id (in the path, query or body) or addresses an animal's RECORD by its own id
 * must name its access gate on the route itself:
 *   requireAnimal(...)          - the platform rule (AnimalAccessService) for an animal id
 *   requireRecordAccess(...)    - the record's own animal/group decides, never the request body
 *   roleMiddleware(['admin'])   - admin-only
 * A route whose gate lives in its service instead (e.g. the nutrition module's NutritionAccess) is listed in
 * route-access-allowlist.json WITH the reason. That list may only SHRINK: a new route goes through a gate above.
 *
 * Why a static guard: `requireAnimalAccess` alone looked like a gate but only protected hospital-private animals,
 * and ~25 routes leaked or allowed edits to other people's animals for months while every test stayed green.
 * runtime-verify PHASE 6f probes the same endpoints as a stranger against a real server.
 */
const ROUTES = path.join(__dirname, '..', '..', 'src', 'routes');
const ALLOWLIST = path.join(__dirname, 'route-access-allowlist.json');

const RECORD_PATH = /^\/(medical-records|vaccinations|allergies|lab-results|weight-history|vaccine-schedule)\/:\w+/;
const GATES = /requireAnimal\(|requireRecordAccess\(|roleMiddleware\(\[\s*'admin'\s*\]\)/;

interface RouteDef { file: string; method: string; path: string; key: string; block: string }

function routes(): RouteDef[] {
  const out: RouteDef[] = [];
  for (const file of fs.readdirSync(ROUTES).filter(f => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(ROUTES, file), 'utf8');
    const re = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
    const starts: Array<{ i: number; method: string; p: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) starts.push({ i: m.index, method: m[1].toUpperCase(), p: m[2] });
    starts.forEach((s, k) => {
      const block = src.slice(s.i, k + 1 < starts.length ? starts[k + 1].i : src.length);
      out.push({ file, method: s.method, path: s.p, key: `${s.method} ${s.p}`, block });
    });
  }
  return out;
}

const takesAnimal = (r: RouteDef) =>
  /:animalId\b/.test(r.path) || /^\/animals\/:id\b/.test(r.path)
  || /req\.(body|query)(\??)\.animalId|\{[^}]*\banimalId\b[^}]*\}\s*=\s*req\.(body|query)|(body|query):animalId/.test(r.block);

describe('H15 - every route that reaches an animal names its access gate', () => {
  const allow: Record<string, string> = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  const all = routes();
  const relevant = all.filter(r => takesAnimal(r) || RECORD_PATH.test(r.path));

  it('finds the routes it guards (the scanner itself works)', () => {
    expect(relevant.length).toBeGreaterThan(30);
    expect(relevant.some(r => r.key === 'POST /allergies/:id/mistake')).toBe(true);
  });

  it('has a gate on the route, or an allowlisted service gate with a reason', () => {
    const missing = relevant
      .filter(r => !GATES.test(r.block.split('asyncHandler')[0]) && !allow[r.key])
      .map(r => `${r.key}  (${r.file})`);
    expect(missing).toEqual([]);
  });

  it('record routes are gated by the RECORD, not by an animal id taken from the body', () => {
    const bodyGated = relevant
      .filter(r => RECORD_PATH.test(r.path) && r.method !== 'GET' && !/^\/(medical-records|vaccinations)$/.test(r.path))
      .filter(r => !/requireRecordAccess\(/.test(r.block.split('asyncHandler')[0]) && !allow[r.key])
      .map(r => r.key);
    expect(bodyGated).toEqual([]);
  });

  it('the allowlist only holds routes that still exist and still need it (it may only shrink)', () => {
    const live = new Set(relevant.filter(r => !GATES.test(r.block.split('asyncHandler')[0])).map(r => r.key));
    const stale = Object.keys(allow).filter(k => !live.has(k));
    expect(stale).toEqual([]);
    for (const reason of Object.values(allow)) expect(reason.length).toBeGreaterThan(15);
  });
});
