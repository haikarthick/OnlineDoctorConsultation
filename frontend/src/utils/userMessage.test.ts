import { describe, it, expect } from 'vitest'
import i18n from 'i18next'
import { userMessage, isReadableMessage, UserFacingError } from './userMessage'

// In tests i18next has no resources, so a missing key returns the key: we can assert on 'errors.*'.
const axiosErr = (status: number | undefined, data?: unknown, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: status ? { status, data } : undefined, ...extra })

describe('userMessage', () => {
  it("shows the server's own readable sentence first", () => {
    expect(userMessage(axiosErr(400, { error: { message: 'That farm already has a group with this name' } }))).toBe('That farm already has a group with this name')
    expect(userMessage(axiosErr(400, { message: 'Enter the weight, above zero.' }))).toBe('Enter the weight, above zero.')
    expect(userMessage(axiosErr(409, { error: 'This animal is already marked as sold.' }))).toBe('This animal is already marked as sold.')
  })

  it('never shows a status line, a code or a stack, whatever the server sent', () => {
    for (const bad of ['Request failed with status code 500', 'INTERNAL_SERVER_ERROR', 'VALIDATION_ERROR', '404', 'Network Error', 'Error: boom', 'at Object.<anonymous> (file.js:10:5)']) {
      const msg = userMessage(axiosErr(500, { error: { message: bad } }))
      expect(msg).toBe('errors.serverTrouble')
      expect(msg).not.toMatch(/\b\d{3}\b|status code/)
    }
  })

  it('a dropped connection says offline, not a code', () => {
    expect(userMessage(axiosErr(undefined))).toBe('errors.offline')
    expect(userMessage(new TypeError('Failed to fetch'))).toBe('errors.offline')
    expect(userMessage({ message: 'Network request failed' })).toBe('errors.offline')
  })

  it('common refusals each get their own plain sentence', () => {
    expect(userMessage(axiosErr(401, {}))).toBe('errors.sessionEnded')
    expect(userMessage(axiosErr(403, {}))).toBe('errors.forbidden')
    expect(userMessage(axiosErr(404, {}))).toBe('errors.notFound')
    expect(userMessage(axiosErr(409, {}))).toBe('errors.conflict')
    expect(userMessage(axiosErr(429, {}))).toBe('errors.tooManyRequests')
    expect(userMessage(axiosErr(503, {}))).toBe('errors.serverTrouble')
  })

  it('a slow server has its own sentence', () => {
    expect(userMessage(Object.assign(new Error('x'), { isTimeout: true }))).toBe('errors.slowServer')
  })

  it("an error written for the person (UserFacingError) is shown; a developer's Error is not", () => {
    expect(userMessage(new UserFacingError('Invalid email or password'))).toBe('Invalid email or password')
    expect(userMessage(new Error('Cannot read properties of undefined'))).toBe('errors.generic')
  })

  it("uses the screen's own sentence when nothing more specific applies", () => {
    i18n.addResource('en', 'translation', 'animals.saveFailed', 'Could not save the animal')
    expect(userMessage(axiosErr(400, {}), 'animals.saveFailed')).toBe('Could not save the animal')
    expect(userMessage(axiosErr(400, {}), undefined, 'Could not save the group')).toBe('Could not save the group')
    expect(userMessage(undefined)).toBe('errors.generic')
  })

  it('an error object in the server reply never prints as [object Object]', () => {
    expect(userMessage(axiosErr(400, { error: { code: 'X', details: {} } }))).toBe('errors.generic')
  })
})

describe('isReadableMessage', () => {
  it('accepts plain sentences and rejects codes', () => {
    expect(isReadableMessage('Your role on this farm lets you see its records but not add them.')).toBe(true)
    expect(isReadableMessage('ECONNRESET')).toBe(false)
    expect(isReadableMessage('')).toBe(false)
    expect(isReadableMessage(undefined)).toBe(false)
    expect(isReadableMessage('x'.repeat(500))).toBe(false)
  })
})

describe('userMessage - a coded refusal is said in the person\'s language', () => {
  it('uses the translation for the code, with the values the server sent', () => {
    i18n.addResourceBundle('en', 'translation', { serverMessages: { RX_TEST: '{{label}}: enter the days.' } }, true, true)
    const err = axiosErr(400, { message: 'Product A: enter the days (English from the server)', error: { code: 'RX_TEST', params: { label: 'Product A' } } })
    expect(userMessage(err)).toBe('Product A: enter the days.')
  })

  it('a code with no translation falls back to the server\'s own readable sentence', () => {
    const err = axiosErr(400, { message: 'Words from the server.', error: { code: 'NO_SUCH_CODE_YET' } })
    expect(userMessage(err)).toBe('Words from the server.')
  })
})
