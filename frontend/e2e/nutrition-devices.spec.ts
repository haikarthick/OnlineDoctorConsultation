import { test, expect, request as pwRequest, Page, Locator, BrowserContext } from '@playwright/test'
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * NUTRITION ACROSS DEVICES (@nutrition-devices) - runs inside runtime-verify PHASE 7 (VERIFY_E2E_GREP='@critical|@nutrition-devices').
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 * The fixtures (a dog with a plan and an alert, a farm cow with a ration, a cow whose ration waits for a vet, a pig group over
 * 221 days, the four accounts) are built by runtime-verify PHASE 6m and handed over as NUTRI_FIXTURES. Without them (a plain
 * `playwright test` against a dev server) the whole file skips.
 *
 * For farmer, pet owner, veterinarian and admin, at phone 360x740, tablet 768x1024 and desktop 1366x768, it opens every nutrition
 * surface the person can reach and checks, per screen: sideways page scroll, tap targets >= 44x44 on the phone, clipped text,
 * raw translation keys, visible HTTP codes / "Request failed", keyboard focus visibility, and for the bottom sheet: it fits the
 * viewport, its main button is on screen, Escape closes it and focus returns to what opened it. A second pass switches the app to
 * hi / kn / ml / ta / te on the phone and lists text that is still plain English. Then a Fast-3G loading check and an offline check.
 *
 * Findings are written to <NUTRI_SHOTS_DIR>/findings.jsonl with a full-page screenshot per role / viewport / screen.
 */

type Role = 'farmer' | 'pet_owner' | 'veterinarian' | 'admin'
interface Fixtures {
  accounts: Record<Role, { email: string; password: string }>
  dogId?: string; cowId?: string; ownerCowId?: string; pendingCowId?: string; pigGroupId?: string; pigGroupName?: string
}
const FX: Fixtures | null = (() => { try { return JSON.parse(process.env.NUTRI_FIXTURES || 'null') } catch { return null } })()
const OUT = process.env.NUTRI_SHOTS_DIR || join(process.cwd(), 'test-results', 'nutrition-devices')
const FINDINGS = join(OUT, 'findings.jsonl')

const VIEWPORTS = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
] as const
const ROLES: Role[] = ['farmer', 'pet_owner', 'veterinarian', 'admin']
const LOCALES = ['hi', 'kn', 'ml', 'ta', 'te'] as const

type Finding = { role: string; viewport: string; screen: string; lang: string; kind: string; detail: string }
const allFindings: Finding[] = []
function note(f: Finding) { allFindings.push(f); try { appendFileSync(FINDINGS, JSON.stringify(f) + '\n') } catch { /* best effort */ } }

