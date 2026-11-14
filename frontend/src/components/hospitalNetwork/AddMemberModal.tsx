import React, { useState, useEffect } from 'react'
import apiService from '../../services/api'
import { MEMBER_ROLES, NetworkHospital } from './hospitalNetworksShared'

export interface AddMemberModalProps {
  networkId: string
  networkHospitals: NetworkHospital[]
  onClose: () => void
  onAdded: () => void
  onInviteInstead: () => void
  t: (key: string) => string
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ networkId, networkHospitals, onClose, onAdded, onInviteInstead, t }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; role: string }>>([])
  const [selectedUser, setSelectedUser] = useState<{ id: string; firstName: string; lastName: string; email: string; role: string } | null>(null)
  const [searching, setSearching] = useState(false)
  const [networkRole, setNetworkRole] = useState('hospital_staff')
  const [hospitalId, setHospitalId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // The candidate list is bounded by this network's own hospitals, so it is small enough to
  // load up front - an empty query returns every eligible person. That is why there is no
  // minimum length here any more: typing filters an already-visible list rather than being
  // the only way to see one.
  useEffect(() => {
    if (selectedUser) return
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await apiService.searchNetworkUsers(networkId, searchQuery)
        setSearchResults(res.data?.data || [])
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, searchQuery ? 350 : 0)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedUser, networkId])

  const handleAdd = async () => {
    if (!selectedUser) { setError('Please search and select a user first'); return }
    setSaving(true); setError('')
    try {
      await apiService.addNetworkMember(networkId, {
        userId: selectedUser.id,
        networkRole,
        hospitalId: hospitalId || undefined,
        notes: notes || undefined,
      })
      onAdded()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to add member')
    } finally { setSaving(false) }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal hn-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>➕ {t('hospitalNetworks.detail.addMember')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="hn-modal-body">
          {error && <div className="module-alert error">{error}</div>}

          <div className="module-form-group">
            <label className="module-label">Search User <span className="si-19136384">*</span></label>
            <input
              className="module-input"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedUser(null) }}
              placeholder="Filter by name or email..."
              autoFocus
            />
            <p className="hn-field-hint">
              Staff and doctors at this network&apos;s hospitals who are not members yet.
            </p>
            {searching && <p className="si-acff8193">🔍 Searching...</p>}

            {searchResults.length > 0 && !selectedUser && (
              <div className="si-22cbcd6a">
                {searchResults.map(u => (
                  <div
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setSearchQuery(`${u.firstName} ${u.lastName} (${u.email})`) }}
                    className="si-632b9cb5"
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <span className="si-a9b7f385">{u.firstName} {u.lastName}</span>
                    <span className="si-48a0b045">{u.email} • {u.role}</span>
                  </div>
                ))}
              </div>
            )}
            {searchResults.length === 0 && !searching && !selectedUser && (
              <div className="si-fa4fc649">
                <p className="si-519a52ea">
                  {searchQuery
                    ? `No one at this network's hospitals matches "${searchQuery}".`
                    : 'Everyone at this network’s hospitals is already a member.'}
                </p>
                <p className="si-79d4f0fa">
                  To bring in someone who does not work at a branch hospital yet, invite them by email.
                </p>
                <button
                  type="button"
                  onClick={onInviteInstead}
                  className="si-20f10f40"
                >
                  ✉️ Invite them by email instead →
                </button>
              </div>
            )}

            {selectedUser && (
              <div className="si-b6f52d6c">
                <div>
                  <span className="si-b2cfcbec">✅ {selectedUser.firstName} {selectedUser.lastName}</span>
                  <span className="si-824a7a1e">{selectedUser.email}</span>
                </div>
                <button type="button" className="si-4b47cdf7" onClick={() => { setSelectedUser(null); setSearchQuery('') }}>✕</button>
              </div>
            )}
          </div>

          <div className="module-form-group">
            <label className="module-label">Network Role</label>
            <select className="module-input" value={networkRole} onChange={e => setNetworkRole(e.target.value)}>
              {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {networkHospitals.length > 0 && (
            <div className="module-form-group">
              <label className="module-label">Assign to Branch Hospital <span className="si-f7764c70">(optional)</span></label>
              <select className="module-input" value={hospitalId} onChange={e => setHospitalId(e.target.value)}>
                <option value="">- Not assigned to specific hospital -</option>
                {networkHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
          )}

          <div className="module-form-group">
            <label className="module-label">Notes <span className="si-f7764c70">(optional)</span></label>
            <input className="module-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Head of Cardiology" />
          </div>

          {!selectedUser && (
            <p className="si-513c70eb">⚠️ Required: Search and select a user above to enable adding</p>
          )}
          <p className="si-2c2a1863">* Required field. User must already have a waytovet account.</p>
        </div>

        <div className="hn-modal-actions si-70412b08">
          <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="module-btn primary" disabled={saving || !selectedUser} onClick={handleAdd}>
            {saving ? '⏳ Adding...' : `➕ ${t('hospitalNetworks.detail.addMember')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddMemberModal
