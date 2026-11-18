import { describe, it, expect } from 'vitest'
import { resolveSearchAliases } from './searchAliases'

const SPECIES = ['cattle', 'buffalo']
const BREEDS: Record<string, string[]> = { cattle: ['Gir', 'Sahiwal'], buffalo: ['Murrah'] }
const SP_LABEL: Record<string, string> = { cattle: 'गाय', buffalo: 'भैंस' } // Hindi
const BR_LABEL: Record<string, string> = { Gir: 'गिर', Sahiwal: 'साहीवाल', Murrah: 'मुर्रा' }
const resolve = (q: string) => resolveSearchAliases(q, SPECIES, s => BREEDS[s], s => SP_LABEL[s] ?? s, (_s, b) => BR_LABEL[b] ?? b)

describe('resolveSearchAliases', () => {
  it('turns a Hindi breed name into the canonical breed stored on listings', () => {
    expect(resolve('गिर')).toEqual(['Gir'])
  })
  it('turns a Hindi species word into the species code', () => {
    expect(resolve('गाय')).toEqual(['cattle'])
  })
  it('still works for the English name, in any letter case', () => {
    expect(resolve('MURRAH')).toEqual(['Murrah'])
  })
  it('matches a part of a name', () => {
    expect(resolve('साही')).toEqual(['Sahiwal'])
  })
  it('gives nothing for a one-letter query or an unknown word (the normal text search still runs)', () => {
    expect(resolve('ग')).toEqual([])
    expect(resolve('zebra')).toEqual([])
    expect(resolve('   ')).toEqual([])
  })
  it('never returns more than ten names', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Breed${i}`)
    expect(resolveSearchAliases('breed', ['x'], () => many, s => s, (_s, b) => b)).toHaveLength(10)
  })
})
