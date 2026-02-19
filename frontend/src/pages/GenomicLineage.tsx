import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, GeneticProfile, LineagePair } from '../types'

const GenomicLineagePage: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [profiles, setProfiles] = useState<GeneticProfile[]>([])
  const [pairs, setPairs] = useState<LineagePair[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'profiles' | 'pairs'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const [showPairForm, setShowPairForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    animalId: '', sireId: '', damId: '', generation: '', inbreedingCoefficient: '',
    dnaTestDate: '', dnaLab: '', dnaSampleId: '', breedPurityPct: '', notes: ''
  })
  const [pairForm, setPairForm] = useState({
    sireId: '', damId: '', compatibilityScore: '', predictedInbreeding: '',
    recommendation: 'neutral', reason: ''
  })

  useEffect(() => {
    const f = async () => {
      try {
        const res = await apiService.listEnterprises({ limit: 100 })
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      } catch { setEnterprises([]) }
    }
    f()
  }, [])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [profRes, pairRes, dashRes] = await Promise.all([
        apiService.listGeneticProfiles(selectedEnterpriseId),
        apiService.listLineagePairs(selectedEnterpriseId),
        apiService.getGeneticDashboard(selectedEnterpriseId)
      ])
      setProfiles(profRes.data?.items || [])
      setPairs(pairRes.data?.items || [])
      setDashboard(dashRes.data || null)
    } catch { /* fail silently */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createGeneticProfile(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, animalId: formData.animalId,
        sireId: formData.sireId || undefined, damId: formData.damId || undefined,
        generation: parseInt(formData.generation) || 0,
        inbreedingCoefficient: parseFloat(formData.inbreedingCoefficient) || 0,
        dnaTestDate: formData.dnaTestDate || undefined,
        dnaLab: formData.dnaLab || undefined, dnaSampleId: formData.dnaSampleId || undefined,
        breedPurityPct: formData.breedPurityPct ? parseFloat(formData.breedPurityPct) : undefined,
        notes: formData.notes || undefined,
      })
      setSuccessMsg('Genetic profile created!')
      setShowForm(false)
      setFormData({ animalId: '', sireId: '', damId: '', generation: '', inbreedingCoefficient: '', dnaTestDate: '', dnaLab: '', dnaSampleId: '', breedPurityPct: '', notes: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const handleCreatePair = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createLineagePair(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, sireId: pairForm.sireId, damId: pairForm.damId,
        compatibilityScore: parseFloat(pairForm.compatibilityScore) || 0,
        predictedInbreeding: parseFloat(pairForm.predictedInbreeding) || 0,
        recommendation: pairForm.recommendation, reason: pairForm.reason || undefined,
      })
      setSuccessMsg('Breeding pair recommendation created!')
      setShowPairForm(false)
      setPairForm({ sireId: '', damId: '', compatibilityScore: '', predictedInbreeding: '', recommendation: 'neutral', reason: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const recColor = (r: string) => {
    const map: Record<string, string> = { highly_recommended: '#22c55e', recommended: '#84cc16', neutral: '#6b7280', not_recommended: '#f97316', avoid: '#ef4444' }
    return map[r] || '#6b7280'
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🧬 Genomic Lineage & Genetic Diversity</h1>
        <p>Track ancestry trees, inbreeding coefficients, and find optimal breeding pairs</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="enterprise-selector">
        <label>Select Enterprise:</label>
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">-- Select --</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">Select an enterprise to view genetic data</div>
      ) : loading ? (
        <div className="loading-spinner">Loading genetic data…</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'dashboard' ? 'tab-active' : ''} onClick={() => setTab('dashboard')}>Diversity Dashboard</button>
            <button className={tab === 'profiles' ? 'tab-active' : ''} onClick={() => setTab('profiles')}>Genetic Profiles</button>
            <button className={tab === 'pairs' ? 'tab-active' : ''} onClick={() => setTab('pairs')}>Pair Recommendations</button>
          </div>

          {tab === 'dashboard' && dashboard && (
            <div className="dashboard-grid">
              <div className="stat-card accent-green">
                <div className="stat-value">{dashboard.summary?.total || 0}</div>
                <div className="stat-label">Total Profiles</div>
              </div>
              <div className="stat-card accent-orange">
                <div className="stat-value">{(+(dashboard.summary?.avg || 0)).toFixed(4)}</div>
                <div className="stat-label">Avg Inbreeding Coeff.</div>
              </div>
              <div className="stat-card accent-red">
                <div className="stat-value">{dashboard.highRiskInbreeding?.length || 0}</div>
                <div className="stat-label">High-Risk (&gt;0.0625)</div>
              </div>
              <div className="stat-card accent-blue">
                <div className="stat-value">{dashboard.bySpecies?.length || 0}</div>
                <div className="stat-label">Species Tracked</div>
              </div>

              {dashboard.bySpecies?.length > 0 && (
                <div className="card full-width">
                  <h3>📊 Genetic Diversity by Species</h3>
                  <table className="data-table">
                    <thead><tr><th>Species</th><th>Count</th><th>Avg Inbreeding</th></tr></thead>
                    <tbody>{dashboard.bySpecies.map((s: any, i: number) => (
                      <tr key={i}><td>{s.species}</td><td>{s.count}</td><td>{(+s.avg_inbreeding).toFixed(4)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {dashboard.highRiskInbreeding?.length > 0 && (
                <div className="card full-width">
                  <h3>⚠️ High Inbreeding Risk Animals</h3>
                  <table className="data-table">
                    <thead><tr><th>Animal</th><th>Species</th><th>Inbreeding Coeff.</th></tr></thead>
                    <tbody>{dashboard.highRiskInbreeding.map((a: any, i: number) => (
                      <tr key={i}><td>{a.name}</td><td>{a.species}</td><td style={{ color: '#ef4444', fontWeight: 'bold' }}>{(+a.inbreeding_coefficient).toFixed(4)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'profiles' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Genetic Profile'}</button>
              </div>

              {showForm && (
                <form className="module-form" onSubmit={handleCreateProfile}>
                  <div className="form-grid">
                    <div className="form-group"><label>Animal ID *</label><input required value={formData.animalId} onChange={e => setFormData({ ...formData, animalId: e.target.value })} /></div>
                    <div className="form-group"><label>Sire ID</label><input value={formData.sireId} onChange={e => setFormData({ ...formData, sireId: e.target.value })} /></div>
                    <div className="form-group"><label>Dam ID</label><input value={formData.damId} onChange={e => setFormData({ ...formData, damId: e.target.value })} /></div>
                    <div className="form-group"><label>Generation</label><input type="number" value={formData.generation} onChange={e => setFormData({ ...formData, generation: e.target.value })} /></div>
                    <div className="form-group"><label>Inbreeding Coefficient</label><input type="number" step="0.0001" min="0" max="1" value={formData.inbreedingCoefficient} onChange={e => setFormData({ ...formData, inbreedingCoefficient: e.target.value })} /></div>
                    <div className="form-group"><label>DNA Test Date</label><input type="date" value={formData.dnaTestDate} onChange={e => setFormData({ ...formData, dnaTestDate: e.target.value })} /></div>
                    <div className="form-group"><label>DNA Lab</label><input value={formData.dnaLab} onChange={e => setFormData({ ...formData, dnaLab: e.target.value })} /></div>
                    <div className="form-group"><label>DNA Sample ID</label><input value={formData.dnaSampleId} onChange={e => setFormData({ ...formData, dnaSampleId: e.target.value })} /></div>
                    <div className="form-group"><label>Breed Purity %</label><input type="number" min="0" max="100" value={formData.breedPurityPct} onChange={e => setFormData({ ...formData, breedPurityPct: e.target.value })} /></div>
                    <div className="form-group full-width"><label>Notes</label><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">Create Profile</button>
                </form>
              )}

              <table className="data-table">
                <thead><tr><th>Animal</th><th>Species</th><th>Sire</th><th>Dam</th><th>Gen</th><th>Inbreeding</th><th>Purity</th></tr></thead>
                <tbody>
                  {profiles.map(p => (
                    <tr key={p.id}>
                      <td>{p.animalName || (p as any).animal_name || p.animalId}</td>
                      <td>{p.species || '—'}</td>
                      <td>{p.sireName || (p as any).sire_name || '—'}</td>
                      <td>{p.damName || (p as any).dam_name || '—'}</td>
                      <td>{p.generation || (p as any).generation}</td>
                      <td style={{ color: +(p.inbreedingCoefficient || (p as any).inbreeding_coefficient) > 0.0625 ? '#ef4444' : 'inherit' }}>
                        {(+(p.inbreedingCoefficient || (p as any).inbreeding_coefficient || 0)).toFixed(4)}
                      </td>
                      <td>{(p.breedPurityPct || (p as any).breed_purity_pct) ? `${p.breedPurityPct || (p as any).breed_purity_pct}%` : '—'}</td>
                    </tr>
                  ))}
                  {!profiles.length && <tr><td colSpan={7} className="empty-cell">No genetic profiles</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'pairs' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowPairForm(!showPairForm)}>{showPairForm ? 'Cancel' : '+ Add Pair Recommendation'}</button>
              </div>

              {showPairForm && (
                <form className="module-form" onSubmit={handleCreatePair}>
                  <div className="form-grid">
                    <div className="form-group"><label>Sire ID *</label><input required value={pairForm.sireId} onChange={e => setPairForm({ ...pairForm, sireId: e.target.value })} /></div>
                    <div className="form-group"><label>Dam ID *</label><input required value={pairForm.damId} onChange={e => setPairForm({ ...pairForm, damId: e.target.value })} /></div>
                    <div className="form-group"><label>Compatibility Score (0-100)</label><input type="number" min="0" max="100" value={pairForm.compatibilityScore} onChange={e => setPairForm({ ...pairForm, compatibilityScore: e.target.value })} /></div>
                    <div className="form-group"><label>Predicted Inbreeding</label><input type="number" step="0.0001" min="0" max="1" value={pairForm.predictedInbreeding} onChange={e => setPairForm({ ...pairForm, predictedInbreeding: e.target.value })} /></div>
                    <div className="form-group"><label>Recommendation</label>
                      <select value={pairForm.recommendation} onChange={e => setPairForm({ ...pairForm, recommendation: e.target.value })}>
                        <option value="highly_recommended">Highly Recommended</option>
                        <option value="recommended">Recommended</option>
                        <option value="neutral">Neutral</option>
                        <option value="not_recommended">Not Recommended</option>
                        <option value="avoid">Avoid</option>
                      </select>
                    </div>
                    <div className="form-group full-width"><label>Reason</label><textarea value={pairForm.reason} onChange={e => setPairForm({ ...pairForm, reason: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">Create Pair Recommendation</button>
                </form>
              )}

              <div className="cards-grid">
                {pairs.map(p => (
                  <div key={p.id} className="card" style={{ borderLeft: `4px solid ${recColor(p.recommendation || (p as any).recommendation)}` }}>
                    <h3>♂ {p.sireName || (p as any).sire_name} × ♀ {p.damName || (p as any).dam_name}</h3>
                    <div className="card-meta">
                      <span className="badge" style={{ backgroundColor: recColor(p.recommendation || (p as any).recommendation) }}>{(p.recommendation || (p as any).recommendation).replace(/_/g, ' ')}</span>
                    </div>
                    <div className="card-stats">
                      <div><strong>{+(p.compatibilityScore || (p as any).compatibility_score)}</strong> compatibility</div>
                      <div><strong>{(+(p.predictedInbreeding || (p as any).predicted_inbreeding || 0)).toFixed(4)}</strong> pred. inbreeding</div>
                    </div>
                    {(p.reason) && <p className="card-note">{p.reason}</p>}
                  </div>
                ))}
                {!pairs.length && <div className="empty-state">No pair recommendations yet</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default GenomicLineagePage
