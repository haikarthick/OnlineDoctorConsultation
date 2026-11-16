import { describe, it, expect } from 'vitest'

/**
 * Owner rule (CLAUDE.md "users never see error codes"): a caught error is turned into words ONLY by
 * userMessage() in utils/userMessage.ts. Showing `err.message` can print "Request failed with status
 * code 404" to a farmer; reading `response.data.error` by hand skips the offline / permission /
 * server-trouble sentences and can print "[object Object]".
 *
 * This fails the build when a screen does either, so the rule is enforced by the pipeline and not by
 * remembering it.
 */
const sources = import.meta.glob(
  ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './context/**/*.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const RAW_MESSAGE = /\b(?:err|error|e|ex|exception|apiErr|apiError)\??\.message\b/
const RAW_RESPONSE = /\.response\??\.data\??\.(?:error|message)\b/
const SAFE_LINE = /guard-ok|^\s*(?:\/\/|\*|\/\*)|console\.|logger\.|new Error\(|new UserFacingError\(|throw |\.test\(|expect\(/

function offenders(re: RegExp): string[] {
  const out: string[] = []
  for (const [file, src] of Object.entries(sources)) {
    if (/\.test\.|\.spec\./.test(file)) continue
    src.split('\n').forEach((line, i) => {
      if (SAFE_LINE.test(line)) return
      if (re.test(line)) out.push(`${file.replace('./', 'src/')}:${i + 1}: ${line.trim().slice(0, 110)}`)
    })
  }
  return out
}

describe('error messages shown to people', () => {
  it('scans the screens', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(150)
  })

  it('no screen shows a raw error.message', () => {
    expect(offenders(RAW_MESSAGE)).toEqual([])
  })

  it('no screen reads the server error by hand instead of using userMessage()', () => {
    expect(offenders(RAW_RESPONSE)).toEqual([])
  })
})
