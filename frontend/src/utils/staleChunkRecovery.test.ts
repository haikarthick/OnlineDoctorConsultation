import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isStaleChunkError, reloadForStaleChunk } from './staleChunkRecovery'

describe('isStaleChunkError', () => {
  it('recognises the exact error a rotated-away chunk produces', () => {
    expect(isStaleChunkError(new Error(
      'Failed to fetch dynamically imported module: https://vetcare-dev.onrender.com/assets/EnterpriseManagement-Bwry8HSo.js'
    ))).toBe(true)
  })

  it('recognises the Firefox and Safari wordings for the same failure', () => {
    expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isStaleChunkError(new Error(
      "Expected a JavaScript module script but the server responded with a MIME type of text/html"
    ))).toBe(true)
  })

  it('recognises a failed CSS preload', () => {
    expect(isStaleChunkError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true)
  })

  it('accepts a bare string as well as an Error', () => {
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(true)
  })

  it('does NOT swallow ordinary application errors', () => {
    // If this ever returns true the app would reload on a normal crash, hiding real bugs.
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleChunkError(new Error('Network request failed'))).toBe(false)
    expect(isStaleChunkError(new Error('Invalid email or password'))).toBe(false)
    expect(isStaleChunkError(null)).toBe(false)
    expect(isStaleChunkError(undefined)).toBe(false)
    expect(isStaleChunkError({})).toBe(false)
  })
})

describe('reloadForStaleChunk - one-shot guard', () => {
  const reload = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    reload.mockClear()
    Object.defineProperty(window, 'location', {
      value: { pathname: '/enterprise-management', reload },
      writable: true,
    })
  })
  afterEach(() => { sessionStorage.clear() })

  it('reloads the first time a route hits a stale chunk', () => {
    expect(reloadForStaleChunk()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('refuses to reload a second time for the same route', () => {
    // The important case: without this, a chunk that is genuinely missing (a broken deploy,
    // not a stale one) would reload -> fail -> reload forever and the user could never see
    // the error or use the app at all.
    reloadForStaleChunk()
    reload.mockClear()

    expect(reloadForStaleChunk()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('still allows a reload on a DIFFERENT route', () => {
    reloadForStaleChunk()
    reload.mockClear()
    window.location.pathname = '/pharmacy'

    expect(reloadForStaleChunk()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload when sessionStorage is unavailable', () => {
    // Private mode: an unreadable guard means we cannot prove we have not already tried, so
    // reloading could loop. Surfacing the error is the safer failure.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })

    expect(reloadForStaleChunk()).toBe(false)
    expect(reload).not.toHaveBeenCalled()

    spy.mockRestore()
  })
})