// ── sessions ─────────────────────────────────────────────────────────────────
async function signIn(baseURL: string, role: Role) {
  const api = await pwRequest.newContext({ baseURL })
  const res = await api.post('/api/v1/auth/login', { data: FX!.accounts[role] })
  const body = await res.json()
  await api.dispose()
  const data = body?.data
  expect(data?.token, `the ${role} fixture account cannot sign in: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy()
  const user = data.user?.roles?.length ? data.user : { ...data.user, roles: [data.user?.role || role] }
  return { token: data.token as string, refresh: (data.refreshToken || '') as string, user }
}

async function newContext(browser: import('@playwright/test').Browser, vp: { width: number; height: number; name: string }, session: Awaited<ReturnType<typeof signIn>>, lang?: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.name === 'phone', isMobile: vp.name === 'phone' })
  await context.addInitScript(({ token, refresh, user, lang }) => {
    try {
      localStorage.setItem('authToken', token)
      localStorage.setItem('authUser', JSON.stringify(user))
      if (refresh) localStorage.setItem('refreshToken', refresh)
      if (lang) localStorage.setItem('vetcare_language', lang)
    } catch { /* storage unavailable */ }
  }, { token: session.token, refresh: session.refresh, user: session.user, lang: lang || '' })
  return context
}

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.locator('.route-loader, .loading-spinner, [aria-busy="true"]').first()
    .waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { /* reported by the checks as missing content */ })
  await page.waitForTimeout(400)
}

// ── the audit, run inside the page ───────────────────────────────────────────
interface AuditResult {
  hscroll: string
  hits: Array<{ scope: 'content' | 'shell'; sel: string; w: number; h: number }>
  clipped: string[]
  rawKeys: string[]
  codes: string[]
  english: string[]
}

async function audit(page: Page, phone: boolean, wantEnglish: boolean): Promise<AuditResult> {
  return page.evaluate(({ phone, wantEnglish }) => {
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0 && !el.closest('[aria-hidden="true"]')
    }
    const sel = (el: Element) => {
      const c = String((el as HTMLElement).className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.')
      const t = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30)
      return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${t ? ` "${t}"` : ''}`
    }
    const out: AuditResult = { hscroll: '', hits: [], clipped: [], rawKeys: [], codes: [], english: [] }
    const se = document.scrollingElement as HTMLElement
    if (se.scrollWidth > se.clientWidth + 1) {
      let worst: Element | null = null; let right = 0
      document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.right > right && vis(el)) { right = r.right; worst = el } })
      out.hscroll = `page is ${se.scrollWidth}px wide on a ${se.clientWidth}px screen; widest: ${worst ? sel(worst) : '?'} reaches ${Math.round(right)}px`
    }
    if (phone) {
      const targets = document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=switch], summary')
      targets.forEach(el => {
        if (!vis(el)) return
        const r = el.getBoundingClientRect()
        // a checkbox / radio wrapped in a label is tapped through the label
        const wrap = (el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio' ? el.closest('label') : null
        const box = wrap ? wrap.getBoundingClientRect() : r
        if (box.width >= 43.5 && box.height >= 43.5) return
        if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) return
        out.hits.push({ scope: el.closest('.layout-content, [role=dialog], .bottom-sheet') ? 'content' : 'shell', sel: sel(el), w: Math.round(box.width), h: Math.round(box.height) })
      })
    }
    const scope = document.querySelectorAll('.layout-content *, [role=dialog] *')
    scope.forEach(el => {
      const cs = getComputedStyle(el); const h = el as HTMLElement
      if (!(cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis')) return
      if (!vis(el) || !(h.innerText || '').trim()) return
      if (h.scrollWidth > h.clientWidth + 1 && h.clientWidth > 0) out.clipped.push(`${sel(el)} (text is ${h.scrollWidth}px in a ${h.clientWidth}px box)`)
    })
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const NS = /\b(nutrition|farmRecords|animalGroups|dashboard|mobileUi|common|nav|animals|serverMessages)\.[A-Za-z_][A-Za-z0-9_.]*/
    const ASCII_WORD = /[A-Za-z]{3,}/
    const SKIP = /^(kg|kcal|ml|l|g|inr|ok|cm|mg)$/i
    let node: Node | null
    while ((node = walker.nextNode())) {
      const parent = node.parentElement
      if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(parent.tagName) || !vis(parent)) continue
      const text = (node.textContent || '').trim().replace(/\s+/g, ' ')
      if (!text) continue
      if (/^[a-z]+(\.[A-Za-z_]+)+$/.test(text) || NS.test(text)) out.rawKeys.push(text.slice(0, 80))
      if (/\b(404|403|500)\b(?![.,]?\d)(?!\s?(kcal|kg|g\b|ml|L\b|%|₹))|Request failed|status code|Network Error/i.test(text)) out.codes.push(text.slice(0, 100))
      if (wantEnglish && /^[ -~]*$/.test(text) && ASCII_WORD.test(text) && !/Verify|@|Nm |^[\d\s.,:/%+-]*$/.test(text)
          && !text.split(/[\s/·•|:-]+/).every(w => !w || SKIP.test(w) || !ASCII_WORD.test(w))) out.english.push(text.slice(0, 80))
    }
    return out
  }, { phone, wantEnglish })
}

