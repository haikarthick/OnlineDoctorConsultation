import { solveLp } from '../../src/services/nutrition/engine/leastCost';

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('least-cost LP solver', () => {
  it('classic two-feed diet: cheapest mix that meets energy and protein', () => {
    // feed A: 2 energy, 1 protein, cost 3; feed B: 1 energy, 3 protein, cost 4. Need >= 8 energy, >= 9 protein.
    const r = solveLp({
      costs: [3, 4],
      constraints: [
        { name: 'energy', coefficients: [2, 1], kind: '>=', rhs: 8 },
        { name: 'protein', coefficients: [1, 3], kind: '>=', rhs: 9 },
      ],
    });
    expect(r.status).toBe('optimal');
    if (r.status !== 'optimal') return;
    close(r.x[0], 3); close(r.x[1], 2); close(r.objective, 17);
  });

  it('respects an equality (total intake) and an upper limit on one feed', () => {
    // 10 kg total; feed 0 is cheapest but limited to 4 kg; protein >= 1.2 kg.
    const r = solveLp({
      costs: [1, 5, 3],
      constraints: [
        { name: 'intake', coefficients: [1, 1, 1], kind: '=', rhs: 10 },
        { name: 'limit0', coefficients: [1, 0, 0], kind: '<=', rhs: 4 },
        { name: 'protein', coefficients: [0.05, 0.4, 0.1], kind: '>=', rhs: 1.2 },
      ],
    });
    expect(r.status).toBe('optimal');
    if (r.status !== 'optimal') return;
    close(r.x.reduce((s, v) => s + v, 0), 10);
    expect(r.x[0]).toBeLessThanOrEqual(4 + 1e-9);
    expect(0.05 * r.x[0] + 0.4 * r.x[1] + 0.1 * r.x[2]).toBeGreaterThanOrEqual(1.2 - 1e-9);
    // Cheapest: 4 kg of feed 0, then the protein from the cheapest combination of 1 and 2.
    close(r.x[0], 4); close(r.objective, 4 + 5 * r.x[1] + 3 * r.x[2]);
  });

  it('reports infeasible when no mix can meet the need', () => {
    const r = solveLp({
      costs: [1, 1],
      constraints: [
        { name: 'intake', coefficients: [1, 1], kind: '<=', rhs: 5 },
        { name: 'protein', coefficients: [0.1, 0.1], kind: '>=', rhs: 2 },
      ],
    });
    expect(r.status).toBe('infeasible');
  });

  it('handles a negative right-hand side by flipping the row', () => {
    const r = solveLp({ costs: [1], constraints: [{ name: 'neg', coefficients: [-1], kind: '<=', rhs: -3 }] });
    expect(r.status).toBe('optimal');
    if (r.status === 'optimal') close(r.x[0], 3);
  });
});
