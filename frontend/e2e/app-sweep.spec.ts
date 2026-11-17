import { test, expect, request as pwRequest, Page } from '@playwright/test'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * WHOLE-APP SWEEP - harness rules H5 / H6 (docs/HARNESS.md).
 * ──────────────────────────────────────────────────────────
 * Not one page: EVERY route in App.tsx, for every role the gate can sign in as, on a phone and on
 * a desktop. Routes are read from App.tsx at run time, so a page added tomorrow is swept tomorrow
 * with nobody remembering to write a test for it.
 *
 * Per page it checks the things users report and static checks cannot see:
 *   crash            the error boundary or an uncaught exception
 *   console-error    anything the app logged as an error
 *   blank            a signed-in screen that rendered nothing
 *   raw-i18n-key     "farmRecords.kinds.batch" shown instead of words
 *   error-text       "Request failed with status code", [object Object], undefined, NaN ...
 *   overflow         the page scrolls sideways (a phone layout that does not fit)
 * and then USES the page: every tab / chip / toggle is clicked, and after each click
 *   did-nothing      a control that says it is not selected, was clicked, and nothing changed
 *   (plus all the checks above again, because a tab is a different screen)
 * and every invisible native date/time field laid over a styled control must open its picker:
 *   picker-not-opened   (the 2026-11-17 "Other date does nothing" bug)
 *
 * Known problems that existed before the sweep are listed in e2e/sweep-known-issues.json. That list
 * may only SHRINK: a new problem fails the gate, and fixing one means deleting its line.
 * Runs as part of runtime-verify PHASE 7 (tag @critical).
 */

const FRONTEND = process.cwd() // runtime-verify and CI run Playwright from frontend/
const KNOWN_FILE = join(FRONTEND, 'e2e', 'sweep-known-issues.json')
const OUT_DIR = join(FRONTEND, 'test-results')

type Issue = { key: string; message: string }
type Account = { role: string; email: string; password: string }

// ── what to sweep ────────────────────────────────────────────────────────────
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

/** Static routes from App.tsx: no params, no catch-all, no pure redirects. */
function discoverRoutes(): string[] {
  const src = readFileSync(join(FRONTEND, 'src', 'App.tsx'), 'utf8')
  const routes = new Set<string>()
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"([^\n]*)/g)) {
    const [, path, rest] = m
    if (path === '*' || path.includes(':')) continue
    if (/<Navigate\b/.test(rest)) continue
    routes.add(path)
  }
  return [...routes].sort()
}

/** Top-level i18n namespaces ("farmRecords", "nav" ...), read from the English source files. */
function i18nNamespaces(): string[] {
  const dir = join(FRONTEND, 'src', 'locales', 'en', 'modules')
  const names = new Set<string>()
  for (const f of readdirSync(dir)) {
    for (const k of Object.keys(JSON.parse(readFileSync(join(dir, f), 'utf8')))) names.add(k)
  }
  return [...names]
}
const RAW_KEY = new RegExp(`(?<![\\w.@/-])(?:${i18nNamespaces().join('|')})(?:\\.[A-Za-z][A-Za-z0-9_]*)+`, 'g')

const ERROR_TEXT = /Request failed with status code|Network Error|Internal Server Error|\[object Object\]|\bundefined\b|\bNaN\b|Cannot read propert|Minified React error|Unexpected Application Error/
const CRASH_TEXT = /Something went wrong|An unexpected error occurred/

/** Console noise that is not a defect. A thrown TypeError is; a blocked favicon is not. */
const IGNORABLE_CONSOLE = [
  /React Router Future Flag/i, /Download the React DevTools/i, /\[vite\]/i, /favicon/i,
  /Failed to load resource.*40[0-9]/i,   // a refusal the screen explains (and the API logs) is not a crash
  /WebSocket|socket\.io|ERR_CONNECTION|net::ERR/i,
  /Geolocation|Notification|serviceWorker|Service Worker/i,
]

