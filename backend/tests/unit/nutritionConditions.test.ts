import { detectConditions } from '../../src/services/nutrition/engine/conditions';

/** NUT-086/128: a recorded condition sends a new plan to a vet first. The engine only READS what the medical record holds. */
describe('detectConditions', () => {
  it('finds nothing on a healthy record', () => {
    expect(detectConditions({ diagnoses: [{ title: 'Annual check', content: 'All normal' }], labs: [] })).toEqual([]);
  });

  it('reads a diagnosis title, notes or tags', () => {
    const r = detectConditions({
      diagnoses: [
        { title: 'Chronic kidney disease stage 2', content: '' },
        { title: 'Follow up', content: 'Suspected pancreatitis after fatty meal' },
        { title: 'Bladder', tags: ['struvite'] },
      ],
      labs: [],
    });
    expect(r.map(c => c.key).sort()).toEqual(['kidney', 'pancreatitis', 'urinary']);
    expect(r.every(c => c.source === 'diagnosis')).toBe(true);
  });

  it('reads an abnormal lab result, and ignores a normal one', () => {
    const r = detectConditions({ diagnoses: [], labs: [{ testName: 'Creatinine', isAbnormal: true }, { testName: 'Glucose', isAbnormal: false }] });
    expect(r).toEqual([{ key: 'kidney', source: 'lab' }]);
  });

  it('pregnant or nursing AND seriously unwell needs a vet', () => {
    const r = detectConditions({ diagnoses: [{ title: 'Pneumonia', severity: 'high' }], labs: [], breedingStatus: 'Lactating' });
    expect(r.map(c => c.key)).toEqual(['pregnant_and_ill']);
    expect(detectConditions({ diagnoses: [{ title: 'Pneumonia', severity: 'high' }], labs: [], breedingStatus: 'open' })).toEqual([]);
  });

  it('does not match the middle of a word', () => {
    expect(detectConditions({ diagnoses: [{ title: 'Ear infection', content: 'Normal delivery, no complications' }], labs: [] })).toEqual([]);
  });
});
