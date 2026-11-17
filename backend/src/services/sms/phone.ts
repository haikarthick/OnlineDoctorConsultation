/**
 * Mobile numbers. People type them every way: "98765 43210", "+91-98765-43210", "09876543210",
 * "919876543210". One stored form (E.164, "+919876543210") makes "is this the same person?" and
 * "log in with my number" reliable.
 */

/** E.164 form of what the person typed, or null when it cannot be a mobile number. */
export function normalizePhone(input: unknown, defaultCountryCode = '91'): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s) return null;
  const plus = s.startsWith('+') || s.startsWith('00');
  s = s.replace(/^00/, '').replace(/[^\d]/g, '');
  if (!s) return null;

  let full: string;
  if (plus) {
    full = s;
  } else if (s.length === defaultCountryCode.length + 10 && s.startsWith(defaultCountryCode)) {
    full = s; // 919876543210
  } else if (s.length === 11 && s.startsWith('0')) {
    full = defaultCountryCode + s.slice(1); // 09876543210
  } else if (s.length === 10) {
    full = defaultCountryCode + s; // 9876543210
  } else {
    return null;
  }
  if (full.length < 8 || full.length > 15) return null;
  // India: ten digits after 91, starting 6-9 (a landline or a short number is not a mobile).
  if (full.startsWith('91') && !/^91[6-9]\d{9}$/.test(full)) return null;
  return `+${full}`;
}

/** "+91 98••••3210" - enough to recognise, not enough to misuse (for logs and screens). */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const d = e164.replace(/[^\d]/g, '');
  if (d.length < 7) return '••••';
  return `+${d.slice(0, d.length - 10 > 0 ? d.length - 10 : 2)} ${d.slice(-10, -8)}••••${d.slice(-4)}`;
}

/** Does this text look like a phone number rather than an email? (for the "email or mobile" login field) */
export function looksLikePhone(input: unknown): boolean {
  return typeof input === 'string' && !input.includes('@') && /^[+\d][\d\s\-()+]{6,}$/.test(input.trim());
}
