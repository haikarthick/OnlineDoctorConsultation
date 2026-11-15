import { describe, it, expect } from 'vitest'

/**
 * The farm profile resolver exists twice on purpose - the backend validates writes with it and
 * the frontend shows/hides with it (see the header of resolveFarmProfile.ts). If the two copies
 * drift, a screen offers something the server then refuses, and no type check, lint or build
 * can see that. This test is the gate: the two files must be identical, byte for byte.
 *
 * To change the resolver: edit one copy, copy it over the other, run this test.
 * Behaviour is tested once, in backend/tests/unit/FarmProfileResolver.test.ts.
 *
 * Uses import.meta.glob (not fs/path) because the frontend deliberately has no Node typings.
 */
const frontendCopy = import.meta.glob('./resolveFarmProfile.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const backendCopy = import.meta.glob('../../../../backend/src/services/farmProfile/resolveFarmProfile.ts', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

const normalise = (text: string) => text.replace(/\r\n/g, '\n')

describe('farm profile resolver: backend and frontend copies', () => {
  it('found both files (the globs still match)', () => {
    expect(Object.keys(frontendCopy)).toHaveLength(1)
    expect(Object.keys(backendCopy)).toHaveLength(1)
  })

  it('are identical', () => {
    const fe = normalise(Object.values(frontendCopy)[0])
    const be = normalise(Object.values(backendCopy)[0])
    expect(fe.length).toBeGreaterThan(1000)
    expect(fe === be).toBe(true)
  })
})
