/**
 * Guard for AI-written plan explanations (docs/NUTRITION_PLAN.md §5.3 item 7: "output validated before display").
 * Numbers come only from the engine. An explanation may repeat the plan's numbers - in any of the six languages'
 * digit systems - but a number the plan does not contain means the AI invented an amount, and the whole text is
 * thrown away (the screen then shows its own built-in explanation).
 */

/** Digits of the scripts our six locales may answer in, mapped to 0-9. */
const DIGIT_SETS = [
  '०१२३४५६७८९', // Devanagari (hi)
  '೦೧೨೩೪೫೬೭೮೯', // Kannada
  '൦൧൨൩൪൫൬൭൮൯', // Malayalam
  '௦௧௨௩௪௫௬௭௮௯', // Tamil
  '౦౧౨౩౪౫౬౭౮౯', // Telugu
];

export function toLatinDigits(text: string): string {
  let out = text;
  for (const set of DIGIT_SETS) {
    for (let d = 0; d < 10; d++) out = out.split(set[d]).join(String(d));
  }
  return out;
}

/** Every number in a text: "1,234.5" -> 1234.5; "2-3" -> 2 and 3. */
export function numbersIn(text: string): number[] {
  const latin = toLatinDigits(text);
  const found = latin.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  return found.map(s => Number(s.replace(/,/g, ''))).filter(n => Number.isFinite(n));
}

/** Numbers that are fine to see in any explanation: none of them is an amount. */
const HARMLESS = new Set([0, 1, 2, 100]);

/**
 * True when every number in `text` is one of `allowed` (or a rounding of one), or is harmless. `allowed` is built from
 * the very facts the AI was given.
 */
export function onlyKnownNumbers(text: string, allowed: number[]): { ok: boolean; unknown: number[] } {
  const ok = new Set<number>();
  for (const n of allowed) {
    if (!Number.isFinite(n)) continue;
    ok.add(n);
    ok.add(Math.round(n));
    ok.add(Math.round(n * 10) / 10);
    ok.add(Math.floor(n));
    ok.add(Math.ceil(n));
  }
  const unknown = numbersIn(text).filter(n => !HARMLESS.has(n) && !ok.has(n));
  return { ok: unknown.length === 0, unknown };
}
