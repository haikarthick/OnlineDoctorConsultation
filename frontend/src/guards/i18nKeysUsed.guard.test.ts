import { describe, it, expect } from 'vitest'

/**
 * HARNESS RULE H3 - a translation key used in code must exist.
 *
 * `localeParity.test.ts` proves the six languages have the same keys. It cannot see a key that is
 * missing from ALL of them, which is how a person ends up reading "farmRecords.kinds.batch" on a
 * button. Here every literal `t('a.b.c')` in the app is checked against the English files (English
 * is the fallback language, so a key missing there is missing everywhere).
 *
 * Dynamic keys (`t(`x.${y}`)`) cannot be checked statically; the browser sweep
 * (e2e/app-sweep.spec.ts) looks for leaked keys on every screen to cover those.
 */
const sources = import.meta.glob(
  ['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../locales/**', '!../test/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const en = import.meta.glob('../locales/en/modules/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>

const known = new Set<string>()
function collect(node: unknown, prefix: string) {
  if (!node || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    known.add(key) // objects and arrays count too: t('x', { returnObjects: true }) reads them whole
    collect(v, key)
  }
}
for (const file of Object.values(en)) collect(file, '')

const exists = (key: string) =>
  known.has(key) || known.has(`${key}_one`) || known.has(`${key}_other`) || known.has(`${key}_zero`)

// t('some.key') / t("some.key") with a literal first argument that looks like a dotted key.
const CALL = /(?<![A-Za-z0-9_.$])t\(\s*(['"])([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)\1/g

describe('translation keys used in code', () => {
  it('reads the English files and the app sources', () => {
    expect(known.size).toBeGreaterThan(5000)
    expect(Object.keys(sources).length).toBeGreaterThan(300)
  })

  it('every literal t("key") exists in English', () => {
    const missing: string[] = []
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(CALL)) {
        const key = m[2]
        // A call that supplies its own defaultValue is allowed to be absent from the files.
        const rest = src.slice(m.index!, m.index! + 240).split(/\)\s*[;,}\]:?|&)]/)[0]
        if (/defaultValue/.test(rest)) continue
        if (!exists(key)) {
          const line = src.slice(0, m.index).split('\n').length
          missing.push(`${file.replace('../', 'src/')}:${line}  ${key}`)
        }
      }
    }
    expect(missing, `Keys used in code but missing from locales/en/modules/*.json:\n${missing.join('\n')}`).toEqual([])
  })
})
