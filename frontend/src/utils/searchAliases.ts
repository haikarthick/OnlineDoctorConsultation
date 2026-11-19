/**
 * Search in your own language.
 *
 * A listing stores the breed and species by their canonical (English) names, but a farmer types "गिर",
 * "கிர்" or "ಗಿರ್". The app already knows every breed and species name in the person's language (locale
 * files plus any names an admin typed), so it works out which breeds/species the typed words mean and sends
 * those canonical names along with the search; the server matches them exactly. No guessing on the server,
 * and it covers every locale the app is translated into.
 */
const norm = (s: string) => String(s || '').normalize('NFC').toLocaleLowerCase().trim()

export const MAX_SEARCH_ALIASES = 10

export function resolveSearchAliases(
  text: string,
  species: string[],
  breedsFor: (species: string) => string[],
  speciesLabel: (species: string) => string,
  breedLabel: (species: string, breed: string) => string,
): string[] {
  const q = norm(text)
  if (q.length < 2) return []
  const out = new Set<string>()
  const hit = (...names: string[]) => names.some(n => { const x = norm(n); return x.length > 0 && x.includes(q) })
  for (const s of species) {
    if (hit(s, speciesLabel(s))) out.add(s)
    for (const b of breedsFor(s)) {
      if (hit(b, breedLabel(s, b))) out.add(b)
      if (out.size >= MAX_SEARCH_ALIASES) return Array.from(out)
    }
  }
  return Array.from(out).slice(0, MAX_SEARCH_ALIASES)
}
