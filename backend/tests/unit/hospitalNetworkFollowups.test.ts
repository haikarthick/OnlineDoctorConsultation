import database from '../../src/utils/database';
import { previewWalkInInvite, acceptWalkInInvite, listMyWalkInInvites } from '../../src/services/hospitalNetwork/enrollment';
import { createPatientTransfer } from '../../src/services/hospitalNetwork/leaveAndTransfer';
import { completePatientTransfer } from '../../src/services/hospitalNetwork/analyticsAndCompliance';
import { resolveNetworkAccess } from '../../src/middleware/networkAccess';

jest.mock('../../src/utils/database');
jest.mock('../../src/middleware/networkAccess', () => ({ resolveNetworkAccess: jest.fn() }));
jest.mock('../../src/services/NotificationService', () => ({ __esModule: true, default: { createNotification: jest.fn().mockResolvedValue({}) } }));

const query = database.query as jest.Mock;
const access = resolveNetworkAccess as jest.Mock;
const future = new Date(Date.now() + 3600_000).toISOString();
const invite = (over: Record<string, unknown> = {}) => ({ id: 'i1', token: 't', patientName: 'Asha', animalName: 'Moti', networkName: 'Green Vets', status: 'pending', expiresAt: future, ...over });

beforeEach(() => { jest.resetAllMocks(); });

describe('walk-in invitation: every refusal has a code the app can translate', () => {
  it('an unknown link is WI_NOT_FOUND', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(previewWalkInInvite('nope')).rejects.toMatchObject({ errorCode: 'WI_NOT_FOUND', statusCode: 404 });
  });
  it('an expired invitation is WI_EXPIRED', async () => {
    query.mockResolvedValueOnce({ rows: [invite({ expiresAt: new Date(Date.now() - 1000).toISOString() })] });
    await expect(previewWalkInInvite('t')).rejects.toMatchObject({ errorCode: 'WI_EXPIRED' });
  });
  it('an invitation already used is WI_USED', async () => {
    query.mockResolvedValueOnce({ rows: [invite({ status: 'accepted' })] });
    await expect(previewWalkInInvite('t')).rejects.toMatchObject({ errorCode: 'WI_USED' });
  });
  it('two taps at once: the second finds it taken (WI_USED), not a second acceptance', async () => {
    query.mockResolvedValueOnce({ rows: [invite()] }).mockResolvedValueOnce({ rows: [] });
    await expect(acceptWalkInInvite('t', 'u1')).rejects.toMatchObject({ errorCode: 'WI_USED' });
  });
  it('accepting marks it accepted and tells the inviter - and shares no animal data', async () => {
    query.mockResolvedValueOnce({ rows: [invite()] })
      .mockResolvedValueOnce({ rows: [{ id: 'i1', network_id: 'n1', hospital_id: 'h1', invited_by: 'staff1' }] });
    const r = await acceptWalkInInvite('t', 'u1');
    expect(r).toEqual({ id: 'i1', networkId: 'n1', hospitalId: 'h1' });
    expect(query).toHaveBeenCalledTimes(2); // preview + the one UPDATE; no enrolment, no consent, no animal read
    expect(String(query.mock.calls[1][0])).toMatch(/UPDATE hospital_patient_invites/);
    expect(String(query.mock.calls[1][0])).not.toMatch(/animal_care_contexts|patient_consents/);
  });
  it('the banner is found by the signed-in person\'s own email only', async () => {
    query.mockResolvedValueOnce({ rows: [invite()] });
    await listMyWalkInInvites('u1');
    expect(String(query.mock.calls[0][0])).toMatch(/lower\(i\.patient_email\) = \(SELECT lower\(email\) FROM users WHERE id = \$1\)/);
    expect(query.mock.calls[0][1]).toEqual(['u1']);
  });
});