/**
 * Controls a person taps to change what they are looking at - inside the PAGE only. The app shell
 * (menu, bottom tab bar, "+") is identical on every route and navigates away, so tapping it on all
 * ~100 pages would only cost time; the shell is covered by the journeys in critical-journeys.spec.ts.
 */
const CONTROLS = [
  '[role="tab"]', 'button[aria-pressed]', '.choice-chip', 'button[class*="tab"]', 'button[class*="chip"]',
  'button[class*="toggle"]', 'button[class*="filter"]', '.record-kind-tab',
].map(c => `.layout-content ${c}`).join(', ')
const MAX_CONTROLS_PER_PAGE = 8
const SKIP_CONTROL_TEXT = /delete|remove|log ?out|sign ?out|cancel booking|deactivate|suspend|freeze|reject|decline/i

// ── accounts ─────────────────────────────────────────────────────────────────
let mobileSeq = Math.floor(Date.now() / 1000) % 100000000
const uniqueMobile = () => `9${String(mobileSeq++).padStart(9, '0')}`
const UNIQUE = Date.now()

async function apiAccount(baseURL: string, role: 'farmer' | 'pet_owner', tag: string): Promise<{ account: Account; token: string; refresh: string; user: unknown }> {
  const api = await pwRequest.newContext({ baseURL })
  const email = `sweep.${role.replace(/_/g, '.')}.${UNIQUE}.${tag}@example.com`
  const reg = await api.post('/api/v1/auth/register', {
    data: { firstName: 'Sweep', lastName: role.replace(/_/g, ' '), email, phone: uniqueMobile(), password: 'Password1', confirmPassword: 'Password1', role, acceptTerms: true },
  })
  const body = await reg.json()
  expect(body?.success, `could not register a ${role} for the sweep: ${JSON.stringify(body).slice(0, 200)}`).toBe(true)
  await api.dispose()
  return signInApi(baseURL, { role, email, password: 'Password1' })
}

