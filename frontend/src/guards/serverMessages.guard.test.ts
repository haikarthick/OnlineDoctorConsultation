import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * A refusal the server sends with a code (CodedError, the pharmacy and role refusals) is shown in the person's own language from
 * `serverMessages.<CODE>`. This guard keeps the two sides together: every code the backend can send has a sentence in all six
 * locales, and no sentence is left without a sender (so nothing rots).
 */
const BACKEND_SRC = path.resolve(__dirname, '../../../backend/src')
const LOCALES = ['en', 'hi', 'kn', 'ml', 'ta', 'te']
const CODE = /['"`]((?:WD|RX|PH|WI|HN)_[A-Z0-9_]+|FORBIDDEN_ROLE)['"`]/g

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

function sentCodes(): Set<string> {
  const codes = new Set<string>()
  for (const file of walk(BACKEND_SRC)) {
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(CODE)) codes.add(m[1])
  }
  return codes
}

const messagesOf = (lang: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../locales/${lang}/modules/serverMessages.json`), 'utf8')).serverMessages

describe('serverMessages - every coded refusal is translated', () => {
  const sent = sentCodes()

  it('the backend sends codes at all (the scan is not silently empty)', () => {
    expect(sent.size).toBeGreaterThan(20)
  })

  it.each(LOCALES)('%s has a sentence for every code the server sends', lang => {
    const have = messagesOf(lang)
    expect([...sent].filter(c => !(c in have)).sort()).toEqual([])
  })

  it.each(LOCALES)('%s has no sentence nobody sends', lang => {
    expect(Object.keys(messagesOf(lang)).filter(c => !sent.has(c)).sort()).toEqual([])
  })

  it('every translation keeps the same {{values}} as English', () => {
    const en = messagesOf('en')
    const vars = (s: string) => (s.match(/\{\{\w+\}\}/g) || []).sort().join(',')
    for (const lang of LOCALES) {
      const have = messagesOf(lang)
      for (const code of Object.keys(en)) expect([lang, code, vars(have[code] || '')]).toEqual([lang, code, vars(en[code])])
    }
  })
})
