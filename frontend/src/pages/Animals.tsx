import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'

interface Animal {
  id: string
  name: string
  species: string
  breed?: string
  dateOfBirth?: string
  gender?: string
  weight?: number
  color?: string
  medicalNotes?: string
}

const Animals: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '', species: '', breed: '', gender: '', weight: '', color: '', medicalNotes: ''
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchAnimals = async () => {
    try {
      setLoading(true)
      const res = await apiService.listAnimals()
      setAnimals(res.data?.animals || [])
    } catch {
      // On mock/dev, use placeholder data
      setAnimals([
        { id: '1', name: 'Buddy', species: 'Dog', breed: 'Golden Retriever', gender: 'male', weight: 30, color: 'Golden' },
        { id: '2', name: 'Whiskers', species: 'Cat', breed: 'Persian', gender: 'female', weight: 4, color: 'White' },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnimals() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await apiService.createAnimal({
        name: formData.name,
        species: formData.species,
        breed: formData.breed || undefined,
        gender: formData.gender || undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        color: formData.color || undefined,
        medicalNotes: formData.medicalNotes || undefined,
      })
      setSuccessMsg('Animal added successfully!')
      setShowForm(false)
      setFormData({ name: '', species: '', breed: '', gender: '', weight: '', color: '', medicalNotes: '' })
      fetchAnimals()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to add animal')
    }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🐾 My Animals</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Animal'}
        </button>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="module-content" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSubmit} className="inline-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Species *</label>
                <select value={formData.species} onChange={e => setFormData(p => ({ ...p, species: e.target.value }))} required>
                  <option value="">Select species</option>
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                  <option value="Bird">Bird</option>
                  <option value="Horse">Horse</option>
                  <option value="Cattle">Cattle</option>
                  <option value="Sheep">Sheep</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Breed</label>
                <input type="text" value={formData.breed} onChange={e => setFormData(p => ({ ...p, breed: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="form-group">
                <label>Weight (kg)</label>
                <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData(p => ({ ...p, weight: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Color</label>
                <input type="text" value={formData.color} onChange={e => setFormData(p => ({ ...p, color: e.target.value }))} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Medical Notes</label>
              <textarea value={formData.medicalNotes} onChange={e => setFormData(p => ({ ...p, medicalNotes: e.target.value }))} rows={2} />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>Save Animal</button>
          </form>
        </div>
      )}

      <div className="module-content">
        {loading ? (
          <p>Loading animals...</p>
        ) : animals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🐾</div>
            <h3>No animals yet</h3>
            <p>Add your first pet or farm animal to get started.</p>
          </div>
        ) : (
          <div className="appointment-grid">
            {animals.map(animal => (
              <div key={animal.id} className="appointment-card">
                <div className="appointment-icon">
                  {animal.species === 'Dog' ? '🐕' : animal.species === 'Cat' ? '🐈' : animal.species === 'Bird' ? '🐦' : animal.species === 'Horse' ? '🐴' : '🐾'}
                </div>
                <div className="appointment-info">
                  <h3>{animal.name}</h3>
                  <p className="date">{animal.species}{animal.breed ? ` • ${animal.breed}` : ''}</p>
                  {animal.gender && <p className="time">Gender: {animal.gender}</p>}
                  {animal.weight && <p className="type">Weight: {animal.weight} kg</p>}
                  {animal.color && <p className="type">Color: {animal.color}</p>}
                  <div className="appointment-footer">
                    <button className="btn-small">View Records</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .inline-form { background: white; padding: 20px; border-radius: 12px; border: 1px solid #e0e0e0; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .form-grid .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-grid .form-group label { font-size: 12px; font-weight: 600; color: #555; }
        .form-grid .form-group input, .form-grid .form-group select { padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
        .form-grid .form-group input:focus, .form-grid .form-group select:focus { outline: none; border-color: #667eea; }
        .inline-form textarea { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; }
        .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-weight: 500; }
        .alert-success { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
        .alert-error { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
        .empty-state { text-align: center; padding: 60px 20px; }
        .empty-icon { font-size: 64px; margin-bottom: 16px; }
        .empty-state h3 { font-size: 20px; color: #333; margin-bottom: 8px; }
        .empty-state p { color: #666; }
      `}</style>
    </div>
  )
}

export default Animals
