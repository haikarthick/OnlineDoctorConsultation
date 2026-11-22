/**
 * Least-cost ration by linear programming (docs/NUTRITION_PLAN.md §5.3 item 3) - the method national ration
 * balancing programmes use: minimise the cost of the feeds subject to the animal's nutrient needs and practical
 * limits per feed. Small dense two-phase simplex (Bland's rule, no cycling) - a ration has tens of feeds and
 * about ten constraints, so this solves in microseconds with no external dependency.
 *
 *   minimise   sum(cost_j * x_j)                     x_j = kg dry matter of feed j per day
 *   subject to sum(a_ij * x_j)  >= / <= / =  b_i     (nutrients, intake, per-feed limits)
 *              x_j >= 0
 */

export type ConstraintKind = '>=' | '<=' | '=';

export interface LpConstraint {
  name: string;
  coefficients: number[];
  kind: ConstraintKind;
  rhs: number;
}

export interface LpProblem {
  costs: number[];
  constraints: LpConstraint[];
}

export type LpResult =
  | { status: 'optimal'; x: number[]; objective: number }
  | { status: 'infeasible' }
  | { status: 'unbounded' };

const EPS = 1e-9;

export function solveLp(problem: LpProblem): LpResult {
  const n = problem.costs.length;
  // Normalise to rhs >= 0.
  const rows = problem.constraints.map(c => {
    if (c.coefficients.length !== n) throw new Error(`Constraint ${c.name} has ${c.coefficients.length} coefficients, expected ${n}`);
    if (c.rhs < 0) {
      return { coefficients: c.coefficients.map(v => -v), rhs: -c.rhs, kind: (c.kind === '>=' ? '<=' : c.kind === '<=' ? '>=' : '=') as ConstraintKind };
    }
    return { coefficients: [...c.coefficients], rhs: c.rhs, kind: c.kind };
  });
  const m = rows.length;

  // Columns: n originals, one slack/surplus per inequality, one artificial per >= or = row.
  const slackCount = rows.filter(r => r.kind !== '=').length;
  const artCount = rows.filter(r => r.kind !== '<=').length;
  const width = n + slackCount + artCount + 1; // + rhs
  const T: number[][] = Array.from({ length: m }, () => new Array(width).fill(0));
  const basis: number[] = new Array(m).fill(-1);
  const artificial: number[] = [];
  let s = n;
  let a = n + slackCount;
  rows.forEach((r, i) => {
    for (let j = 0; j < n; j++) T[i][j] = r.coefficients[j];
    T[i][width - 1] = r.rhs;
    if (r.kind === '<=') { T[i][s] = 1; basis[i] = s; s++; }
    else if (r.kind === '>=') { T[i][s] = -1; s++; T[i][a] = 1; basis[i] = a; artificial.push(a); a++; }
    else { T[i][a] = 1; basis[i] = a; artificial.push(a); a++; }
  });

  const pivot = (row: number, col: number, obj: number[]) => {
    const p = T[row][col];
    for (let j = 0; j < width; j++) T[row][j] /= p;
    for (let i = 0; i < m; i++) {
      if (i === row) continue;
      const f = T[i][col];
      if (Math.abs(f) > EPS) for (let j = 0; j < width; j++) T[i][j] -= f * T[row][j];
    }
    const f = obj[col];
    if (Math.abs(f) > EPS) for (let j = 0; j < width; j++) obj[j] -= f * T[row][j];
    basis[row] = col;
  };

  /** Minimises `obj` (reduced costs row, rhs in last cell) over allowed columns. */
  const run = (obj: number[], allowed: (col: number) => boolean): 'optimal' | 'unbounded' => {
    for (let iter = 0; iter < 5000; iter++) {
      // Bland: lowest-index column with a negative reduced cost.
      let col = -1;
      for (let j = 0; j < width - 1; j++) if (allowed(j) && obj[j] < -EPS) { col = j; break; }
      if (col === -1) return 'optimal';
      let row = -1;
      let best = Infinity;
      for (let i = 0; i < m; i++) {
        if (T[i][col] > EPS) {
          const ratio = T[i][width - 1] / T[i][col];
          if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && row !== -1 && basis[i] < basis[row])) { best = ratio; row = i; }
        }
      }
      if (row === -1) return 'unbounded';
      pivot(row, col, obj);
    }
    return 'optimal';
  };

  // Phase 1: minimise the sum of artificials.
  if (artificial.length) {
    const obj = new Array(width).fill(0);
    for (const c of artificial) obj[c] = 1;
    for (let i = 0; i < m; i++) if (artificial.includes(basis[i])) for (let j = 0; j < width; j++) obj[j] -= T[i][j];
    run(obj, () => true);
    if (-obj[width - 1] > 1e-6) return { status: 'infeasible' };
    // Drive any artificial still in the basis (at zero) out, where possible.
    for (let i = 0; i < m; i++) {
      if (!artificial.includes(basis[i])) continue;
      const col = T[i].findIndex((v, j) => j < n + slackCount && Math.abs(v) > EPS);
      if (col !== -1) pivot(i, col, new Array(width).fill(0));
    }
  }

  // Phase 2: minimise cost, artificials barred.
  const obj = new Array(width).fill(0);
  for (let j = 0; j < n; j++) obj[j] = problem.costs[j];
  for (let i = 0; i < m; i++) {
    const c = basis[i] < n ? problem.costs[basis[i]] : 0;
    if (Math.abs(c) > EPS) for (let j = 0; j < width; j++) obj[j] -= c * T[i][j];
  }
  const artSet = new Set(artificial);
  if (run(obj, j => !artSet.has(j)) === 'unbounded') return { status: 'unbounded' };

  const x = new Array(n).fill(0);
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = Math.max(0, T[i][width - 1]);
  const objective = x.reduce((sum, v, j) => sum + v * problem.costs[j], 0);
  return { status: 'optimal', x, objective };
}
