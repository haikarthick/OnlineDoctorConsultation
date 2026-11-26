import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { userMessage } from '../../utils/userMessage'
import { pickField } from '../../utils/recordForm'

export interface LineageRow { animal_id?: string; animalId?: string; name?: string; species?: string; breed?: string; inbreeding_coefficient?: number | string; gen?: number | string }

/** The family-tree rows (animal, parents, grandparents ...) grouped by how many generations back they are; oldest last. Pure. */
export function groupByGeneration(rows: LineageRow[]): Array<{ generation: number; animals: LineageRow[] }> {
  const map = new Map<number, LineageRow[]>()
  const seen = new Set<string>()
  for (const r of rows || []) {
    const gen = Number(r.gen ?? 0)
    const key = `${gen}:${r.animal_id || r.animalId || r.name}`
    if (seen.has(key)) continue // the same ancestor can be reached through both parents
    seen.add(key)
    map.set(gen, [...(map.get(gen) || []), r])
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([generation, animals]) => ({ generation, animals }))
}

interface Props { open: boolean; animalId: string | null; animalName: string; onClose: () => void }

/** "Who are this animal's parents and grandparents?" - the family tree of one animal with a genetic profile. Read-only. */
export const LineageTreeSheet: React.FC<Props> = ({ open, animalId, animalName, onClose }) => {
  const { t } = useTranslation()
  const [rows, setRows] = useState<LineageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !animalId) return
    let active = true
    setLoading(true); setError(''); setRows([])
    apiService.getLineageTree(animalId, 4)
      .then((res: any) => { if (active) setRows(res?.data?.tree || []) })
      .catch((err: unknown) => { if (active) setError(userMessage(err, 'recordActions.lineage.treeFailed')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, animalId])

  const groups = groupByGeneration(rows)
  return (
    <BottomSheet open={open} title={t('recordActions.lineage.treeTitle', { name: animalName })} onClose={onClose}>
      <div className="record-sheet">
        {loading && <p className="record-sheet-text" role="status">{t('recordActions.loading')}</p>}
        {error && <div className="record-sheet-error" role="alert">{error}</div>}
        {!loading && !error && groups.length <= 1 && <p className="record-sheet-text">{t('recordActions.lineage.treeEmpty')}</p>}
        {groups.map(g => (
          <div key={g.generation}>
            <strong className="record-sheet-text">{g.generation === 0 ? t('recordActions.lineage.thisAnimal') : t('recordActions.lineage.generationBack', { count: g.generation })}</strong>
            <ul className="trace-list">
              {g.animals.map((a, i) => (
                <li key={`${a.animal_id || a.animalId || i}`} className="trace-step">
                  <span>{a.name}</span>
                  <span className="trace-meta">{[a.species, a.breed].filter(Boolean).join(' · ')}{pickField(a, 'inbreedingCoefficient') != null ? ` · ${(+pickField(a, 'inbreedingCoefficient')).toFixed(4)}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="record-sheet-buttons">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('recordActions.close')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}
