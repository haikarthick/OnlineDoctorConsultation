import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useMasterData } from '../../context/MasterDataContext'
import { useNutritionEnabled } from '../../hooks/useNutritionEnabled'
import { userMessage } from '../../utils/userMessage'
import { ChipSelect } from '../../components/mobile/ChipSelect'
import NutritionPanel from '../../components/nutrition/NutritionPanel'
import { formatKcal } from '../../components/nutrition/nutritionShared'

interface Row {
  id: string; name: string; species: string; uniqueId: string | null; enterpriseName: string | null; isMine: boolean
  model: string; plan: { id: string; validation: string; kcal: number | null; goal: string } | null; actFlags: number; watchFlags: number
}

type Filter = 'all' | 'attention' | 'no_plan' | 'to_review'
const PAGE = 20

/**
 * Nutrition: every animal the person may look after - their pets, their farm's animals, a vet's booked
 * patients - with what needs attention first. Choosing one opens the same Nutrition panel every other screen
 * shows. Sub-views (H10 design contract): the list (search + All / Needs attention / No plan, 20 at a time) and
 * the chosen animal; on a phone the list gives way to the animal with a Back button, on a wide screen they sit
 * side by side. The selected animal is in the address (?animal=) so a link or refresh lands on it.
 */
const Nutrition: React.FC = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { speciesIcon, speciesLabel } = useMasterData()
  const { enabled, loading: flagLoading } = useNutritionEnabled(!!user)
  const [params, setParams] = useSearchParams()
  const selected = params.get('animal')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Typing waits a moment before asking the server, so each keystroke is not a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const load = useCallback(async (offset: number) => {
    setLoading(true)
    try {
      const res: any = await apiService.listNutritionAnimals({ search: query || undefined, filter: filter === 'all' ? undefined : filter, limit: PAGE, offset })
      const items: Row[] = res?.data?.items || []
      setRows(prev => (offset === 0 ? items : [...prev, ...items]))
      setTotal(res?.data?.total || 0)
      setError('')
    } catch (err) {
      setError(userMessage(err, 'nutrition.errors.list'))
    } finally {
      setLoading(false)
    }
  }, [query, filter])

  useEffect(() => { if (enabled) void load(0) }, [enabled, load])

  const choose = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('animal', id); else next.delete('animal')
    setParams(next)
  }

  if (flagLoading) return <div className="module-page nutri-page"><div className="loading-spinner">{t('nutrition.loading')}</div></div>
  if (!enabled) {
    return (
      <div className="module-page nutri-page">
        <div className="empty-state">
          <div className="empty-icon">🥣</div>
          <h2>{t('nutrition.off.title')}</h2>
          <p>{t('nutrition.off.body')}</p>
        </div>
      </div>
    )
  }

  const list = (
    <div className="nutri-list-pane">
      <div className="filters-bar">
        <input className="search-input" type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('nutrition.page.search')} aria-label={t('nutrition.page.search')} />
      </div>
      <ChipSelect label={t('nutrition.page.show')} value={filter} onChange={setFilter} options={[
        { value: 'all', label: t('nutrition.page.all') },
        { value: 'attention', label: t('nutrition.page.attention') },
        { value: 'no_plan', label: t('nutrition.page.noPlan') },
        { value: 'to_review', label: t('nutrition.page.toReview') },
      ]} />
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {!loading && rows.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-icon">🐾</div>
          <p>{query || filter !== 'all' ? t('nutrition.page.noMatch') : t(user?.role === 'veterinarian' ? 'nutrition.page.emptyVet' : 'nutrition.page.empty')}</p>
          {!query && filter === 'all' && user?.role !== 'veterinarian' && user?.role !== 'admin' && (
            <button type="button" className="btn btn-primary" onClick={() => navigate('/animals')}>{t('nutrition.page.addAnimal')}</button>
          )}
        </div>
      )}
      <ul className="nutri-animal-list">
        {rows.map(r => (
          <li key={r.id}>
            <button type="button" className={`nutri-animal ${selected === r.id ? 'is-selected' : ''}`} aria-pressed={selected === r.id} onClick={() => choose(r.id)}>
              <span className="nutri-animal-icon" aria-hidden="true">{speciesIcon(r.species)}</span>
              <span className="nutri-animal-text">
                <strong className="nutri-animal-name">{r.name}</strong>
                <span className="nutri-list-meta">
                  {speciesLabel(r.species, t)}{r.enterpriseName ? ` · ${r.enterpriseName}` : ''}
                </span>
                <span className="nutri-list-meta">
                  {r.plan?.kcal ? t('nutrition.summary.kcal', { kcal: formatKcal(r.plan.kcal, i18n.language) }) : t('nutrition.summary.noPlan')}
                  {r.plan?.validation === 'vet_reviewed' ? ` · ${t('nutrition.plan.reviewed')}` : ''}
                </span>
              </span>
              {r.actFlags > 0 && <span className="nutri-pill is-act">{t('nutrition.summary.alerts', { count: r.actFlags })}</span>}
              {r.actFlags === 0 && r.watchFlags > 0 && <span className="nutri-pill is-watch">{t('nutrition.summary.watch', { count: r.watchFlags })}</span>}
            </button>
          </li>
        ))}
      </ul>
      {loading && <div className="loading-spinner">{t('nutrition.loading')}</div>}
      {!loading && rows.length < total && (
        <button type="button" className="btn btn-secondary nutri-wide-btn" onClick={() => { void load(rows.length) }}>
          {t('nutrition.page.more', { shown: rows.length, total })}
        </button>
      )}
    </div>
  )

  return (
    <div className="module-page nutri-page">
      <div className="module-header">
        <h1>{t('nutrition.page.title')}</h1>
        <p className="subtitle">{t('nutrition.page.subtitle')}</p>
      </div>
      <div className={`nutri-layout ${selected ? 'has-selection' : ''}`}>
        {list}
        <div className="nutri-detail-pane">
          {selected ? (
            <>
              <button type="button" className="btn btn-secondary btn-sm nutri-back" onClick={() => choose(null)}>← {t('nutrition.page.back')}</button>
              <NutritionPanel key={selected} animalId={selected} />
            </>
          ) : (
            <div className="empty-state nutri-pick-hint">
              <div className="empty-icon">🥣</div>
              <p>{t('nutrition.page.pick')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Nutrition
