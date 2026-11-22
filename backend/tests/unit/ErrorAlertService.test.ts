const query = jest.fn();
const send = jest.fn().mockResolvedValue({});
jest.mock('../../src/utils/database', () => ({ __esModule: true, default: { query: (...a: any[]) => query(...a) } }));
jest.mock('../../src/services/EmailService', () => ({ __esModule: true, default: { send: (...a: any[]) => send(...a) } }));

import { errorSignature, recordSystemError, runErrorDigest } from '../../src/services/ErrorAlertService';

describe('ErrorAlertService', () => {
  beforeEach(() => { query.mockReset(); send.mockClear(); process.env.OPS_ALERT_EMAIL = 'ops@example.com'; });

  it('gives the same signature to the same problem on different ids and numbers', () => {
    const a = errorSignature(500, 'GET', '/api/v1/x/123e4567-e89b-12d3-a456-426614174000', 'column "a" of relation "t" does not exist at 12');
    const b = errorSignature(500, 'GET', '/api/v1/x/223e4567-e89b-12d3-a456-426614174999', 'column "a" of relation "t" does not exist at 99');
    expect(a).toBe(b);
    expect(errorSignature(500, 'POST', '/api/v1/x', 'other')).not.toBe(a);
  });

  it('emails at once for a brand-new 5xx problem, not for a repeat', async () => {
    query.mockResolvedValueOnce({ rows: [{ occurrences: 1 }] });
    await recordSystemError({ reference: 'abc12345', status: 500, method: 'POST', path: '/api/v1/m', message: 'relation "x" does not exist' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('ops@example.com');
    query.mockResolvedValueOnce({ rows: [{ occurrences: 5 }] });
    await recordSystemError({ reference: 'abc12346', status: 500, method: 'POST', path: '/api/v1/m', message: 'relation "x" does not exist' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never throws when the database is down', async () => {
    query.mockRejectedValueOnce(new Error('down'));
    await expect(recordSystemError({ reference: 'r', status: 500, message: 'm' })).resolves.toBeUndefined();
  });

  it('sends one digest after 09:00 India time, and nothing on a quiet day', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    await runErrorDigest(new Date('2031-01-05T04:00:00Z'));
    expect(send).not.toHaveBeenCalled();
    query.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ reference: 'r1', status: 500, method: 'GET', path: '/p', message: 'boom', occurrences: 3 }] })
      .mockResolvedValueOnce({ rows: [] });
    await runErrorDigest(new Date('2031-01-06T04:00:00Z'));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain('Daily error digest: 1');
  });

  it('does not send before 09:00 India time', async () => {
    await runErrorDigest(new Date('2031-01-07T02:00:00Z'));
    expect(send).not.toHaveBeenCalled();
  });
});
