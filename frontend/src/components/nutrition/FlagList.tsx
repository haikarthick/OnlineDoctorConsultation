import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { userMessage } from '../../utils/userMessage'
import { FLAG_ICON, type RiskFlag } from './nutritionShared'

/**
 * Open nutrition alerts, most urgent first - for one animal (Today tab) or a herd (the group's feed card). Anyone
 * who can record for the animal answers "Seen" (the alert was right) or "Not right" (a false alarm); both answers
 * are kept as labels so each rule's hit rate is known (admin -> Usage) before any prediction model is trusted.
 */
export const FlagList: React.FC<{ flags: RiskFlag[]; canAct: boolean; onChanged: () => void }> = ({ flags, canAct, onChanged }) => {
  const { t } = useTranslation()
  const [error, setError] = useState('')
  const act = async (id: string, status: 'reviewed' | 'dismissed') => {
    try { await apiService.setNutritionFlagStatus(id, status); setError(''); onChanged() } catch (err) { setError(userMessage(err, 'nutrition.errors.flag')) }
  }
  if (flags.length === 0) return null
  return (
    <section className="nutri-card nutri-flags" aria-label={t('nutrition.flags.title')}>
      <h3 className="nutri-card-title">{t('nutrition.flags.title')}</h3>
      {error && <p className="nutri-note is-warning" role="status">{error}</p>}
      <ul className="nutri-list">
        {flags.map(f => (
          <li key={f.id} className={`nutri-flag is-${f.severity}`}>
            <span aria-hidden="true">{FLAG_ICON[f.severity]}</span>
            <span className="nutri-flag-text">
              <strong>{t(`nutrition.flags.${f.type}.title`, f.params)}</strong>
              <span className="nutri-hint">{t(`nutrition.flags.${f.type}.next`, f.params)}</span>
            </span>
            {canAct && (
              <span className="nutri-flag-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { void act(f.id, 'reviewed') }}>{t('nutrition.flags.seen')}</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { void act(f.id, 'dismissed') }}>{t('nutrition.flags.notRight')}</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default FlagList
