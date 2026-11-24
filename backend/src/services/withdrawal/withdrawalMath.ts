/**
 * Withdrawal arithmetic (ledger WDR-*). The platform is a neutral tool: it never knows a medicine's withdrawal time
 * itself - the vet types the label's days on the prescription line (or the farmer on their own treatment). This file only
 * does the date sums, in one place, so every screen and every reader agrees.
 *
 *   last dose  = the farmer's correction, else treatment start + (treatment days - 1)
 *   withheld THROUGH = last dose + the label's days   (milk / eggs and meat have their own days)
 */
export interface CourseLine {
  /** Where the line came from: a vet's prescription, or the farmer's own entry. */
  source: 'prescription' | 'self';
  sourceId: string;
  medicine: string;
  kind: string;
  /** YYYY-MM-DD the course began (the prescription's date, or the farmer's start date). */
  startedOn: string;
  treatmentDays: number;
  /** The farmer's correction ("stopped early" / "last dose on"), YYYY-MM-DD, or null = as prescribed. */
  lastDoseOn: string | null;
  milkDays: number;
  meatDays: number;
}

export interface WithdrawalItem {
  source: 'prescription' | 'self';
  sourceId: string;
  medicine: string;
  kind: string;
  startedOn: string;
  lastDose: string;
  /** Last day milk / eggs must be withheld, or null when the label gives none. */
  milkUntil: string | null;
  meatUntil: string | null;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** A whole number of days >= 0 from whatever the JSON or the form held; anything else counts as none. */
export function wholeDays(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 365) : 0;
}

export function itemFor(line: CourseLine): WithdrawalItem {
  const days = Math.max(1, wholeDays(line.treatmentDays) || 1);
  const lastDose = line.lastDoseOn || addDays(line.startedOn, days - 1);
  return {
    source: line.source, sourceId: line.sourceId, medicine: line.medicine, kind: line.kind,
    startedOn: line.startedOn.slice(0, 10), lastDose,
    milkUntil: line.milkDays > 0 ? addDays(lastDose, line.milkDays) : null,
    meatUntil: line.meatDays > 0 ? addDays(lastDose, line.meatDays) : null,
  };
}

export interface WithdrawalSummary {
  milkUntil: string | null;
  meatUntil: string | null;
  milkActive: boolean;
  meatActive: boolean;
  active: boolean;
  /** The courses that are still holding something back (or still running), newest first. */
  items: WithdrawalItem[];
}

/** Latest "through" date per kind among the items still running today; items that have ended are left out. */
export function summarise(items: WithdrawalItem[], today: string): WithdrawalSummary {
  const live = items.filter(i => (i.milkUntil && i.milkUntil >= today) || (i.meatUntil && i.meatUntil >= today));
  const max = (pick: (i: WithdrawalItem) => string | null) =>
    live.map(pick).filter((d): d is string => !!d && d >= today).sort().pop() || null;
  const milkUntil = max(i => i.milkUntil);
  const meatUntil = max(i => i.meatUntil);
  return {
    milkUntil, meatUntil, milkActive: !!milkUntil, meatActive: !!meatUntil, active: !!milkUntil || !!meatUntil,
    items: live.sort((a, b) => b.startedOn.localeCompare(a.startedOn)),
  };
}

/** A prescription line the vet must give withdrawal days for: a medicine or medicated feed (not a diet or supplement). */
export function needsWithdrawalChoice(line: { kind?: string | null }): boolean {
  const k = line.kind || 'medicine';
  return k === 'medicine' || k === 'medicated_feed';
}

/** The vet's answer is complete when both numbers are given, or "none" is chosen explicitly. */
export function withdrawalAnswered(line: { withdrawalNone?: unknown; withdrawalMilkDays?: unknown; withdrawalMeatDays?: unknown }): boolean {
  if (line.withdrawalNone === true) return true;
  const given = (v: unknown) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
  return given(line.withdrawalMilkDays) && given(line.withdrawalMeatDays);
}
