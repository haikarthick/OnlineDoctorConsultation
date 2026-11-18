import { summarizeModeration, shouldModerate } from '../../src/utils/storage';

describe('summarizeModeration', () => {
  it('rejected wins over pending, pending over approved', () => {
    expect(summarizeModeration([{ kind: 'aws_rek', status: 'approved' }, { kind: 'x', status: 'rejected' }])).toBe('rejected');
    expect(summarizeModeration([{ status: 'approved' }, { status: 'pending' }])).toBe('pending');
    expect(summarizeModeration([{ status: 'approved' }])).toBe('approved');
  });
  it('says nothing when the upload was not screened', () => {
    expect(summarizeModeration(undefined)).toBeUndefined();
    expect(summarizeModeration([])).toBeUndefined();
    expect(summarizeModeration([{ status: 'weird' }])).toBeUndefined();
  });
});

describe('shouldModerate', () => {
  it('is off unless MEDIA_MODERATION is set', () => {
    expect(shouldModerate('marketplace', false, undefined)).toBe(false);
    expect(shouldModerate('marketplace', false, '')).toBe(false);
  });
  it('screens marketplace photos only', () => {
    expect(shouldModerate('marketplace', false, 'aws_rek')).toBe(true);
    expect(shouldModerate('marketplace/video', true, 'aws_rek')).toBe(false); // video moderation is asynchronous - not screened here
  });
  it('never screens medical photos (a wound photo is not "graphic content")', () => {
    for (const f of ['medical-records', 'consultations', 'general', 'prescriptions', 'marketplacefake']) {
      expect(shouldModerate(f, false, 'aws_rek')).toBe(false);
    }
  });
});