/** Keyboard focus must be visible: tab through the page content and report anything focused with no outline / ring. */
async function focusAudit(page: Page): Promise<string[]> {
  const bad: string[] = []
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); document.querySelector<HTMLElement>('.layout-content')?.focus?.() })
  const first = page.locator('.layout-content button, .layout-content a[href], .layout-content input, .layout-content select').first()
  if (await first.count()) await first.focus().catch(() => undefined)
  for (let i = 0; i < 4; i++) {
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body || !el.closest('.layout-content, [role=dialog]')) return null
      const cs = getComputedStyle(el)
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none')
      const name = `${el.tagName.toLowerCase()}.${String(el.className || '').split(/\s+/)[0]} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`
      return { ring: !!ring, name }
    })
    if (r && !r.ring) bad.push(r.name)
    await page.keyboard.press('Tab')
  }
  return [...new Set(bad)]
}

async function sheetAudit(page: Page, opener: Locator, vp: { width: number; height: number }): Promise<string[]> {
  const issues: string[] = []
  await opener.evaluate(el => el.setAttribute('data-qa-opener', '1'))
  await opener.click()
  const dlg = page.locator('[role="dialog"]').first()
  await dlg.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined)
  if (!(await dlg.count())) return ['the sheet did not open']
  await page.waitForTimeout(500)
  const box = await dlg.boundingBox()
  if (!box) issues.push('the sheet has no size')
  else {
    if (box.x < -1 || box.y < -1 || box.x + box.width > vp.width + 1 || box.y + box.height > vp.height + 1) issues.push(`the sheet does not fit the screen: ${JSON.stringify({ x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) })} on ${vp.width}x${vp.height}`)
  }
  const primary = dlg.locator('.btn-primary').last()
  if (await primary.count()) {
    const pb = await primary.boundingBox()
    if (!pb || pb.y + pb.height > vp.height + 1 || pb.y < 0) issues.push(`the sheet's main button is not on screen without scrolling (y ${pb ? Math.round(pb.y) : '?'}..${pb ? Math.round(pb.y + pb.height) : '?'} of ${vp.height})`)
  } else issues.push('the sheet has no primary (.btn-primary) button')
  return issues
}

async function sheetEscape(page: Page): Promise<string[]> {
  const issues: string[] = []
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  if (await page.locator('[role="dialog"]').count()) issues.push('Escape did not close the sheet')
  else {
    const back = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-qa-opener') === '1')
    if (!back) issues.push('after Escape, focus did not return to the button that opened the sheet')
  }
  return issues
}

// ── screens ─────────────────────────────────────────────────────────────────
interface Ctx { page: Page; role: Role; vp: typeof VIEWPORTS[number]; lang: string; phone: boolean }
type Screen = { id: string; roles: Role[]; run: (c: Ctx, check: (label: string, extra?: () => Promise<string[]>) => Promise<void>) => Promise<void> }

async function chooseTab(page: Page, index: number) {
  const chips = page.locator('.nutri-panel .choice-chip')
  await chips.nth(index).waitFor({ state: 'visible', timeout: 15_000 })
  await chips.nth(index).click()
  await page.waitForTimeout(500)
}

async function openNutrition(page: Page, animalId: string) {
  await page.goto(`/nutrition?animal=${animalId}`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.locator('.nutri-panel').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined)
}

