/**
 * Turns a daily energy target into grams of each food. A food's energy comes from its own label (preferred)
 * or the library. Shares are each food's part of the day's energy; they are normalised to 100%.
 */
export interface PortionFood {
  key: string;
  label: string;
  kcalPer100g: number | null;
  sharePct: number;
}

export interface PortionLine {
  key: string;
  label: string;
  sharePct: number;
  kcalPerDay: number;
  gramsPerDay: number | null;
  gramsPerMeal: number | null;
}

export interface PortionResult {
  lines: PortionLine[];
  /** Foods whose energy is unknown - they cannot be portioned until the label value is added. */
  missingEnergy: string[];
  totalKcal: number;
}

const round = (n: number, step = 1): number => Math.round(n / step) * step;

export function portions(dailyKcal: number, foods: PortionFood[], mealsPerDay: number): PortionResult {
  const meals = Math.min(Math.max(Math.round(mealsPerDay) || 1, 1), 12);
  const usable = foods.filter(f => f.sharePct > 0);
  const shareTotal = usable.reduce((s, f) => s + f.sharePct, 0);
  const lines: PortionLine[] = [];
  const missingEnergy: string[] = [];
  for (const f of usable) {
    const share = shareTotal > 0 ? (f.sharePct / shareTotal) * 100 : 0;
    const kcalPerDay = round((dailyKcal * share) / 100);
    let gramsPerDay: number | null = null;
    if (f.kcalPer100g && f.kcalPer100g > 0) {
      gramsPerDay = round((kcalPerDay / f.kcalPer100g) * 100, gramsStep(kcalPerDay, f.kcalPer100g));
    } else {
      missingEnergy.push(f.label);
    }
    lines.push({
      key: f.key, label: f.label, sharePct: Math.round(share * 10) / 10, kcalPerDay,
      gramsPerDay, gramsPerMeal: gramsPerDay === null ? null : round(gramsPerDay / meals, 1),
    });
  }
  return { lines, missingEnergy, totalKcal: lines.reduce((s, l) => s + l.kcalPerDay, 0) };
}

/** Kitchen-scale precision: whole grams for small portions, 5 g steps for large ones. */
function gramsStep(kcal: number, kcalPer100g: number): number {
  return (kcal / kcalPer100g) * 100 > 200 ? 5 : 1;
}
