jest.mock('../../src/services/ErrorAlertService', () => ({ recordSystemError: jest.fn() }));
import { isTechnicalMessage, plainMessageFor, safeErrorResponse } from '../../src/middleware/safeErrorResponse';

function run(status: number, body: any) {
  let sent: any;
  const res: any = { statusCode: status, json: (b: any) => { sent = b; return res; } };
  safeErrorResponse({ method: 'POST', originalUrl: '/x' } as any, res, () => undefined);
  res.json(body);
  return sent;
}

describe('safeErrorResponse', () => {
  it.each([
    'column "state" of relation "marketplace_listings" does not exist',
    'duplicate key value violates unique constraint "x"',
    'null value in column "name" violates not-null constraint',
    'Request failed with status code 500',
    "Cannot read properties of undefined (reading 'id')",
    'connect ECONNREFUSED 127.0.0.1:5432',
    'Internal Server Error',
    'invalid input syntax for type uuid: "abc"',
  ])('hides: %s', (m) => {
    expect(isTechnicalMessage(m)).toBe(true);
    const out = run(500, { error: { message: m } });
    expect(out.error.message).toBe(plainMessageFor(500));
    expect(out.error.reference).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(out)).not.toContain(m);
  });

  it('keeps readable messages untouched', () => {
    const body = { error: { message: 'You can only list up to 8 photos.' } };
    expect(run(400, body)).toEqual(body);
    expect(run(500, { error: { message: 'Listing is already sold.' } }).error.message).toBe('Listing is already sold.');
  });

  it('does not touch success responses', () => {
    const body = { data: { note: 'column "x" does not exist is just text here' } };
    expect(run(200, body)).toEqual(body);
  });

  it('cleans a top-level message too', () => {
    expect(run(500, { message: 'relation "t" does not exist' }).message).toBe(plainMessageFor(500));
  });
});
