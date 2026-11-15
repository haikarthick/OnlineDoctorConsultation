import { describe, it, expect } from 'vitest'

/**
 * Phone keypad gate: every <input type="number"> must say which keypad to open.
 *
 * Without `inputMode`, a phone opens the full letter keyboard for a litres or weight field -
 * slow, and a mistake-maker on a cheap phone held in one hand. This was missing on all 142
 * numeric inputs in the app until 2026-11-15; this test keeps it from creeping back. It reads
 * the source text, because nothing else (tsc, lint, build) notices a missing attribute.
 *
 * Use inputMode="numeric" for whole numbers (counts) and "decimal" for anything that can have a
 * fraction (litres, kg, money). For a quantity entered at the animal, prefer <NumberStepper>.
 */
const sources = import.meta.glob('../**/*.tsx', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

describe('numeric inputs open the right keypad', () => {
  it('found the source files (the glob still matches)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100)
  })

  it('every type="number" input declares inputMode', () => {
    const missing: string[] = []
    for (const [file, src] of Object.entries(sources)) {
      if (/\.test\./.test(file)) continue
      for (const m of src.matchAll(/type=["']number["']/g)) {
        const start = src.lastIndexOf('<input', m.index)
        const end = src.indexOf('/>', m.index!)
        const tag = start >= 0 && end >= 0 ? src.slice(start, end + 2) : ''
        if (!/\binputMode=/.test(tag)) {
          missing.push(`${file.replace('../', 'src/')}:${src.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
