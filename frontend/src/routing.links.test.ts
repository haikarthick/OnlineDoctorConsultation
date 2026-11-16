import { describe, it, expect } from 'vitest'

/**
 * Every in-app link must point at a page that exists. A link to a missing route used to land the
 * person on the home page with no explanation (the "unknown address" problem). This reads the
 * route table in App.tsx and every navigate()/to=/href=/menu path in the sources and fails on one
 * that matches no route - so a dead link is caught when it is written, not by a user.
 */
const sources = import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.*', '!./**/*.spec.*', '!./locales/**', '!./test/**'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

const routePatterns = [...sources['./App.tsx'].matchAll(/<Route path="([^"]+)"/g)]
  .map(m => m[1]).filter(r => r !== '*')
  .map(r => new RegExp('^' + r.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*') + '$'))

// Paths that are not pages of this app (sockets, API, files).
const NOT_PAGES = [/^\/ws/, /^\/api\//, /^\/locales\//, /^\/assets\//, /^\/uploads\//]

describe('in-app links', () => {
  it('finds the route table and the sources', () => {
    expect(routePatterns.length).toBeGreaterThan(50)
    expect(Object.keys(sources).length).toBeGreaterThan(100)
  })

  it('every link points at a route that exists', () => {
    const dead: string[] = []
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/(?:navigate\(|to=|path: |href=|Navigate to=)[\s{]*['"`](\/[a-zA-Z0-9\-_/${}.]*)/g)) {
        let p = m[1].replace(/\$\{[^}]*\}/g, 'x').split('?')[0].split('#')[0]
        if (p.length > 1) p = p.replace(/\/$/, '')
        if (p === '/' || NOT_PAGES.some(r => r.test(p))) continue
        if (!routePatterns.some(r => r.test(p))) dead.push(`${file}: ${m[1]}`)
      }
    }
    expect(dead).toEqual([])
  })
})