function screens(): Screen[] {
  const dog = FX?.dogId as string, cow = FX?.cowId as string, ownCow = FX?.ownerCowId as string, pending = FX?.pendingCowId as string
  const TABS = ['today', 'plan', 'body', 'safe']
  const list: Screen[] = [
    { id: 'dashboard', roles: ['farmer', 'pet_owner', 'veterinarian', 'admin'], run: async ({ page }, check) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page)
      await page.locator('.dashboard-section').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined)
      await check('dashboard (nutrition summary card)')
    } },
    // a dog's panel: owner, booked vet and admin read it; the farmer is not on it and must be told why in words
    ...TABS.map((tab, i): Screen => ({ id: `dog-${tab}`, roles: ['pet_owner', 'veterinarian', 'admin', 'farmer'], run: async ({ page }, check) => {
      await openNutrition(page, dog); await chooseTab(page, i).catch(() => undefined)
      await check(`dog panel, ${tab} tab`)
    } })),
    { id: 'cow-ration-sheet', roles: ['farmer', 'veterinarian', 'admin'], run: async ({ page, vp, phone }, check) => {
      await openNutrition(page, cow); await chooseTab(page, 1).catch(() => undefined)
      const opener = page.locator('.nutri-tab button.nutri-wide-btn').first()
      await check('cow Plan tab (ration)')
      if (!(await opener.count())) { note({ role: '', viewport: vp.name, screen: 'cow-ration-sheet', lang: '', kind: 'sheet', detail: 'no ration button on the cow Plan tab' }); return }
      await check('cow ration builder sheet', async () => sheetAudit(page, opener, vp))
      await check('cow ration sheet, Escape', async () => sheetEscape(page))
      void phone
    } },
    { id: 'owner-cow-ration-sheet', roles: ['pet_owner'], run: async ({ page, vp }, check) => {
      await openNutrition(page, ownCow); await chooseTab(page, 1).catch(() => undefined)
      const opener = page.locator('.nutri-tab button.nutri-wide-btn').first()
      await check('own cow Plan tab (ration)')
      if (!(await opener.count())) return
      await check('own cow ration builder sheet', async () => sheetAudit(page, opener, vp))
      await check('own cow ration sheet, Escape', async () => sheetEscape(page))
    } },
    { id: 'dog-plan-sheet', roles: ['pet_owner', 'veterinarian', 'admin'], run: async ({ page, vp }, check) => {
      await openNutrition(page, dog); await chooseTab(page, 1).catch(() => undefined)
      // the "make a plan" / "change plan" button of a pet plan, else the first wide button
      const opener = page.locator('.nutri-tab button.nutri-wide-btn, .nutri-tab button.btn-primary').first()
      if (!(await opener.count())) { await check('dog Plan tab (no plan button for this role)'); return }
      await check('dog plan builder sheet', async () => sheetAudit(page, opener, vp))
      await check('dog plan sheet, Escape', async () => sheetEscape(page))
    } },
    { id: 'pig-group-card', roles: ['farmer', 'admin'], run: async ({ page }, check) => {
      await page.goto('/animal-groups', { waitUntil: 'domcontentloaded' }); await settle(page)
      const name = FX?.pigGroupName || 'Verify M4 Old Pigs'
      const clicked = await page.evaluate((groupName) => {
        const hit = Array.from(document.querySelectorAll('*')).filter(e => e.children.length === 0 && (e.textContent || '').includes(groupName))[0]
        let el: Element | null = hit || null
        while (el && el !== document.body) {
          const b = Array.from(el.querySelectorAll('button')).find(x => /health|view|rates|sheht/i.test(x.textContent || '') || x.title)
          if (b) { (b as HTMLElement).click(); return true }
          el = el.parentElement
        }
        return false
      }, name)
      if (!clicked) { await check('animal groups (pig group card button not found)'); return }
      await page.locator('.modal-overlay').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined)
      await page.waitForTimeout(1200)
      await check('pig group feeding card')
    } },
    { id: 'daily-records-feed', roles: ['farmer', 'admin'], run: async ({ page, vp }, check) => {
      await page.goto('/farm-records', { waitUntil: 'domcontentloaded' }); await settle(page)
      const opener = page.locator('.record-card-actions .record-quick').first()
      await check('daily records')
      if (!(await opener.count())) return
      await check('daily records feed entry sheet', async () => sheetAudit(page, opener, vp))
      await check('daily records sheet, Escape', async () => sheetEscape(page))
    } },
    { id: 'pending-plan-card', roles: ['veterinarian', 'admin', 'pet_owner'], run: async ({ page }, check) => {
      await openNutrition(page, pending); await chooseTab(page, 1).catch(() => undefined)
      await check('pending (draft) plan card, Plan tab')
    } },
  ]
  return list
}

