import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ModulePage.css is imported only by some pages, so the phone layout of `.module-header` must also be in the always-loaded
// modules.css. Master Data did not import ModulePage.css and kept the desktop row on a phone (title squeezed to ~100px).
describe('module header on a phone', () => {
  it('stacks the title above its text in the always-loaded stylesheet', () => {
    const css = readFileSync(resolve(__dirname, 'modules.css'), 'utf8').replace(/\r\n/g, '\n')
    const media = css.match(/@media \(max-width: 768px\) \{\n\s*\.module-header \{[^}]*flex-direction: column/)
    expect(media).not.toBeNull()
  })
})