describe('patient transfer: the animal id from the request is never trusted on its own', () => {
  const data = { networkId: 'n1', fromHospitalId: 'hA', toHospitalId: 'hB', animalId: 'a1', reason: 'surgery', createdBy: 'u1', createdByRole: 'veterinarian' };
  const hospitals = { rows: [{ hospital_id: 'hA' }, { hospital_id: 'hB' }] };

  it('without the transfer right nothing about the network is revealed (the check runs first)', async () => {
    access.mockResolvedValueOnce({ allowed: false });
    await expect(createPatientTransfer(data)).rejects.toMatchObject({ errorCode: 'HN_TRANSFER_FORBIDDEN', statusCode: 403 });
    expect(query).not.toHaveBeenCalled();
  });
  it('a hospital outside the network is refused', async () => {
    access.mockResolvedValueOnce({ allowed: true });
    query.mockResolvedValueOnce({ rows: [{ hospital_id: 'hA' }] });
    await expect(createPatientTransfer(data)).rejects.toMatchObject({ errorCode: 'HN_HOSPITAL_NOT_IN_NETWORK' });
  });
  it('moving to the same hospital is refused', async () => {
    access.mockResolvedValueOnce({ allowed: true });
    query.mockResolvedValueOnce({ rows: [{ hospital_id: 'hA' }] });
    await expect(createPatientTransfer({ ...data, toHospitalId: 'hA' })).rejects.toMatchObject({ errorCode: 'HN_SAME_HOSPITAL' });
  });
  it('an animal that is not an active patient of THIS network is refused (any animal id someone types)', async () => {
    access.mockResolvedValueOnce({ allowed: true });
    query.mockResolvedValueOnce(hospitals).mockResolvedValueOnce({ rows: [] });
    await expect(createPatientTransfer(data)).rejects.toMatchObject({ errorCode: 'HN_ANIMAL_NOT_PATIENT' });
    expect(String(query.mock.calls[1][0])).toMatch(/animal_care_contexts[\s\S]*network_id = \$1[\s\S]*enrollment_status = 'active'/);
  });
  it('a patient who is at another hospital than "from" is refused', async () => {
    access.mockResolvedValueOnce({ allowed: true });
    query.mockResolvedValueOnce(hospitals).mockResolvedValueOnce({ rows: [{ hospital_id: 'hZ' }] });
    await expect(createPatientTransfer(data)).rejects.toMatchObject({ errorCode: 'HN_NOT_AT_HOSPITAL' });
  });
  it('a second open transfer for the same patient is refused', async () => {
    access.mockResolvedValueOnce({ allowed: true });
    query.mockResolvedValueOnce(hospitals).mockResolvedValueOnce({ rows: [{ hospital_id: 'hA' }] }).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await expect(createPatientTransfer(data)).rejects.toMatchObject({ errorCode: 'HN_TRANSFER_OPEN', statusCode: 409 });
  });
  it('a valid transfer is saved', async () => {
    access.mockResolvedValueOnce({ allowed: true });
    query.mockResolvedValueOnce(hospitals).mockResolvedValueOnce({ rows: [{ hospital_id: 'hA' }] }).mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'tr1', status: 'pending' }] });
    await expect(createPatientTransfer(data)).resolves.toMatchObject({ id: 'tr1' });
  });
});

describe('completing a transfer', () => {
  it('a finished transfer cannot be completed again', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tr1', network_id: 'n1', status: 'completed', animal_id: 'a1', to_hospital_id: 'hB' }] });
    access.mockResolvedValueOnce({ allowed: true });
    await expect(completePatientTransfer('tr1', 'u1', 'veterinarian')).rejects.toMatchObject({ errorCode: 'HN_TRANSFER_CLOSED', statusCode: 409 });
  });
  it('an unknown transfer is HN_TRANSFER_NOT_FOUND', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(completePatientTransfer('x', 'u1', 'veterinarian')).rejects.toMatchObject({ errorCode: 'HN_TRANSFER_NOT_FOUND' });
  });
  it('completing moves the patient, closes the transfer and tells the owner', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tr1', network_id: 'n1', status: 'pending', animal_id: 'a1', to_hospital_id: 'hB' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'tr1', status: 'completed' }] })
      .mockResolvedValueOnce({ rows: [{ owner_id: 'o1', name: 'Moti', to_name: 'Main Hospital' }] });
    access.mockResolvedValueOnce({ allowed: true });
    const r = await completePatientTransfer('tr1', 'u1', 'veterinarian');
    expect(r.status).toBe('completed');
    const NotificationService = (await import('../../src/services/NotificationService')).default as any;
    expect(NotificationService.createNotification).toHaveBeenCalledWith('o1', 'system', expect.stringContaining('Moti'), expect.any(String), 'in_app', expect.objectContaining({ type: 'patient_transferred' }));
  });
});
