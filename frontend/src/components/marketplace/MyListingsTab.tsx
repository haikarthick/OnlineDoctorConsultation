import React, { useState } from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing } from '../../types'
import { cldCardImageProps } from '../../utils/media'
import { g } from './publicListingShared'

type Draft = { title: string; price: string; description: string }

/** The seller's own listings: what is live, what is waiting for review, what sold - with the actions a seller needs. */
export const MyListingsTab: React.FC<{
  listings: MarketplaceListing[]; loading: boolean; formatCurrency: (n: number) => string;
  onView: (l: MarketplaceListing) => void;
  onLoadViews: (id: string) => Promise<Array<{ first_name: string; last_initial: string; channel: string; created_at: string }>>;
  onSave: (id: string, patch: { title: string; price: number | null; description: string }) => Promise<boolean>;
  onMarkSold: (id: string) => void; onDelete: (id: string) => void; onSell: () => void; t: TFunction;
}> = ({ listings, loading, formatCurrency, onView, onLoadViews, onSave, onMarkSold, onDelete, onSell, t }) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ title: '', price: '', description: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewsFor, setViewsFor] = useState<string | null>(null)
  const [contactViews, setContactViews] = useState<Array<{ first_name: string; last_initial: string; channel: string; created_at: string }>>([])
  const toggleViews = async (id: string) => {
    if (viewsFor === id) { setViewsFor(null); return }
    setViewsFor(id); setContactViews([])
    setContactViews(await onLoadViews(id))
  }

  const startEdit = (l: MarketplaceListing) => {
    setEditingId(l.id); setConfirmDeleteId(null)
    setDraft({ title: l.title || '', price: l.price != null ? String(l.price) : '', description: l.description || '' })
  }
  const save = async (id: string) => {
    if (!draft.title.trim()) return
    setSaving(true)
    const ok = await onSave(id, { title: draft.title.trim(), price: draft.price.trim() === '' ? null : Number(draft.price), description: draft.description })
    setSaving(false)
    if (ok) setEditingId(null)
  }

  if (loading) return <div className="mp-loading">{t('marketplace.loadingListings')}</div>
  if (listings.length === 0) {
    return (
      <div className="mp-empty-state">
        <p className="mp-empty">{t('marketplace.mine.empty')}</p>
        <button type="button" className="module-btn primary" onClick={onSell}>{t('marketplace.mine.sellFirst')}</button>
      </div>
    )
  }

  return (
    <div className="mp-mine-list">
      {listings.map(l => {
        const images = typeof l.images === 'string' ? JSON.parse(l.images || '[]') : (l.images || [])
        const approved = g(l, 'adminApproved', 'admin_approved')
        // Rejected is a status the server may send that the shared listing type does not list
        const rawStatus = String(l.status || 'active')
        const statusKey = rawStatus === 'rejected' ? 'rejected' : approved === false ? 'pending' : rawStatus
        const isOpen = !['sold', 'rehomed', 'expired', 'rejected'].includes(statusKey)
        const views = g(l, 'viewsCount', 'views_count') || 0
        const editing = editingId === l.id
        return (
          <div key={l.id} className="mp-mine-card">
            <div className="mp-mine-main">
              <div className="mp-mine-thumb">
                {images[0] ? <img {...cldCardImageProps(images[0])} alt="" loading="lazy" /> : <span aria-hidden="true">📦</span>}
              </div>
              <div className="mp-mine-info">
                <h4 className="mp-mine-title">{l.title}</h4>
                <div className="mp-mine-meta">
                  <span className={`mp-badge mp-mine-status ${statusKey}`}>{t(`marketplace.mine.status.${statusKey}`, statusKey)}</span>
                  <span>{l.price ? formatCurrency(l.price) : t('marketplace.card.contact')}</span>
                  <span>👁 {views}</span>
                </div>
              </div>
            </div>

            {editing ? (
              <div className="mp-mine-edit">
                <label className="module-label">{t('marketplace.sell.title')}</label>
                <input className="module-input" value={draft.title} maxLength={300} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                <label className="module-label">{t('marketplace.reviewLabels.price')}</label>
                <input className="module-input" type="number" inputMode="decimal" min={0} value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} />
                <label className="module-label">{t('marketplace.sell.description')}</label>
                <textarea className="module-input" rows={3} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                <div className="mp-mine-actions">
                  <button type="button" className="module-btn" onClick={() => setEditingId(null)}>{t('marketplace.mine.cancel')}</button>
                  <button type="button" className="module-btn primary" disabled={saving || !draft.title.trim()} onClick={() => save(l.id)}>{t('marketplace.engagement.save')}</button>
                </div>
              </div>
            ) : confirmDeleteId === l.id ? (
              <div className="mp-mine-actions" role="alertdialog" aria-label={t('marketplace.mine.deleteConfirm')}>
                <span className="mp-mine-confirm">{t('marketplace.mine.deleteConfirm')}</span>
                <button type="button" className="module-btn" onClick={() => setConfirmDeleteId(null)}>{t('marketplace.mine.keep')}</button>
                <button type="button" className="module-btn danger" onClick={() => { setConfirmDeleteId(null); onDelete(l.id) }}>{t('marketplace.mine.delete')}</button>
              </div>
            ) : (
              <div className="mp-mine-actions">
                <button type="button" className="module-btn small" onClick={() => onView(l)}>{t('marketplace.mine.view')}</button>
                <button type="button" className="module-btn small" onClick={() => toggleViews(l.id)}>👀 {t('marketplace.mine.whoViewed')}</button>
                {isOpen && <button type="button" className="module-btn small" onClick={() => startEdit(l)}>{t('marketplace.mine.edit')}</button>}
                {statusKey === 'active' && <button type="button" className="module-btn small primary" onClick={() => onMarkSold(l.id)}>{t('marketplace.mine.markSold')}</button>}
                {statusKey !== 'reserved' && <button type="button" className="module-btn small" onClick={() => { setConfirmDeleteId(l.id); setEditingId(null) }}>{t('marketplace.mine.delete')}</button>}
              </div>
            )}
            {viewsFor === l.id && (
              <div className="mp-mine-views">
                {contactViews.length === 0 ? <p className="mp-compliance-hint">{t('marketplace.mine.noViews')}</p> : (
                  <ul>
                    {contactViews.map((v, i) => (
                      <li key={i}>{v.channel === 'whatsapp' ? '💬' : '📞'} {v.first_name} {v.last_initial ? v.last_initial + '.' : ''} · {new Date(v.created_at).toLocaleString()}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {statusKey === 'reserved' && <p className="mp-compliance-hint">{t('marketplace.mine.reservedHint')}</p>}
          </div>
        )
      })}
    </div>
  )
}
