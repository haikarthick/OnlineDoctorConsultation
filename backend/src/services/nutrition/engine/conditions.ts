/**
 * Recorded health conditions that make a food plan need a vet BEFORE it replaces the plan in use (plan §5.4).
 *
 * The medical record owns diagnoses and lab results; nothing here is entered again. This only READS them and answers
 * one question - "is there anything on record a vet must see before this diet is followed?" It never computes an
 * amount and never decides a diet. A false hit only sends the plan to a vet, so the list is deliberately wide.
 */
export type ConditionKey = 'kidney' | 'diabetes' | 'pancreatitis' | 'urinary' | 'liver' | 'heart' | 'pregnant_and_ill';

export const CONDITION_KEYS: readonly ConditionKey[] = ['kidney', 'diabetes', 'pancreatitis', 'urinary', 'liver', 'heart', 'pregnant_and_ill'];

/** Words in a diagnosis title, notes or tags (lower case). Whole-word starts, so "renal" matches "renal failure". */
const DIAGNOSIS_TERMS: Record<Exclude<ConditionKey, 'pregnant_and_ill'>, RegExp> = {
  kidney: /\b(kidney|renal|nephr|ckd)/,
  diabetes: /\b(diabet|insulin|hyperglyc)/,
  pancreatitis: /\bpancreatit/,
  urinary: /\b(urolith|urinary (stone|calcul|crystal)|struvite|oxalate|bladder stone|calculi)/,
  liver: /\b(liver|hepat|cholang|portosystemic)/,
  heart: /\b(heart|cardiac|cardiomyopath|murmur|congestive)/,
};

/** A lab test that is outside its range points to the same conditions. */
const LAB_TERMS: Record<Exclude<ConditionKey, 'pregnant_and_ill'>, RegExp> = {
  kidney: /\b(creatinine|bun|urea|sdma|phosph)/,
  diabetes: /\b(glucose|fructosamine|hba1c)/,
  pancreatitis: /\b(lipase|cpl|spec cpl|amylase)/,
  urinary: /\b(urinalysis|specific gravity|crystal)/,
  liver: /\b(alt|alp|bile acid|bilirubin|ggt|ast)\b/,
  heart: /\b(nt-?probnp|troponin)/,
};

export interface DiagnosisRow { title?: string | null; content?: string | null; tags?: string[] | null; severity?: string | null }
export interface LabRow { testName?: string | null; isAbnormal?: boolean | null }

export interface FoundCondition { key: ConditionKey; source: 'diagnosis' | 'lab' | 'status' }

export function detectConditions(input: {
  diagnoses: DiagnosisRow[]
  labs: LabRow[]
  breedingStatus?: string | null
}): FoundCondition[] {
  const found = new Map<ConditionKey, FoundCondition>();
  for (const d of input.diagnoses) {
    const text = `${d.title || ''} ${d.content || ''} ${(d.tags || []).join(' ')}`.toLowerCase();
    for (const key of Object.keys(DIAGNOSIS_TERMS) as Array<keyof typeof DIAGNOSIS_TERMS>) {
      if (!found.has(key) && DIAGNOSIS_TERMS[key].test(text)) found.set(key, { key, source: 'diagnosis' });
    }
  }
  for (const l of input.labs) {
    if (!l.isAbnormal) continue;
    const name = String(l.testName || '').toLowerCase();
    for (const key of Object.keys(LAB_TERMS) as Array<keyof typeof LAB_TERMS>) {
      if (!found.has(key) && LAB_TERMS[key].test(name)) found.set(key, { key, source: 'lab' });
    }
  }
  // Pregnant or nursing AND currently unwell (an active high or critical diagnosis): energy needs and safe foods both change.
  const expecting = /pregnan|lactat|nursing|gestat/i.test(input.breedingStatus || '');
  if (expecting && input.diagnoses.some(d => d.severity === 'high' || d.severity === 'critical')) {
    found.set('pregnant_and_ill', { key: 'pregnant_and_ill', source: 'status' });
  }
  return [...found.values()];
}
