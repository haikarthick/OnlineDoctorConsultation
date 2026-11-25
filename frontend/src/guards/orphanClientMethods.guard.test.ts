import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * HARNESS RULE H17 - no client method without a screen (counterpart of backend/tests/unit/orphans.guard.test.ts).
 *
 * Every method of the API client (`services/api/modules/*.ts`) must be called by something else in `src`. A method nobody calls is a
 * feature without a screen or dead code. `orphanClientMethods.allowlist.json` is the register of methods with no caller today; it may
 * only SHRINK: a new uncalled method fails, and an allowlisted method that now has a caller (or is gone) fails too, so the entry
 * is deleted, never left to rot.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODULES = path.join(SRC, 'services', 'api', 'modules')
const ALLOWLIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'orphanClientMethods.allowlist.json')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'locales') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

function findOrphans(): string[] {
  const methods: Array<{ name: string; file: string }> = []
  for (const f of fs.readdirSync(MODULES).filter(n => n.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(MODULES, f), 'utf8')
    for (const m of src.matchAll(/^\s{2}(?:async\s+)?([a-zA-Z0-9_]+)\s*(?:\(|:\s*(?:async\s*)?\()/gm)) {
      if (!['constructor', 'if', 'for', 'switch', 'return'].includes(m[1])) methods.push({ name: m[1], file: f })
    }
  }
  const all = walk(SRC).filter(f => !f.includes(`${path.sep}guards${path.sep}`))
  const texts = all.map(f => ({ f, s: fs.readFileSync(f, 'utf8') }))
  const orphans: string[] = []
  for (const { name, file } of methods) {
    const re = new RegExp(`(?:\\.|\\b)${name}\\b\\s*(?:\\(|[,)}\\]]|\\?)`)
    const used = texts.some(({ f, s }) => (f.includes(`${path.sep}modules${path.sep}${file}`) ? false : re.test(s)) || (f.includes(`${path.sep}modules${path.sep}${file}`) && new RegExp(`this\\.${name}\\b`).test(s)))
    if (!used) orphans.push(`${file}:${name}`)
  }
  return [...new Set(orphans)].sort()
}

describe('orphan guard (H17): every client method has a screen that calls it', () => {
  const allow: string[] = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8')).methods
  const orphans = findOrphans()

  it('no new client method ships without a caller', () => {
    expect(orphans.filter(o => !allow.includes(o))).toEqual([])
  })

  it('the allowlist only shrinks: remove an entry once its method has a caller or is deleted', () => {
    expect(allow.filter(a => !orphans.includes(a))).toEqual([])
  })

  if (process.env.WRITE_ORPHAN_ALLOWLIST === '1') {
    it('writes the allowlist', () => {
      fs.writeFileSync(ALLOWLIST, JSON.stringify({ note: 'Client methods with no caller. May only shrink (H17). See docs/modules/orphans-ledger.md.', methods: orphans }, null, 2) + '\n')
    })
  }
})