/** Runs one screen: audit + screenshot + findings. Returns the number of content findings. */
async function runScreens(ctxBase: { page: Page; role: Role; vp: typeof VIEWPORTS[number]; lang: string }, wanted: string[] | null): Promise<number> {
  const { page, role, vp, lang } = ctxBase
  const phone = vp.name === 'phone'
  let content = 0
  for (const s of screens()) {
    if (!s.roles.includes(role) || (wanted && !wanted.includes(s.id))) continue
    let shot = 0
    const check = async (label: string, extra?: () => Promise<string[]>) => {
      const found: Array<[string, string]> = []
      if (extra) for (const m of await extra()) found.push(['sheet', m])
      const a = await audit(page, phone, lang !== 'en')
      if (a.hscroll) found.push(['horizontal-scroll', a.hscroll])
      for (const h of a.hits.filter(x => x.scope === 'content')) found.push(['tap-target', `${h.sel} is ${h.w}x${h.h}px`])
      for (const h of a.hits.filter(x => x.scope === 'shell')) found.push(['tap-target-shell', `${h.sel} is ${h.w}x${h.h}px`])
      for (const c of a.clipped) found.push(['clipped-text', c])
      for (const k of a.rawKeys) found.push(['raw-i18n-key', k])
      for (const c of a.codes) found.push(['http-code-text', c])
      for (const e of a.english) found.push(['english-in-locale', e])
      if (!extra) for (const f of await focusAudit(page)) found.push(['focus-not-visible', f])
      const file = `${role}-${vp.name}${lang !== 'en' ? '-' + lang : ''}-${s.id}${shot++ ? '-' + shot : ''}.png`
      await page.screenshot({ path: join(OUT, file), fullPage: true }).catch(() => undefined)
      for (const [kind, detail] of new Map(found.map(f => [f.join('|'), f] as const)).values()) {
        note({ role, viewport: vp.name, screen: `${s.id}: ${label}`, lang, kind, detail: `${detail} [${file}]` })
        if (kind !== 'tap-target-shell' && kind !== 'english-in-locale') content++
      }
    }
    try { await s.run({ page, role, vp, lang, phone }, check) } catch (e) {
      note({ role, viewport: vp.name, screen: s.id, lang, kind: 'screen-failed', detail: String((e as Error).message).split('\n')[0].slice(0, 200) })
      content++
    }
  }
  return content
}

