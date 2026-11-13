import { describe, it, expect } from 'vitest'

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
 * Uses import.meta.glob rather than fs/path so it needs no @types/node - the
 * frontend deliberately does not depend on Node typings.
 *
 * Edit src/locales/<lang>/modules/*.json - public/locales is generated from it by
 * copy-locales.cjs (and the English bundle is merged the same way in src/i18n/index.ts).
 * Each locale used to be one ~8,400-line translation.json; it's split by module now
 * purely for editability, so this test reads the split files and merges them itself.
 */

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

const localeModules = import.meta.glob('../locales/*/modules/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>

// Merge each locale's module files into one object first, so a key duplicated across
// two module files in the same locale fails loudly here rather than silently letting
// one file's copy of the key win.
const merged: Record<string, Record<string, unknown>> = {}
for (const [filePath, mod] of Object.entries(localeModules)) {
  const parts = filePath.split('/')
  const locale = parts[parts.length - 3]
  const moduleFile = parts[parts.length - 1]
  merged[locale] ??= {}
  for (const key of Object.keys(mod.default)) {
    if (Object.prototype.hasOwnProperty.call(merged[locale], key)) {
      throw new Error(`Duplicate top-level key "${key}" in ${locale}/modules/${moduleFile} - already defined by another module file for this locale.`)
    }
    merged[locale][key] = mod.default[key]
  }
}

const catalogs: Record<string, Flat> = {}
for (const [locale, data] of Object.entries(merged)) {
  catalogs[locale] = flatten(data)
}

const enKeys = new Set(Object.keys(catalogs.en ?? {}))

// Every .ts/.tsx under src as raw text, so the t() call sites can be scanned.
const sources = import.meta.glob('../**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

describe('locale catalogues', () => {
  it('loaded every expected locale', () => {
    expect(Object.keys(catalogs).sort()).toEqual([...LOCALES].sort())
    expect(enKeys.size).toBeGreaterThan(1000)
  })

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
    const enKeyList = [...enKeys]
    for (const locale of LOCALES.filter(l => l !== 'en')) {
      for (const key of Object.keys(catalogs[locale])) {
        if (!enKeys.has(key) && enKeyList.some(en => en.startsWith(key + '.'))) {
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

  for (const [filePath, src] of Object.entries(sources)) {
    if (/\.test\./.test(filePath) || filePath.includes('/locales/')) continue
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(src))) {
      const key = m[1]
      // A trailing dot means the call builds the key from a variable
      // (`t('x.statuses.' + s)`) - the literal prefix is not a key itself.
      if (key.endsWith('.') || !key.includes('.')) continue
      if (!used.has(key)) used.set(key, [])
      used.get(key)!.push(filePath)
    }
  }

  it('found a meaningful number of keys (the scanner still works)', () => {
    // Guards against the regex or the glob silently matching nothing after a
    // refactor, which would make the assertion below pass vacuously.
    expect(used.size).toBeGreaterThan(1000)
  })

  it('resolves every one of them against the en catalogue', () => {
    const missing = [...used.keys()]
      .filter(k => !enKeys.has(k) && !PLURAL_SUFFIXES.some(s => enKeys.has(k + s)))
      .map(k => `${k}  <- ${[...new Set(used.get(k)!)].slice(0, 2).join(', ')}`)
    expect(missing).toEqual([])
  })
})
