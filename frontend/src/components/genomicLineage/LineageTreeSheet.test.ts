import { describe, it, expect } from 'vitest'
import { groupByGeneration } from './LineageTreeSheet'

describe('groupByGeneration', () => {
  it('groups the animal, its parents and grandparents by generation, oldest last', () => {
    const g = groupByGeneration([
      { animal_id: 'c', name: 'Calf', gen: 0 },
      { animal_id: 's', name: 'Sire', gen: 1 },
      { animal_id: 'd', name: 'Dam', gen: 1 },
      { animal_id: 'gs', name: 'Granddad', gen: 2 },
    ])
    expect(g.map(x => x.generation)).toEqual([0, 1, 2])
    expect(g[1].animals.map(a => a.name)).toEqual(['Sire', 'Dam'])
  })
  it('lists an ancestor reached through both parents once', () => {
    const g = groupByGeneration([{ animal_id: 'x', name: 'Shared', gen: 2 }, { animal_id: 'x', name: 'Shared', gen: 2 }])
    expect(g[0].animals).toHaveLength(1)
  })
  it('copes with nothing', () => {
    expect(groupByGeneration([])).toEqual([])
  })
})