async function signInApi(baseURL: string, account: Account) {
  const api = await pwRequest.newContext({ baseURL })
  const res = await api.post('/api/v1/auth/login', { data: { email: account.email, password: account.password } })
  const body = await res.json()
  await api.dispose()
  const data = body?.data
  expect(data?.token, `the sweep account ${account.role} cannot sign in: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy()
  const user = data.user?.roles?.length ? data.user : { ...data.user, roles: [data.user?.role || account.role] }
  return { account, token: data.token as string, refresh: (data.refreshToken || '') as string, user }
}

/** Extra roles (veterinarian, admin ...) are prepared by runtime-verify, which can activate them in the database. */
function preparedAccounts(): Account[] {
  try { return JSON.parse(process.env.SWEEP_ACCOUNTS || '[]') } catch { return [] }
}

// ── page checks ──────────────────────────────────────────────────────────────
function watch(page: Page) {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!IGNORABLE_CONSOLE.some(re => re.test(text))) errors.push(text.slice(0, 220))
  })
  page.on('pageerror', err => errors.push(`UNCAUGHT: ${err.message}`.slice(0, 220)))
  return errors
}

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.locator('.route-loader, .loading-spinner, [aria-busy="true"]').first()
    .waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => { /* a spinner that never leaves is reported as blank/timeout by the checks */ })
  await page.waitForTimeout(300)
}

const signature = (page: Page) => page.evaluate(() => {
  const h = document.body.innerHTML
  let x = 5381
  for (let i = 0; i < h.length; i++) x = ((x << 5) + x + h.charCodeAt(i)) | 0
  return `${h.length}:${x}:${location.pathname}${location.search}${location.hash}`
})

/** The checks every screen state must pass. `where` says which page and which tap led here. */
async function auditState(page: Page, where: string, viewport: string, route: string, errors: string[], seenErrors: { n: number }, issues: Issue[]) {
  const add = (kind: string, detail: string, message: string) =>
    issues.push({ key: `${kind}|${viewport}|${route}|${detail}`, message: `[${kind}] ${where}: ${message}` })

  if (errors.length > seenErrors.n) {
    add('console-error', 'console', errors.slice(seenErrors.n, seenErrors.n + 2).join(' || '))
    seenErrors.n = errors.length
  }

  const { text, overflow, hasLayout } = await page.evaluate(() => {
    const doc = document.documentElement
    let overflow = ''
    if (doc.scrollWidth > window.innerWidth + 1) {
      let worst: Element | null = null; let worstRight = window.innerWidth + 1
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.right <= worstRight) continue
        let p: Element | null = el.parentElement; let inScroller = false
        while (p && p !== document.body) {
          const ox = getComputedStyle(p).overflowX
          if ((ox === 'auto' || ox === 'scroll' || ox === 'hidden') && p.clientWidth > 0 && p.clientWidth < p.scrollWidth + 1 && p.getBoundingClientRect().right <= window.innerWidth + 1) { inScroller = true; break }
          p = p.parentElement
        }
        if (!inScroller) { worst = el; worstRight = r.right }
      }
      overflow = worst ? `${worst.tagName.toLowerCase()}.${String((worst as HTMLElement).className || '').split(/\s+/)[0] || '-'} reaches ${Math.round(worstRight)}px on a ${window.innerWidth}px screen` : ''
    }
    // Text in code-style elements is a deliberate technical identifier (e.g. the admin settings list shows
    // "grooming.cancellation.freeWindowHours" as the setting's name), not a translation that failed to load.
    let text = document.body.innerText || ''
    for (const el of Array.from(document.querySelectorAll('code, kbd, samp, pre'))) {
      const t = (el as HTMLElement).innerText
      if (t) text = text.split(t).join(' ')
    }
    return { text, overflow, hasLayout: !!document.querySelector('.layout-content') }
  })

  if (CRASH_TEXT.test(text)) add('crash', 'boundary', 'the screen shows the crash page')
  const raw = [...new Set(text.match(RAW_KEY) || [])].slice(0, 3)
  if (raw.length) add('raw-i18n-key', raw[0], `untranslated keys on screen: ${raw.join(', ')}`)
  const bad = text.match(ERROR_TEXT)
  if (bad) add('error-text', bad[0], `shows "${bad[0]}" to the user`)
  if (hasLayout && text.replace(/\s+/g, ' ').trim().length < 30) add('blank', 'empty', 'nothing is shown on the screen')
  if (overflow) add('overflow', overflow.split(' reaches')[0], overflow)
}

/** Every invisible native date/time field must open its picker when its styled stand-in is tapped. */
async function auditPickers(page: Page, viewport: string, route: string, issues: Issue[]) {
  const fields = page.locator('input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"]')
  const count = Math.min(await fields.count(), 6)
  for (let i = 0; i < count; i++) {
    const f = fields.nth(i)
    const hidden = await f.evaluate(el => getComputedStyle(el).opacity === '0' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0).catch(() => false)
    if (!hidden) continue // a visible field is its own control
    const box = await f.boundingBox()
    if (!box) continue
    await f.scrollIntoViewIfNeeded().catch(() => undefined)
    const before = await page.evaluate(() => (window as unknown as { __pickerCalls: number }).__pickerCalls || 0)
    const b2 = await f.boundingBox()
    if (!b2) continue
    await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2)
    const after = await page.evaluate(() => (window as unknown as { __pickerCalls: number }).__pickerCalls || 0)
    const label = await f.evaluate(el => (el.closest('label')?.textContent || el.getAttribute('name') || el.id || 'date field').trim().slice(0, 40))
    if (after <= before) issues.push({ key: `picker-not-opened|${viewport}|${route}|${label}`, message: `[picker-not-opened] ${route}: tapping "${label}" does not open the calendar` })
    await page.keyboard.press('Escape').catch(() => undefined)
  }
}

async function useControls(page: Page, viewport: string, route: string, errors: string[], seenErrors: { n: number }, issues: Issue[]) {
  const total = Math.min(await page.locator(CONTROLS).count(), MAX_CONTROLS_PER_PAGE * 2)
  let clicked = 0
  for (let i = 0; i < total && clicked < MAX_CONTROLS_PER_PAGE; i++) {
    const control = page.locator(CONTROLS).nth(i)
    if (!(await control.isVisible().catch(() => false)) || !(await control.isEnabled().catch(() => false))) continue
    const info = await control.evaluate(el => ({
      text: (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      unselected: el.getAttribute('aria-pressed') === 'false' || el.getAttribute('aria-selected') === 'false',
      isLink: !!el.closest('a'),
    })).catch(() => null)
    if (!info || SKIP_CONTROL_TEXT.test(info.text) || info.isLink) continue

    const before = await signature(page)
    const pathBefore = new URL(page.url()).pathname
    try { await control.click({ timeout: 2_000 }) } catch { continue } // covered or detached: not this check's business
    clicked++
    await page.waitForTimeout(150)
    const after = await signature(page)
    const name = info.text || `control ${i + 1}`
    if (info.unselected && before === after) {
      issues.push({ key: `did-nothing|${viewport}|${route}|${name}`, message: `[did-nothing] ${route}: tapping "${name}" changed nothing on screen` })
    }
    await auditState(page, `${route} after tapping "${name}"`, viewport, route, errors, seenErrors, issues)
    if (new URL(page.url()).pathname !== pathBefore) { // the tap navigated away: come back
      await page.goto(route, { waitUntil: 'domcontentloaded' }); await settle(page)
    }
  }
}

function loadKnown(): Set<string> {
  try { return new Set(JSON.parse(readFileSync(KNOWN_FILE, 'utf8')).issues as string[]) } catch { return new Set() }
}

// ── the sweep ────────────────────────────────────────────────────────────────
// SWEEP_ROUTES (comma list, prefix match) and SWEEP_ROLES narrow a run while developing; the gate runs everything.
const ONLY_ROUTES = (process.env.SWEEP_ROUTES || '').split(',').map(x => x.trim()).filter(Boolean)
const ROUTES = discoverRoutes().filter(r => !ONLY_ROUTES.length || ONLY_ROUTES.some(p => r.startsWith(p)))
const ONLY_ROLES = (process.env.SWEEP_ROLES || '').split(',').map(x => x.trim()).filter(Boolean)
const progress = (line: string) => { try { mkdirSync(OUT_DIR, { recursive: true }); appendFileSync(join(OUT_DIR, 'app-sweep-progress.log'), `${line}\n`) } catch { /* best effort */ } }

test.describe('@critical app sweep', () => {
  // Independent and read-only, so safe to parallelise with --workers (accounts are per worker) - but the
  // gate runs ONE worker: 3 browsers at once starved the throwaway Postgres on Windows and froze the server.
  test.describe.configure({ mode: 'parallel' })

  let sessions: Array<{ account: Account; token: string; refresh: string; user: unknown }> = []

  test.beforeAll(async ({ baseURL }, testInfo) => {
    const base = baseURL || 'http://127.0.0.1:3000'
    const tag = `w${testInfo.workerIndex}`
    mobileSeq += testInfo.workerIndex * 1_000_000 // mobile numbers are unique per account; keep workers apart
    sessions = [await apiAccount(base, 'farmer', tag), await apiAccount(base, 'pet_owner', tag)]
    for (const a of preparedAccounts()) sessions.push(await signInApi(base, a))
  })

  test('the sweep discovers the whole route table', () => {
    // A parse that silently found nothing would turn every sweep below into a green no-op.
    expect(ROUTES.length, 'routes found in App.tsx').toBeGreaterThan(ONLY_ROUTES.length ? 0 : 60)
    expect(i18nNamespaces().length).toBeGreaterThan(30)
  })

  for (const vp of VIEWPORTS) {
    for (const role of ['farmer', 'pet_owner', 'veterinarian', 'admin', 'corporate_admin']) {
      test(`${role} on a ${vp.name}: every screen renders, fits, and every tab works`, async ({ browser }) => {
        const session = sessions.find(s => s.account.role === role)
        test.skip(!session || (ONLY_ROLES.length > 0 && !ONLY_ROLES.includes(role)), `no ${role} account was prepared (runs inside the runtime gate only)`)
        test.setTimeout(25 * 60_000)

        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.name === 'phone' })
        await context.addInitScript(({ token, refresh, user }) => {
          try {
            localStorage.setItem('authToken', token)
            localStorage.setItem('authUser', JSON.stringify(user))
            if (refresh) localStorage.setItem('refreshToken', refresh)
          } catch { /* storage unavailable */ }
          // Count calendar openings so an invisible date field that never opens one is caught.
          const w = window as unknown as { __pickerCalls: number }
          w.__pickerCalls = 0
          const original = HTMLInputElement.prototype.showPicker
          HTMLInputElement.prototype.showPicker = function (this: HTMLInputElement) {
            w.__pickerCalls++
            try { return original?.call(this) } catch { /* needs a user gesture; the call is what we count */ }
          }
        }, { token: session!.token, refresh: session!.refresh, user: session!.user })

        const page = await context.newPage()
        const errors = watch(page)
        const seen = { n: 0 }
        const issues: Issue[] = []

        for (const route of ROUTES) {
          const t0 = Date.now(); let tLoad = 0; let tPick = 0
          for (let attempt = 1; attempt <= 2; attempt++) try {
            await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 })
            await settle(page)
            tLoad = Date.now() - t0
            const landed = new URL(page.url()).pathname
            // A page this role may not open explains itself and is swept as that explanation; a
            // sign-in screen here would mean the sweep's own session broke.
            if (landed === '/login') { issues.push({ key: `session|${vp.name}|${route}|signed-out`, message: `[session] ${route}: the signed-in session was lost` }); continue }
            await auditState(page, route, vp.name, route, errors, seen, issues)
            await auditPickers(page, vp.name, route, issues)
            tPick = Date.now() - t0 - tLoad
            await useControls(page, vp.name, route, errors, seen, issues)
            break
          } catch (e) {
            // A screen that redirects after it loads (e.g. "/") can destroy the page under the check: look again once.
            if (attempt === 1 && /Execution context was destroyed|Target page, context or browser has been closed/.test((e as Error).message) === true && !page.isClosed()) { await page.waitForTimeout(500); continue }
            issues.push({ key: `sweep-error|${vp.name}|${route}|exception`, message: `[sweep-error] ${route}: ${(e as Error).message.split('\n')[0]}` })
          }
          progress(`${role} ${vp.name} ${route} ${((Date.now() - t0) / 1000).toFixed(1)}s (load ${(tLoad / 1000).toFixed(1)} audit ${(tPick / 1000).toFixed(1)}) issues=${issues.length}`)
        }
        await context.close()

        // Keep the full list so a baseline can be (re)built from a real run.
        try {
          mkdirSync(OUT_DIR, { recursive: true })
          writeFileSync(join(OUT_DIR, `app-sweep-${role}-${vp.name}.json`), JSON.stringify(issues, null, 2))
        } catch { /* best effort */ }

        const known = loadKnown()
        const fresh = issues.filter(i => !known.has(i.key))
        const unique = [...new Map(fresh.map(i => [i.key, i])).values()]
        expect(unique.map(i => i.message), `${unique.length} new problem(s) for ${role} on a ${vp.name} (${ROUTES.length} screens swept). Fix them, or - only for a problem that already existed - add its key to e2e/sweep-known-issues.json:\n`).toEqual([])
      })
    }
  }
})
