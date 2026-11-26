import database from '../../src/utils/database';
import RecordCorrectionService from '../../src/services/RecordCorrectionService';
import AnimalAccessService from '../../src/services/AnimalAccessService';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/AnimalAccessService', () => ({
  __esModule: true,
  default: { check: jest.fn(), checkGroup: jest.fn() },
}));

const q = database.query as jest.Mock;
const check = AnimalAccessService.check as jest.Mock;
const me = { userId: 'u1', role: 'veterinarian' };

describe('RecordCorrectionService', () => {
  beforeEach(() => { jest.resetAllMocks(); });

  describe('addAddendum', () => {
    it('refuses an empty note in plain words', async () => {
      await expect(RecordCorrectionService.addAddendum('r1', me, '  ')).rejects.toThrow(/Write the correction/);
      expect(q).not.toHaveBeenCalled();
    });

    it('stores the note with the author and role and never touches the record row', async () => {
      q.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })    // record exists
        .mockResolvedValueOnce({ rows: [{ name: 'Dr A' }] })     // actor name
        .mockResolvedValueOnce({ rows: [] })                      // INSERT addendum
        .mockResolvedValueOnce({ rows: [] })                      // audit
        .mockResolvedValueOnce({ rows: [{ id: 'n1', note: 'Dose was 2 ml', authorName: 'Dr A' }] });
      const out = await RecordCorrectionService.addAddendum('r1', me, 'Dose was 2 ml');
      expect(out.authorName).toBe('Dr A');
      const sqls = q.mock.calls.map(c => String(c[0]));
      expect(sqls.some(s => /UPDATE\s+medical_records/i.test(s))).toBe(false);
      expect(sqls.some(s => /INSERT INTO medical_record_addenda/.test(s))).toBe(true);
    });
  });

  describe('markMistake', () => {
    it('requires a reason', async () => {
      await expect(RecordCorrectionService.markMistake('vaccination_records', 'v1', me, '')).rejects.toThrow(/Say why/);
    });

    it('refuses a booked vet who did not enter it, with the next step', async () => {
      q.mockResolvedValueOnce({ rows: [{ animal_id: 'a1', group_id: null, author_id: 'other', entered_by_mistake_at: null }] });
      check.mockResolvedValueOnce({ found: true, allowed: true, via: 'vet' });
      await expect(RecordCorrectionService.markMistake('vaccination_records', 'v1', me, 'wrong animal'))
        .rejects.toMatchObject({ statusCode: 403, errorCode: 'REC_NOT_AUTHOR', message: expect.stringMatching(/correction note/) });
    });

    it('lets the author mark it, hides it and reopens the dose it satisfied', async () => {
      q.mockResolvedValueOnce({ rows: [{ animal_id: 'a1', group_id: null, author_id: 'u1', entered_by_mistake_at: null }] })
        .mockResolvedValueOnce({ rows: [{ name: 'Dr A' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })   // UPDATE vaccination_records
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })   // UPDATE vaccine_schedule
        .mockResolvedValueOnce({ rows: [] });                // audit
      check.mockResolvedValueOnce({ found: true, allowed: true, via: 'vet' });
      const out = await RecordCorrectionService.markMistake('vaccination_records', 'v1', me, 'wrong date');
      expect(out.reopenedDoses).toBe(1);
      const sqls = q.mock.calls.map(c => String(c[0]));
      expect(sqls[2]).toMatch(/is_valid = false/);
      expect(sqls[2]).not.toMatch(/DELETE/i);
      expect(sqls[3]).toMatch(/UPDATE vaccine_schedule[\s\S]*'overdue' ELSE 'pending'/);
    });

    it('lets the animal\'s owner mark an allergy entry made by a vet, and switches the warning off', async () => {
      q.mockResolvedValueOnce({ rows: [{ animal_id: 'a1', author_id: 'vet9', entered_by_mistake_at: null }] })
        .mockResolvedValueOnce({ rows: [{ name: 'Owner' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });
      check.mockResolvedValueOnce({ found: true, allowed: true, via: 'owner' });
      await RecordCorrectionService.markMistake('allergy_records', 'al1', { userId: 'u1', role: 'pet_owner' }, 'wrong animal');
      expect(String(q.mock.calls[2][0])).toMatch(/is_active = false/);
    });

    it('does not mark twice', async () => {
      q.mockResolvedValueOnce({ rows: [{ animal_id: 'a1', author_id: 'u1', entered_by_mistake_at: new Date() }] });
      await expect(RecordCorrectionService.markMistake('allergy_records', 'al1', me, 'again')).rejects.toThrow(/already marked/);
    });
  });
});
