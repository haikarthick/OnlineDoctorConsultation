import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import { Medication } from '../../types'
import '../../styles/modules.css'

interface PrescriptionWriterProps {
  consultationId?: string
  onNavigate: (path: string) => void
}

const PrescriptionWriter: React.FC<PrescriptionWriterProps> = ({ consultationId, onNavigate }) => {
  void useAuth() // ensure auth context
  const params = new URLSearchParams(window.location.search)
  const conId = consultationId || params.get('consultationId') || ''

  // Pre-populate medications from query param (Common Prescriptions templates)
  const getInitialMeds = (): Medication[] => {
    try {
      const medsParam = params.get('meds')
      if (medsParam) return JSON.parse(decodeURIComponent(medsParam))
    } catch { /* ignore parse errors */ }
    return []
  }

  const [diagnosis, setDiagnosis] = useState('')
  const [instructions, setInstructions] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [medications, setMedications] = useState<Medication[]>(getInitialMeds)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // New med form
  const [newMed, setNewMed] = useState<Medication>({
    name: '', dosage: '', frequency: '', duration: '', instructions: ''
  })

  const addMedication = () => {
    if (!newMed.name || !newMed.dosage || !newMed.frequency) {
      setError('Please fill in medication name, dosage, and frequency')
      return
    }
    setMedications([...medications, { ...newMed }])
    setNewMed({ name: '', dosage: '', frequency: '', duration: '', instructions: '' })
    setError('')
  }

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!diagnosis.trim()) { setError('Diagnosis is required'); return }
    if (medications.length === 0) { setError('At least one medication is required'); return }

    try {
      setSubmitting(true)
      await apiService.createPrescription({
        consultationId: conId,
        diagnosis,
        medications,
        instructions: instructions || '',
        followUpDate: followUpDate || undefined
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create prescription')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="module-page">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>💊</div>
          <h1 style={{ marginBottom: 8 }}>Prescription Created</h1>
          <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 24 }}>
            {medications.length} medication{medications.length > 1 ? 's' : ''} prescribed
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {conId && (
              <button className="btn btn-primary" onClick={() => onNavigate(`/doctor/consultation-room/${conId}`)}>
                ← Back to Consultation
              </button>
            )}
            <button className="btn btn-outline" onClick={() => onNavigate('/doctor/dashboard')}>
              Dashboard
            </button>
            <button className="btn btn-outline" onClick={() => { setSubmitted(false); setMedications([]); setDiagnosis(''); }}>
              Write Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Prescription Writer</h1>
          <p className="page-subtitle">Create a new prescription for your patient</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate(conId ? `/doctor/consultation-room/${conId}` : '/doctor/dashboard')}>
            ← Back
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left: Diagnosis & Instructions */}
          <div>
            <div className="card">
              <div className="card-header"><h2>🩺 Diagnosis & Notes</h2></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Diagnosis *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Enter diagnosis..."
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">General Instructions</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Dietary restrictions, activity level, warnings..."
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Follow-up Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Medications */}
          <div>
            <div className="card">
              <div className="card-header">
                <h2>💊 Medications ({medications.length})</h2>
              </div>
              <div className="card-body">
                {/* Current Medications */}
                {medications.map((med, i) => (
                  <div key={i} style={{
                    padding: 12, background: '#f0fdf4', borderRadius: 8, marginBottom: 10,
                    border: '1px solid #bbf7d0', position: 'relative'
                  }}>
                    <button
                      type="button"
                      style={{
                        position: 'absolute', top: 6, right: 6, background: 'none',
                        border: 'none', cursor: 'pointer', fontSize: 16, color: '#dc2626'
                      }}
                      onClick={() => removeMedication(i)}
                    >✕</button>
                    <strong>{med.name}</strong>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4b5563' }}>
                      {med.dosage} • {med.frequency} • {med.duration || 'As needed'}
                    </p>
                    {med.instructions && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                        📝 {med.instructions}
                      </p>
                    )}
                  </div>
                ))}

                {/* Add Medication Form */}
                <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px dashed #d1d5db' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>+ Add Medication</h4>
                  <div className="form-group">
                    <input className="form-input" placeholder="Medication name *" value={newMed.name}
                      onChange={e => setNewMed({ ...newMed, name: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input className="form-input" placeholder="Dosage *" value={newMed.dosage}
                      onChange={e => setNewMed({ ...newMed, dosage: e.target.value })} />
                    <input className="form-input" placeholder="Frequency *" value={newMed.frequency}
                      onChange={e => setNewMed({ ...newMed, frequency: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <input className="form-input" placeholder="Duration" value={newMed.duration}
                      onChange={e => setNewMed({ ...newMed, duration: e.target.value })} />
                    <input className="form-input" placeholder="Instructions" value={newMed.instructions}
                      onChange={e => setNewMed({ ...newMed, instructions: e.target.value })} />
                  </div>
                  <button type="button" className="btn btn-outline" style={{ marginTop: 10, width: '100%' }} onClick={addMedication}>
                    + Add Medication
                  </button>
                </div>

                {/* Quick Add Templates */}
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Quick add:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily', duration: '7 days' },
                      { name: 'Meloxicam', dosage: '0.1mg/kg', frequency: 'Once daily', duration: '5 days' },
                      { name: 'Metronidazole', dosage: '15mg/kg', frequency: 'Twice daily', duration: '10 days' }
                    ].map(template => (
                      <button
                        key={template.name}
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        onClick={() => setMedications([...medications, { ...template, instructions: '' }])}
                      >
                        + {template.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" className="btn btn-outline" onClick={() => onNavigate(conId ? `/doctor/consultation-room/${conId}` : '/doctor/dashboard')}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? 'Creating...' : '💊 Create Prescription'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PrescriptionWriter
