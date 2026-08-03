import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Locale parity guard.
 *
 * Two failures this pins, both of which shipped and were invisible to tsc,
 * eslint, vitest and the e2e suite because a missing translation renders as a
 * raw key rather than throwing:
 *
 *   - groomingEarnings.statement / .viewStatement / .statementTitle were used by
 *     GroomingEarnings.tsx but present in NO locale, so that column header,
 *     button and modal title showed literal dotted keys in every language.
 *   - vaccineProtocol.status and .category were plain STRINGS in kn and te where
 *     en has nested objects, so t('vaccineProtocol.status.active') and the five
 *     sibling keys could not resolve at all on the Vaccine Protocol admin page.
 *
 * Edit src/locales — public/locales is generated from it by copy-locales.cjs.
 */

const LOCALES_DIR = path.resolve(__dirname, '../locales')
const SRC_DIR = path.resolve(__dirname, '..')
const LOCALES = ['en', 'hi', 'kn', 'ml', 'ta', 'te'] as const

// i18next resolves `key` against key_one/key_other/... when a count is passed.
const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many']

type Flat = Record<string, unknown>

function flatten(obj: Record<string, unknown>, prefix = '', out: Flat = {}): Flat {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out)
    else out[key] = v
  }
  return out
}

function load(locale: string): Flat {
  return flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, locale, 'translation.json'), 'utf8')))
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'locales' && entry.name !== 'node_modules' && entry.name !== 'test') sourceFiles(p, acc)
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      acc.push(p)
    }
  }
  return acc
}

const catalogs = Object.fromEntries(LOCALES.map(l => [l, load(l)])) as Record<string, Flat>
const enKeys = new Set(Object.keys(catalogs.en))

describe('locale parity', () => {
  it('every locale defines exactly the keys en defines', () => {
    const missingByLocale: Record<string, string[]> = {}
    for (const locale of LOCALES.filter(l => l !== 'en')) {
      const keys = new Set(Object.keys(catalogs[locale]))
      const missing = [...enKeys].filter(k => !keys.has(k))
      if (missing.length) missingByLocale[locale] = missing.slice(0, 20)
    }
    expect(missingByLocale).toEqual({})
  })

  it('no locale turns a nested group into a bare string (or vice versa)', () => {
    // The kn/te vaccineProtocol bug: a parent key holding a string in one locale
    // and an object in another makes every child key unresolvable there.
    const conflicts: string[] = []
    for (const locale of LOCALES.filter(l => l !== 'en')) {
      for (const key of Object.keys(catalogs[locale])) {
        // A leaf here that is a PARENT of some en key means en nests where this
        // locale does not.
        if (!enKeys.has(key) && [...enKeys].some(en => en.startsWith(key + '.'))) {
          conflicts.push(`${locale}: "${key}" is a string but en nests keys under it`)
        }
      }
    }
    expect(conflicts).toEqual([])
  })
})

describe('translation keys used in source', () => {
  const used = new Map<string, string[]>()
  const re = /\bt\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g

  for (const file of sourceFiles(SRC_DIR)) {
    const src = fs.readFileSync(file, 'utf8')
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const key = m[1]
      // Trailing dot means the call builds the key from a variable
      // (`t('x.statuses.' + s)`) — the literal prefix is not a key itself.
      if (key.endsWith('.') || !key.includes('.')) continue
      if (!used.has(key)) used.set(key, [])
      used.get(key)!.push(path.relative(SRC_DIR, file).replace(/\\/g, '/'))
    }
  }

  it('resolves against the en catalogue', () => {
    const missing = [...used.keys()]
      .filter(k => !enKeys.has(k) && !PLURAL_SUFFIXES.some(s => enKeys.has(k + s)))
      .map(k => `${k}  <- ${[...new Set(used.get(k)!)].slice(0, 2).join(', ')}`)
    expect(missing).toEqual([])
  })

  it('found a meaningful number of keys (the scanner still works)', () => {
    // Guards against the regex silently matching nothing after a refactor,
    // which would make the test above pass vacuously.
    expect(used.size).toBeGreaterThan(1000)
  })
})
