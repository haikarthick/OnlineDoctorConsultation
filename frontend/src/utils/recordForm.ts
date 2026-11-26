/**
 * Small pure helpers the record edit sheets share (components/mobile/RowActions.tsx), so every list screen
 * turns a server row into form values - and back - the same way.
 */

/** A row from the server may use camelCase or snake_case; read whichever is there. */
export function pickField(row: any, camel: string): any {
  if (!row) return undefined
  if (row[camel] !== undefined && row[camel] !== null) return row[camel]
  const snake = camel.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
  return row[snake]
}

/** A date from the server (ISO text, 'YYYY-MM-DD', or empty) as the 'YYYY-MM-DD' a date input needs. */
export function dateInput(v: unknown): string {
  if (!v) return ''
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
}

/** A time from the server ('08:00:00') as the 'HH:MM' a time input needs. */
export function timeInput(v: unknown): string {
  if (!v) return ''
  const m = String(v).match(/^(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : ''
}

/** Any value as the string a sheet field holds ('' for nothing). */
export function fieldText(v: unknown): string {
  return v === undefined || v === null ? '' : String(v)
}

/** Only the entries whose value is not undefined - what the update routes expect (they ignore a field that is absent). */
export function definedOnly<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(o)) if (o[k] !== undefined) (out as any)[k] = o[k]
  return out
}

/** The farm roles that only look: they are not offered Edit or Delete (the server refuses them with a plain sentence anyway). */
export function mayChangeFarmRecords(role: string | null | undefined): boolean {
  return role !== 'viewer'
}