// ── the tests ───────────────────────────────────────────────────────────────
test.describe('@nutrition-devices nutrition on phone, tablet and desktop', () => {
  test.skip(!FX || !FX.dogId || !FX.cowId, 'the nutrition fixtures are built by runtime-verify PHASE 6m (NUTRI_FIXTURES)')
  test.beforeAll(() => { mkdirSync(OUT, { recursive: true }); writeFileSync(FINDINGS, '') })
  const sessions: Partial<Record<Role, Awaited<ReturnType<typeof signIn>>>> = {}
  test.beforeAll(async ({ baseURL }) => {
    for (const r of ROLES) sessions[r] = await signIn(baseURL || 'http://127.0.0.1:3000', r)
  })

  for (const vp of VIEWPORTS) {
    for (const role of ROLES) {
      test(`${role} on a ${vp.name} (${vp.width}x${vp.height}): every nutrition screen fits, reads and works`, async ({ browser }) => {
        test.setTimeout(12 * 60_000)
        const context = await newContext(browser, vp, sessions[role]!)
        const page = await context.newPage()
        const n = await runScreens({ page, role, vp, lang: 'en' }, null)
        await context.close()
        expect(n, `${n} problem(s) for ${role} on a ${vp.name}; see ${FINDINGS} and the screenshots in ${OUT}`).toBe(0)
      })
    }
  }

  // Same screens on the phone in the five Indian languages: anything still in plain English is listed.
  for (const role of ROLES) {
    test(`${role} on a phone in hi / kn / ml / ta / te: no raw keys, no codes, no plain English`, async ({ browser }) => {
      test.setTimeout(15 * 60_000)
      const vp = VIEWPORTS[0]
      let n = 0
      let english = 0
      for (const lang of LOCALES) {
        const context = await newContext(browser, vp, sessions[role]!, lang)
        const page = await context.newPage()
        const before = allFindings.length
        n += await runScreens({ page, role, vp, lang }, ['dashboard', 'dog-today', 'dog-plan', 'dog-body', 'dog-safe', 'cow-ration-sheet', 'pig-group-card', 'daily-records-feed', 'pending-plan-card'])
        english += allFindings.slice(before).filter(f => f.kind === 'english-in-locale').length
        await context.close()
      }
      test.info().annotations.push({ type: 'english-leaks', description: String(english) })
      expect(n, `${n} problem(s) for ${role} in the Indian languages; see ${FINDINGS}`).toBe(0)
      expect(english, `${english} text(s) still in plain English for ${role} in hi/kn/ml/ta/te; see ${FINDINGS}`).toBe(0)
    })
  }

  test('pet owner on a phone over Fast 3G: a loading state, then the content, then a plain message when the network is cut', async ({ browser }) => {
    test.setTimeout(6 * 60_000)
    const vp = VIEWPORTS[0]
    const context = await newContext(browser, vp, sessions.pet_owner!)
    const page = await context.newPage()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: Math.round(1.6 * 1024 * 1024 / 8 * 0.9), uploadThroughput: Math.round(750 * 1024 / 8 * 0.9) })
    // move inside the app (no full reload) so only the animal's data is slow
    await page.evaluate((id) => { history.pushState({}, '', `/nutrition?animal=${id}`); window.dispatchEvent(new PopStateEvent('popstate')) }, FX!.dogId)
    const seen = { loading: false, content: false }
    const t0 = Date.now()
    while (Date.now() - t0 < 120_000 && !seen.content) {
      const state = await page.evaluate(() => {
        const panel = document.querySelector('.nutri-panel')
        const spinner = document.querySelector('.loading-spinner, .route-loader')
        const hasTabs = !!document.querySelector('.nutri-panel .choice-chip')
        return { loading: !!spinner || (!!panel && !hasTabs && !!panel.querySelector('.nutri-hint')), content: hasTabs }
      })
      if (state.loading) seen.loading = true
      if (state.content) seen.content = true
      await page.waitForTimeout(60)
    }
    await page.screenshot({ path: join(OUT, 'pet_owner-phone-fast3g-loaded.png'), fullPage: true }).catch(() => undefined)
    note({ role: 'pet_owner', viewport: 'phone', screen: 'fast-3g', lang: 'en', kind: seen.loading ? 'info' : 'no-loading-state', detail: `loading state seen: ${seen.loading}; content shown after ${Date.now() - t0} ms: ${seen.content}` })
    // network cut: open the other animal's panel (needs a fetch) and look at what the person is told
    await context.setOffline(true)
    await page.evaluate((id) => { history.pushState({}, '', `/nutrition?animal=${id}`); window.dispatchEvent(new PopStateEvent('popstate')) }, FX!.ownerCowId)
    await page.waitForTimeout(4000)
    const offlineText = await page.evaluate(() => (document.querySelector('.nutri-page, .layout-content') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').slice(0, 400) || '')
    const hasMessage = await page.locator('.nutri-note, [role="status"], [role="alert"], .offline-banner').count()
    await page.screenshot({ path: join(OUT, 'pet_owner-phone-offline.png'), fullPage: true }).catch(() => undefined)
    const a = await audit(page, true, false)
    note({ role: 'pet_owner', viewport: 'phone', screen: 'offline', lang: 'en', kind: hasMessage ? 'info' : 'no-offline-message', detail: `message elements: ${hasMessage}; page text: "${offlineText}"; codes in text: ${JSON.stringify(a.codes)}` })
    await context.setOffline(false)
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    await context.close()
    expect(seen.loading, 'a loading state was shown while the nutrition panel was loading on Fast 3G').toBe(true)
    expect(seen.content, 'the nutrition panel content appeared on Fast 3G').toBe(true)
    expect(hasMessage, 'a plain message or banner was shown when the network was cut').toBeGreaterThan(0)
    expect(a.codes, 'no HTTP code or "Request failed" text while offline').toEqual([])
  })
})
