import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import apiService from '../services/api'
import './ModulePage.css'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { Enterprise, ENTERPRISE_TYPE_LABELS, EnterpriseType, EnterpriseStats, EnterpriseMember } from '../types'
import MapView from '../components/MapView'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../context/MasterDataContext'

const EnterpriseManagement: React.FC = () => {
  const { t } = useTranslation()
  const { speciesLabel } = useMasterData()

  const { user } = useAuth()
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [editingEnterprise, setEditingEnterprise] = useState<Enterprise | null>(null)
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null)
  const [stats, setStats] = useState<EnterpriseStats | null>(null)
  const [members, setMembers] = useState<EnterpriseMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '', enterpriseType: '' as EnterpriseType, description: '',
    address: '', city: '', state: '', country: 'US', postalCode: '',
    totalArea: '', areaUnit: 'acres', licenseNumber: '', regulatoryId: '',
    taxId: '', phone: '', email: '', website: '',
    gpsLatitude: '', gpsLongitude: ''
  })
  const [showMapOverview, setShowMapOverview] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const isAdmin = user?.role === 'admin'

  const fetchEnterprises = async () => {
    try {
      setLoading(true)
      const res = await apiService.listEnterprises({ limit: 100 })
      setEnterprises(res.data?.items || [])
    } catch { setEnterprises([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchEnterprises() }, [])

  const fetchStats = async (id: string) => {
    try {
      const res = await apiService.getEnterpriseStats(id)
      setStats(res.data)
    } catch { setStats(null) }
  }

  const fetchMembers = async (id: string) => {
    try {
      setMembersLoading(true)
      const res = await apiService.listEnterpriseMembers(id)
      setMembers(res.data || [])
    } catch { setMembers([]) }
    finally { setMembersLoading(false) }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError('')
    if (!inviteEmail || !inviteRole) {
      setInviteError('Email and role are required')
      return
    }
    if (!selectedEnterprise) return
    setInviteLoading(true)
    try {
      await apiService.inviteEnterpriseMember(selectedEnterprise.id, { email: inviteEmail, role: inviteRole })
      setSuccessMsg('Member invited successfully')
      setInviteEmail(''); setInviteRole('viewer')
      setShowInviteModal(false)
      fetchMembers(selectedEnterprise.id)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to invite member')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    if (!selectedEnterprise) return
    setUpdatingMemberId(userId)
    try {
      await apiService.updateEnterpriseMember(selectedEnterprise.id, userId, { role: newRole })
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole as EnterpriseMember['role'] } : m))
      setSuccessMsg('Member role updated')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update role')
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedEnterprise) return
    if (!window.confirm('Remove this member from the enterprise?')) return
    try {
      await apiService.removeEnterpriseMember(selectedEnterprise.id, userId)
      setMembers(prev => prev.filter(m => m.userId !== userId))
      setSuccessMsg('Member removed')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', enterpriseType: '' as EnterpriseType, description: '',
      address: '', city: '', state: '', country: 'US', postalCode: '',
      totalArea: '', areaUnit: 'acres', licenseNumber: '', regulatoryId: '',
      taxId: '', phone: '', email: '', website: '',
      gpsLatitude: '', gpsLongitude: ''
    })
    setEditingEnterprise(null)
    setError('')
  }

  const openEdit = (ent: Enterprise) => {
    setEditingEnterprise(ent)
    setFormData({
      name: ent.name, enterpriseType: ent.enterpriseType, description: ent.description || '',
      address: ent.address || '', city: ent.city || '', state: ent.state || '',
      country: ent.country || 'US', postalCode: ent.postalCode || '',
      totalArea: ent.totalArea?.toString() || '', areaUnit: ent.areaUnit || 'acres',
      licenseNumber: ent.licenseNumber || '', regulatoryId: ent.regulatoryId || '',
      taxId: ent.taxId || '', phone: ent.phone || '', email: ent.email || '', website: ent.website || '',
      gpsLatitude: ent.gpsLatitude?.toString() || '', gpsLongitude: ent.gpsLongitude?.toString() || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.name || !formData.enterpriseType) {
      setError('Name and enterprise type are required')
      return
    }
    try {
      const payload: any = {
        ...formData,
        totalArea: formData.totalArea ? parseFloat(formData.totalArea) : undefined,
        gpsLatitude: formData.gpsLatitude ? parseFloat(formData.gpsLatitude) : undefined,
        gpsLongitude: formData.gpsLongitude ? parseFloat(formData.gpsLongitude) : undefined,
      }
      if (editingEnterprise) {
        await apiService.updateEnterprise(editingEnterprise.id, payload)
        setSuccessMsg('Enterprise updated successfully')
      } else {
        await apiService.createEnterprise(payload)
        setSuccessMsg('Enterprise created successfully')
      }
      resetForm()
      setShowForm(false)
      fetchEnterprises()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.failedToSave'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('enterpriseManagement.deactivateConfirm'))) return
    try {
      await apiService.deleteEnterprise(id)
      setSuccessMsg(t('enterpriseManagement.deactivated'))
      fetchEnterprises()
      if (selectedEnterprise?.id === id) setSelectedEnterprise(null)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.failedToDelete'))
    }
  }

  const selectEnterprise = (ent: Enterprise) => {
    setSelectedEnterprise(ent)
    fetchStats(ent.id)
    fetchMembers(ent.id)
  }

  const filtered = enterprises.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ENTERPRISE_TYPE_LABELS[e.enterpriseType] || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const typeIcon = (t: EnterpriseType) => {
    const icons: Record<string, string> = {
      dairy_farm: '🐄', poultry_farm: '🐔', cattle_ranch: '🐂', mixed_farm: '🌾',
      zoo: '🦁', breeding_facility: '🧬', pet_shop: '🐾', sanctuary: '🏔️',
      equestrian_center: '🐴', aquaculture: '🐟', wildlife_reserve: '🌿',
      veterinary_clinic: '🏥', kennel: '🐕', cattery: '🐈', aviary: '🦜', other: '🏢'
    }
    return icons[t] || '🏢'
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('enterpriseManagement.pageTitle')}</h1>
          <p className="subtitle">{t('enterpriseManagement.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className={`btn ${showMapOverview ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowMapOverview(!showMapOverview)}>
            🗺️ {showMapOverview ? 'Hide Map' : 'Map View'}
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
            + New Enterprise
          </button>
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && !showForm && <div className="alert alert-error">{error}</div>}

      {/* Search */}
      <div className="filters-bar">
        <input
          type="text" placeholder={t('enterpriseManagement.searchPlaceholder')} className="search-input"
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Enterprise Map Overview */}
      {showMapOverview && (
        <div className="si-a87c8813">
          <div className="si-5214c8b8">
            <h3 className="si-44087c4b">🗺️ Enterprise Locations</h3>
            <p className="si-29492778">
              {enterprises.filter(e => e.gpsLatitude && e.gpsLongitude).length} of {enterprises.length} enterprises have GPS coordinates
            </p>
          </div>
          <MapView
            height={400}
            markers={enterprises.filter(e => e.gpsLatitude && e.gpsLongitude).map(ent => ({
              id: ent.id,
              lat: +(ent.gpsLatitude || 0),
              lng: +(ent.gpsLongitude || 0),
              color: selectedEnterprise?.id === ent.id ? '#3b82f6' : '#22c55e',
              pulse: selectedEnterprise?.id === ent.id,
              popup: (
                <div>
                  <strong>{typeIcon(ent.enterpriseType)} {ent.name}</strong><br />
                  <span className="si-756a9f21">{ENTERPRISE_TYPE_LABELS[ent.enterpriseType] || ent.enterpriseType}</span><br />
                  {ent.city && <span className="si-756a9f21">{ent.city}{ent.state ? `, ${ent.state}` : ''}</span>}
                  <div className="si-692258ce">
                    👥 {ent.memberCount || 0} members · 🐾 {ent.animalCount || 0} animals
                  </div>
                </div>
              ),
            }))}
            fitToData={enterprises.filter(e => e.gpsLatitude && e.gpsLongitude).length > 0}
          />
        </div>
      )}

      <div className="si-dcfaac94">
        {/* Enterprise List */}
        <div className="si-03587c55">
          {loading ? (
            <div className="loading-spinner">{t('enterpriseManagement.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏢</div>
              <h3>{t('enterpriseManagement.emptyTitle')}</h3>
              <p>{t('enterpriseManagement.emptySubtitle')}</p>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
                + Create Enterprise
              </button>
            </div>
          ) : (
            <div className="cards-grid si-243e7be2">
              {filtered.map(ent => (
                <div key={ent.id}
                  className={`card ${selectedEnterprise?.id === ent.id ? 'card-selected' : ''}`}
                  style={{ cursor: 'pointer', border: selectedEnterprise?.id === ent.id ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}
                  onClick={() => selectEnterprise(ent)}
                >
                  <div className="si-d2493201">
                    <span className="si-fc27df36">{typeIcon(ent.enterpriseType)}</span>
                    <div>
                      <h3 className="si-2a119c30">{ent.name}</h3>
                      <span className="badge si-8c23064b">{ENTERPRISE_TYPE_LABELS[ent.enterpriseType] || ent.enterpriseType}</span>
                    </div>
                  </div>
                  {ent.address && <p className="si-cf622af4">📍 {ent.city ? `${ent.city}, ${ent.state || ''}` : ent.address}</p>}
                  <div className="si-53035512">
                    <span>👥 {ent.memberCount || 0} members</span>
                    <span>🐾 {ent.animalCount || 0} animals</span>
                  </div>
                  <div className="si-3429dc13">
                    <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); openEdit(ent) }}>{t('common.edit')}</button>
                    {(isAdmin || ent.ownerId === user?.id) && (
                      <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleDelete(ent.id) }}>{t('common.delete')}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Panel */}
        {selectedEnterprise && stats && (
          <div className="si-78b34307">
            <h3 className="si-7f683059">{selectedEnterprise.name} - Overview</h3>
            <div className="si-b2577ace">
              <div className="si-6e899795">
                <div className="si-7729e24e">{stats.totalAnimals}</div>
                <div className="si-93f5e4c5">Animals</div>
              </div>
              <div className="si-6e899795">
                <div className="si-7729e24e">{stats.totalGroups}</div>
                <div className="si-93f5e4c5">Groups</div>
              </div>
              <div className="si-6e899795">
                <div className="si-7729e24e">{stats.totalLocations}</div>
                <div className="si-93f5e4c5">Locations</div>
              </div>
              <div className="si-6e899795">
                <div className="si-7729e24e">{stats.totalMembers}</div>
                <div className="si-93f5e4c5">Members</div>
              </div>
            </div>
            {stats.animalsBySpecies.length > 0 && (
              <div className="si-216c99b7">
                <h4 className="si-305f3e0a">Animals by Species</h4>
                {stats.animalsBySpecies.map(s => (
                  <div key={s.species} className="si-4721f179">
                    <span>{speciesLabel(s.species, t)}</span>
                    <span className="si-b2cfcbec">{s.count}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedEnterprise.licenseNumber && (
              <div className="si-c9622f6f">
                📋 License: {selectedEnterprise.licenseNumber}
              </div>
            )}
            {selectedEnterprise.regulatoryId && (
              <div className="si-62bd76f7">
                🏛️ Regulatory ID: {selectedEnterprise.regulatoryId}
              </div>
            )}
            {selectedEnterprise.gpsLatitude && selectedEnterprise.gpsLongitude && (
              <div className="si-1f1ebdcd">
                <MapView
                  height={180}
                  center={[+(selectedEnterprise.gpsLatitude), +(selectedEnterprise.gpsLongitude)]}
                  zoom={14}
                  markers={[{
                    id: 'selected-ent',
                    lat: +(selectedEnterprise.gpsLatitude),
                    lng: +(selectedEnterprise.gpsLongitude),
                    color: '#3b82f6',
                    popup: <div><strong>{selectedEnterprise.name}</strong></div>,
                  }]}
                />
              </div>
            )}
          </div>
        )}

        {/* Members Panel */}
        {selectedEnterprise && (
          <div className="si-78b34307">
            <div className="si-c66b816b">
              <h3 className="si-1b87764a">👥 {t('enterpriseManagement.tabs.members')}</h3>
              {(isAdmin || selectedEnterprise.ownerId === user?.id) && (
                <button className="btn btn-sm btn-primary" onClick={() => { setShowInviteModal(true); setInviteError('') }}>+ Invite</button>
              )}
            </div>
            {membersLoading ? (
              <p className="si-62bd76f7">Loading...</p>
            ) : members.length === 0 ? (
              <p className="si-62bd76f7">No members yet</p>
            ) : (
              <div className="si-bbd60ea4">
                {members.map(m => (
                  <div key={m.userId} className="si-e162b4a6">
                    <div className="si-26d7edc3">
                      <div className="si-2d596e02">{m.userName || m.userEmail || m.userId.slice(0, 8)}</div>
                      <div className="si-93f5e4c5">{m.userEmail}</div>
                    </div>
                    {m.role !== 'owner' && (isAdmin || selectedEnterprise.ownerId === user?.id) ? (
                      <>
                        <select
                          value={m.role}
                          disabled={updatingMemberId === m.userId}
                          className="si-9c640ad7"
                          onChange={e => handleUpdateMemberRole(m.userId, e.target.value)}
                        >
                          <option value="manager">Manager</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="farm_vet">Farm Vet</option>
                          <option value="worker">Worker</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button className="btn btn-sm btn-danger si-a517fcb0" onClick={() => handleRemoveMember(m.userId)}>✗</button>
                      </>
                    ) : (
                      <span className="badge si-a517fcb0">{m.role}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && <div className="edit-form-overlay" onClick={() => setShowInviteModal(false)} />}
      {showInviteModal && (
        <div className="edit-form-panel si-4b1b6758">
          <div className="si-c66b816b">
            <h2 className="si-44087c4b">Invite Member</h2>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowInviteModal(false)}>✕</button>
          </div>
          <form onSubmit={handleInviteMember}>
            {inviteError && <div className="alert alert-error si-1cb81cae">{inviteError}</div>}
            <div className="form-group">
              <label>Email Address <span className="si-4fb20e94">*</span></label>
              <input
                type="email" required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="module-input"
              />
            </div>
            <div className="form-group">
              <label>Role <span className="si-4fb20e94">*</span></label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="module-input">
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
                <option value="farm_vet">Farm Vet</option>
                <option value="worker">Worker</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            {!inviteEmail && <p className="si-6ea836c5">⚠️ Enter a registered user's email to proceed</p>}
            <p className="si-5047a40e">* Required field</p>
            <div className="si-7a8f2044">
              <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!inviteEmail || inviteLoading}>
                {inviteLoading ? '⏳ Inviting...' : '+ Invite Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false); resetForm() }} />}
      {showForm && (
        <div ref={formRef} className="edit-form-panel">
            <h2>{editingEnterprise ? t('enterpriseManagement.modal.editTitle') : t('enterpriseManagement.modal.createTitle')}</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="si-ec24da01">
                <div className="form-group si-06af062a">
                  <label>Enterprise Name *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required />
                </div>

                <div className="form-group">
                  <label>Enterprise Type *</label>
                  <select value={formData.enterpriseType} onChange={e => setFormData(f => ({ ...f, enterpriseType: e.target.value as EnterpriseType }))} required>
                    <option value="">Select type...</option>
                    {Object.entries(ENTERPRISE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} />
                </div>

                <div className="form-group si-06af062a">
                  <label>Description</label>
                  <textarea rows={2} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="form-group si-06af062a">
                  <label>Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>City</label>
                  <input type="text" value={formData.city} onChange={e => setFormData(f => ({ ...f, city: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>State</label>
                  <input type="text" value={formData.state} onChange={e => setFormData(f => ({ ...f, state: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Country</label>
                  <input type="text" value={formData.country} onChange={e => setFormData(f => ({ ...f, country: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Postal Code</label>
                  <input type="text" value={formData.postalCode} onChange={e => setFormData(f => ({ ...f, postalCode: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Total Area</label>
                  <div className="si-6fdaaf49">
                    <input type="number" step="0.01" value={formData.totalArea} onChange={e => setFormData(f => ({ ...f, totalArea: e.target.value }))} className="si-6acd75e8" />
                    <select value={formData.areaUnit} onChange={e => setFormData(f => ({ ...f, areaUnit: e.target.value }))} className="si-fccc6ec7">
                      <option value="acres">Acres</option>
                      <option value="hectares">Hectares</option>
                      <option value="sqft">Sq Ft</option>
                      <option value="sqm">Sq M</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>License Number</label>
                  <input type="text" value={formData.licenseNumber} onChange={e => setFormData(f => ({ ...f, licenseNumber: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Regulatory ID</label>
                  <input type="text" value={formData.regulatoryId} onChange={e => setFormData(f => ({ ...f, regulatoryId: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Tax ID</label>
                  <input type="text" value={formData.taxId} onChange={e => setFormData(f => ({ ...f, taxId: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Website</label>
                  <input type="url" value={formData.website} onChange={e => setFormData(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                </div>

                <div className="form-group">
                  <label>GPS Latitude</label>
                  <input type="number" step="0.000001" placeholder="Click map below" value={formData.gpsLatitude} onChange={e => setFormData(f => ({ ...f, gpsLatitude: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>GPS Longitude</label>
                  <input type="number" step="0.000001" placeholder="Click map below" value={formData.gpsLongitude} onChange={e => setFormData(f => ({ ...f, gpsLongitude: e.target.value }))} />
                </div>

                <div className="form-group si-06af062a">
                  <label>📍 Set Location on Map</label>
                  <div className="si-acec1d66">
                    <MapView
                      height={200}
                      markers={formData.gpsLatitude && formData.gpsLongitude ? [{
                        id: 'ent-form-loc',
                        lat: +formData.gpsLatitude,
                        lng: +formData.gpsLongitude,
                        color: '#3b82f6',
                        pulse: true,
                        popup: <div><strong>{formData.name || 'Enterprise'}</strong></div>,
                      }] : []}
                      onClick={(lat, lng) => setFormData(f => ({ ...f, gpsLatitude: lat.toFixed(6), gpsLongitude: lng.toFixed(6) }))}
                      center={formData.gpsLatitude && formData.gpsLongitude ? [+formData.gpsLatitude, +formData.gpsLongitude] : undefined}
                      zoom={formData.gpsLatitude ? 13 : undefined}
                    />
                  </div>
                </div>
              </div>

              <div className="si-9a4d96fa">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm() }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{editingEnterprise ? 'Update' : 'Create'} Enterprise</button>
              </div>
            </form>
        </div>
      )}
    </div>
  )
}

export default EnterpriseManagement
