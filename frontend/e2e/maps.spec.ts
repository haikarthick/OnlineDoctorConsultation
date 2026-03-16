import { test, expect } from './fixtures'

/**
 * MAP TILE VERIFICATION E2E TESTS
 *
 * These tests go beyond smoke-testing page loads — they verify that
 * Leaflet map tiles actually load from OpenStreetMap tile servers.
 *
 * Root cause caught: Helmet CSP or nginx CSP can silently block
 * tile image requests, producing a grey map box with zero JS errors.
 *
 * Pages with MapView:
 *   /enterprises          (farmer, admin)
 *   /locations            (farmer, admin)
 *   /geospatial           (farmer, admin)
 *   /disease-prediction   (farmer, admin, veterinarian)
 *   /supply-chain         (farmer, admin)
 */

const MAP_PAGES = [
  { path: '/enterprises',        name: 'Enterprise Management' },
  { path: '/locations',          name: 'Location Management' },
  { path: '/geospatial',         name: 'Geospatial Analytics' },
  { path: '/disease-prediction', name: 'Disease Prediction' },
  { path: '/supply-chain',       name: 'Supply Chain' },
] as const

// ── Helpers ───────────────────────────────────────────────────

/**
 * Waits for Leaflet to render tile images inside .leaflet-tile-pane.
 * If CSP blocks tile requests, this pane will have no <img> children.
 */
async function assertMapTilesRendered(page: import('@playwright/test').Page) {
  // Wait for the Leaflet container to appear
  const leaflet = page.locator('.leaflet-container')
  await expect(leaflet.first()).toBeVisible({ timeout: 15_000 })

  // Wait for at least one tile <img> to appear inside the tile pane.
  // CSP-blocked tiles never create <img> or they fail to load → 0 visible tiles.
  const tiles = page.locator('.leaflet-tile-pane img.leaflet-tile')
  await expect(tiles.first()).toBeVisible({ timeout: 20_000 })

  // Verify at least a few tiles loaded (a normal map view loads 6-12+ tiles)
  const tileCount = await tiles.count()
  expect(tileCount).toBeGreaterThanOrEqual(1)

  // Verify tile images actually loaded (naturalWidth > 0).
  // CSP-blocked images render as broken — naturalWidth stays 0.
  const loadedTile = await tiles.first().evaluate(
    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
  )
  expect(loadedTile, 'Tile <img> exists but failed to load — likely blocked by CSP').toBe(true)
}

/**
 * Intercepts network requests to the tile server and asserts at least
 * one tile request was made and succeeded (HTTP 200).
 */
async function assertTileNetworkRequests(page: import('@playwright/test').Page, path: string) {
  const tileResponses: { url: string; status: number }[] = []

  // Listen for tile image responses
  page.on('response', (response) => {
    const url = response.url()
    if (url.includes('tile.openstreetmap.org')) {
      tileResponses.push({ url, status: response.status() })
    }
  })

  // Navigate to the map page
  await page.goto(path)
  await page.waitForLoadState('networkidle')

  // Wait for Leaflet to render
  const leaflet = page.locator('.leaflet-container')
  await expect(leaflet.first()).toBeVisible({ timeout: 15_000 })

  // Give tiles time to load (they are lazy-loaded as the map renders)
  await page.waitForTimeout(3_000)

  // At least one tile request should have been made and returned 200
  const successfulTiles = tileResponses.filter(r => r.status === 200)
  expect(
    successfulTiles.length,
    `Expected tile requests to tile.openstreetmap.org on ${path}, ` +
    `got ${tileResponses.length} total (${successfulTiles.length} successful). ` +
    `If 0, CSP is likely blocking tile requests.`,
  ).toBeGreaterThanOrEqual(1)
}

// ── Farmer sees map tiles on all 5 map pages ────────────────

test.describe('Map Tiles — Farmer', () => {
  for (const { path, name } of MAP_PAGES) {
    test(`${name} (${path}) renders map tiles`, async ({ farmerPage: page }) => {
      await assertTileNetworkRequests(page, path)
      await assertMapTilesRendered(page)
    })
  }
})

// ── Admin sees map tiles on all 5 map pages ─────────────────

test.describe('Map Tiles — Admin', () => {
  for (const { path, name } of MAP_PAGES) {
    test(`${name} (${path}) renders map tiles`, async ({ adminPage: page }) => {
      await assertTileNetworkRequests(page, path)
      await assertMapTilesRendered(page)
    })
  }
})

// ── Vet sees map tiles on Disease Prediction ─────────────────

test.describe('Map Tiles — Veterinarian', () => {
  test('Disease Prediction (/disease-prediction) renders map tiles', async ({ vetPage: page }) => {
    await assertTileNetworkRequests(page, '/disease-prediction')
    await assertMapTilesRendered(page)
  })
})

// ── CSP validation: no blocked resources in console ──────────

test.describe('Map CSP — No blocked resources', () => {
  test('no CSP violation on map page', async ({ farmerPage: page }) => {
    const cspViolations: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      if (
        text.includes('Content Security Policy') ||
        text.includes('Refused to load') ||
        text.includes('blocked by CSP')
      ) {
        cspViolations.push(text)
      }
    })

    await page.goto('/enterprises')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3_000)

    expect(
      cspViolations,
      `CSP violations detected:\n${cspViolations.join('\n')}`,
    ).toHaveLength(0)
  })
})
