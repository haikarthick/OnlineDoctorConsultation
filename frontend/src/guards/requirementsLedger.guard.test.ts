import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * HARNESS RULE H16 - every requirement is tracked to an end; none disappears silently (owner rule 2026-11-23).
 *
 * Each module that has a plan keeps a requirements ledger, `docs/modules/<module>-ledger.md`: one table row per
 * requirement, cross-module link and use case from its plan (written by the requirements-analyst agent BEFORE code).
 * Why: the nutrition plan listed the feed-record merge, notifications, dashboards and pharmacy links, but "done" was
 * judged by phase headlines and those rows dropped off with nobody deciding to drop them.
 *
 * Rules checked here (they run at push and in CI):
 *   1. every row has an ID (ABC-001), a requirement and a status: Built | Planned | Deferred | N/A
 *   2. Built  -> evidence names real files (in backticks) and at least one of them is a test or runtime-verify
 *   3. Deferred -> says who decided ("owner") and when (YYYY-MM-DD)
 *   4. N/A    -> gives a reason
 *   5. rows never disappear: every ID in docs/modules/ledgers.lock.json must still be in its ledger. The lock only
 *      grows - a new row is added to it, a finished or dropped row changes STATUS, never vanishes.
 * Whether a Built row really works is judged by the completeness-auditor agent and runtime-verify, not here.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR = path.join(ROOT, 'docs', 'modules')
const LOCK = path.join(DIR, 'ledgers.lock.json')
const STATUSES = ['Built', 'Planned', 'Deferred', 'N/A'] as const

interface Row { id: string; requirement: string; status: string; evidence: string; line: number }

function parse(file: string): Row[] {
  const rows: Row[] = []
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((text, i) => {
    if (!/^\|\s*[A-Z]{2,5}-\d{3}\s*\|/.test(text)) return
    const cells = text.split('|').slice(1, -1).map(c => c.trim())
    // | ID | Requirement | Who | Modules | Status | Evidence / decision |
    rows.push({ id: cells[0], requirement: cells[1] || '', status: cells[4] || '', evidence: cells[5] || '', line: i + 1 })
  })
  return rows
}

const ledgers = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('-ledger.md')) : []
const lock: Record<string, string[]> = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : {}

describe('H16 - requirements ledgers', () => {
  it('there is at least one ledger and a lock file (the guard itself works)', () => {
    expect(ledgers.length).toBeGreaterThan(0)
    expect(fs.existsSync(LOCK)).toBe(true)
  })

  for (const name of ledgers) {
    const rows = parse(path.join(DIR, name))
    const where = (r: Row) => `${name}:${r.line} ${r.id}`

    describe(name, () => {
      it('has rows, unique IDs, a requirement and a known status on each', () => {
        expect(rows.length).toBeGreaterThan(0)
        const ids = rows.map(r => r.id)
        expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
        expect(rows.filter(r => r.requirement.length < 10).map(where)).toEqual([])
        expect(rows.filter(r => !(STATUSES as readonly string[]).includes(r.status)).map(r => `${where(r)} status "${r.status}"`)).toEqual([])
      })

      it('Built rows cite real files, including a test or runtime-verify', () => {
        const bad = rows.filter(r => r.status === 'Built').flatMap(r => {
          const paths = [...r.evidence.matchAll(/`([^`]+\.(?:ts|tsx|js|cjs|sql|md|json))(?::\d+(?:-\d+)?)?`/g)].map(m => m[1])
          const missing = paths.filter(p => !fs.existsSync(path.join(ROOT, p)))
          const problems: string[] = []
          if (paths.length === 0) problems.push(`${where(r)}: no file named in evidence`)
          if (missing.length) problems.push(`${where(r)}: files not found ${missing.join(', ')}`)
          if (!paths.some(p => /\.test\.|tests?\/|runtime-verify|e2e\//.test(p))) problems.push(`${where(r)}: no test or runtime-verify cited`)
          return problems
        })
        expect(bad).toEqual([])
      })

      it('Deferred rows say the owner decided and when; N/A rows give a reason', () => {
        const deferred = rows.filter(r => r.status === 'Deferred' && !(/owner/i.test(r.evidence) && /\d{4}-\d{2}-\d{2}/.test(r.evidence)))
        const na = rows.filter(r => r.status === 'N/A' && r.evidence.length < 15)
        expect([...deferred, ...na].map(where)).toEqual([])
      })

      it('no row ever disappears, and every row is in the lock', () => {
        const ids = new Set(rows.map(r => r.id))
        const locked = lock[name] || []
        expect(locked.filter(id => !ids.has(id)).map(id => `${name}: ${id} was removed - change its status instead`)).toEqual([])
        expect(rows.filter(r => !locked.includes(r.id)).map(r => `${where(r)}: add to docs/modules/ledgers.lock.json`)).toEqual([])
      })
    })
  }
})
