import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import './ModulePage.css'

// ─── Breed Database by Species ──────────────────────────────
const BREED_DATABASE: Record<string, string[]> = {
  Dog: ['Labrador Retriever','German Shepherd','Golden Retriever','French Bulldog','Bulldog','Poodle','Beagle','Rottweiler','Dachshund','Yorkshire Terrier','Boxer','Siberian Husky','Great Dane','Doberman Pinscher','Shih Tzu','Border Collie','Pomeranian','Chihuahua','Cocker Spaniel','Australian Shepherd','Maltese','Cavalier King Charles Spaniel','Pug','Dalmatian','Bernese Mountain Dog','Saint Bernard','Jack Russell Terrier','Indian Pariah Dog','Rajapalayam','Mudhol Hound','Kombai','Kanni','Rampur Greyhound','Chippiparai'],
  Cat: ['Persian','Maine Coon','Ragdoll','British Shorthair','Abyssinian','Siamese','Bengal','Sphynx','Russian Blue','Scottish Fold','Norwegian Forest Cat','Birman','American Shorthair','Bombay','Burmese','Himalayan','Devon Rex','Exotic Shorthair','Tonkinese','Turkish Angora'],
  Bird: ['Budgerigar','Cockatiel','African Grey Parrot','Macaw','Cockatoo','Lovebird','Canary','Finch','Conure','Amazon Parrot','Eclectus Parrot','Indian Ringneck','Mynah','Pigeon','Chicken','Duck','Turkey','Quail','Peacock','Emu'],
  Horse: ['Thoroughbred','Arabian','Quarter Horse','Appaloosa','Morgan','Tennessee Walker','Clydesdale','Friesian','Mustang','Paint Horse','Andalusian','Hanoverian','Warmblood','Marwari','Kathiawari','Manipuri Pony','Zanskari','Spiti'],
  Cattle: ['Holstein Friesian','Jersey','Angus','Hereford','Brahman','Charolais','Simmental','Guernsey','Gir','Sahiwal','Red Sindhi','Tharparkar','Ongole','Kankrej','Rathi','Deoni','Hariana','Murrah (Buffalo)','Jaffarabadi (Buffalo)','Mehsana (Buffalo)'],
  Sheep: ['Merino','Suffolk','Dorper','Hampshire','Texel','Corriedale','Rambouillet','Nellore','Deccan','Marwari','Chokla','Jaisalmeri','Magra','Malpura','Patanwadi','Mecheri','Mandya','Garole'],
  Goat: ['Boer','Saanen','Alpine','Nubian','Angora','LaMancha','Toggenburg','Jamunapari','Beetal','Barbari','Sirohi','Osmanabadi','Malabari','Black Bengal','Surti','Mehsana','Kutchi','Zalawadi'],
  Pig: ['Large White','Landrace','Duroc','Hampshire','Berkshire','Pietrain','Tamworth','Mangalica'],
  Rabbit: ['Holland Lop','Mini Rex','Netherland Dwarf','Flemish Giant','Rex','Lionhead','Angora','Dutch','Californian','New Zealand White'],
  Other: [],
}

const SPECIES_ICONS: Record<string, string> = {
  Dog: '🐕', Cat: '🐈', Bird: '🐦', Horse: '🐴', Cattle: '🐄',
  Sheep: '🐑', Goat: '🐐', Pig: '🐷', Rabbit: '🐰', Other: '🐾',
}

// Species that commonly use ear tags / registration numbers
const EAR_TAG_SPECIES = ['Cattle', 'Sheep', 'Goat', 'Pig', 'Horse']

interface AnimalData {
  id: string; uniqueId?: string; name: string; species: string; breed?: string;
  dateOfBirth?: string; gender?: string; weight?: number; color?: string;
  microchipId?: string; earTagId?: string; registrationNumber?: string;
  isNeutered?: boolean; insuranceProvider?: string; insurancePolicyNumber?: string;
  insuranceExpiry?: string; medicalNotes?: string; ownerName?: string;
}

const Animals: React.FC = () => {
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const navigate = useNavigate()
  const [animals, setAnimals] = useState<AnimalData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAnimal, setEditingAnimal] = useState<AnimalData | null>(null)
  const [detailAnimal, setDetailAnimal] = useState<AnimalData | null>(null)
  const [formData, setFormData] = useState({
    name: '', species: '', breed: '', customBreed: '', gender: '', weight: '', color: '',
    dateOfBirth: '', microchipId: '', earTagId: '', registrationNumber: '',
    isNeutered: false, insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
    medicalNotes: ''
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('')

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'
  const isPetOwner = user?.role === 'pet_owner' || user?.role === 'farmer'

  const breeds = useMemo(() => BREED_DATABASE[formData.species] || [], [formData.species])
  const showEarTag = EAR_TAG_SPECIES.includes(formData.species)

  const fetchAnimals = async () => {
    try {
      setLoading(true)
      const res = await apiService.listAnimals()
      setAnimals(res.data?.animals || [])
    } catch {
      setAnimals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnimals() }, [])

  const resetForm = () => {
    setFormData({
      name: '', species: '', breed: '', customBreed: '', gender: '', weight: '', color: '',
      dateOfBirth: '', microchipId: '', earTagId: '', registrationNumber: '',
      isNeutered: false, insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
      medicalNotes: ''
    })
    setEditingAnimal(null)
  }

  const openEditForm = (a: AnimalData) => {
    const breedList = BREED_DATABASE[a.species] || []
    const isCustomBreed = a.breed && !breedList.includes(a.breed)
    setFormData({
      name: a.name, species: a.species, breed: isCustomBreed ? 'Other' : (a.breed || ''),
      customBreed: isCustomBreed ? (a.breed || '') : '',
      gender: a.gender || '', weight: a.weight?.toString() || '', color: a.color || '',
      dateOfBirth: a.dateOfBirth ? a.dateOfBirth.split('T')[0] : '',
      microchipId: a.microchipId || '', earTagId: a.earTagId || '',
      registrationNumber: a.registrationNumber || '',
      isNeutered: a.isNeutered || false,
      insuranceProvider: a.insuranceProvider || '', insurancePolicyNumber: a.insurancePolicyNumber || '',
      insuranceExpiry: a.insuranceExpiry ? a.insuranceExpiry.split('T')[0] : '',
      medicalNotes: a.medicalNotes || ''
    })
    setEditingAnimal(a)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const finalBreed = formData.breed === 'Other' ? formData.customBreed : formData.breed
    const payload: any = {
      name: formData.name, species: formData.species, breed: finalBreed || undefined,
      gender: formData.gender || undefined, weight: formData.weight ? parseFloat(formData.weight) : undefined,
      color: formData.color || undefined, dateOfBirth: formData.dateOfBirth || undefined,
      microchipId: formData.microchipId || undefined, earTagId: formData.earTagId || undefined,
      registrationNumber: formData.registrationNumber || undefined, isNeutered: formData.isNeutered,
      insuranceProvider: formData.insuranceProvider || undefined,
      insurancePolicyNumber: formData.insurancePolicyNumber || undefined,
      insuranceExpiry: formData.insuranceExpiry || undefined,
      medicalNotes: formData.medicalNotes || undefined,
    }
    try {
      if (editingAnimal) {
        await apiService.updateAnimal(editingAnimal.id, payload)
        setSuccessMsg('Animal updated successfully!')
      } else {
        await apiService.createAnimal(payload)
        setSuccessMsg('Animal registered successfully!')
      }
      setShowForm(false)
      resetForm()
      fetchAnimals()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to save animal')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this animal?')) return
    try {
      await apiService.deleteAnimal(id)
      setSuccessMsg('Animal removed successfully')
      fetchAnimals()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to remove animal')
    }
  }

  const calculateAge = (dob?: string): string => {
    if (!dob) return ''
    const birth = new Date(dob)
    const now = new Date()
    const years = now.getFullYear() - birth.getFullYear()
    const months = now.getMonth() - birth.getMonth()
    if (years > 0) return months < 0 ? `${years - 1}y ${12 + months}m` : `${years}y ${months}m`
    return months <= 0 ? 'Newborn' : `${months}m`
  }

  // Filter animals
  const filteredAnimals = animals.filter(a => {
    const matchSearch = !searchTerm || a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.uniqueId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.earTagId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.microchipId || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchSpecies = !speciesFilter || a.species === speciesFilter
    return matchSearch && matchSpecies
  })

  const uniqueSpecies = [...new Set(animals.map(a => a.species))]

  const sectionTitle = (icon: string, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>{text}</span>
    </div>
  )

  const fieldStyle = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: '#4b5563', marginBottom: 4, display: 'block' }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🐾 {isVet ? 'Patient Animals' : isAdmin ? 'Animal Registry' : 'My Animals'}</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            {isVet ? 'Animals from your consultations' : isAdmin ? 'All registered animals in the system' : 'Manage your pets and farm animals'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isPetOwner && (
            <button className="btn-primary" onClick={() => { resetForm(); setShowForm(!showForm) }}>
              {showForm ? 'Cancel' : '+ Register Animal'}
            </button>
          )}
        </div>
      </div>

      {successMsg && <div style={{ padding: '12px 16px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: 8, marginBottom: 16, fontWeight: 500 }}>{successMsg}</div>}
      {error && <div style={{ padding: '12px 16px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 8, marginBottom: 16, fontWeight: 500 }}>{error}</div>}

      {/* ─── Search & Filter Bar ───────────────────────────── */}
      {!showForm && animals.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder="Search by name, ID, ear tag, microchip..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ ...fieldStyle, maxWidth: 350 }}
          />
          <select value={speciesFilter} onChange={e => setSpeciesFilter(e.target.value)} style={{ ...fieldStyle, maxWidth: 160 }}>
            <option value="">All Species</option>
            {uniqueSpecies.map(s => <option key={s} value={s}>{SPECIES_ICONS[s] || '🐾'} {s}</option>)}
          </select>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{filteredAnimals.length} animal{filteredAnimals.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ─── Registration / Edit Form ──────────────────────── */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, padding: 28, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#1f2937' }}>
            {editingAnimal ? `✏️ Edit ${editingAnimal.name}` : '📋 Register New Animal'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>Fields marked with * are required</p>

          <form onSubmit={handleSubmit}>
            {/* ── Basic Information ── */}
            {sectionTitle('📝', 'Basic Information')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required style={fieldStyle} placeholder="e.g. Buddy" />
              </div>
              <div>
                <label style={labelStyle}>Species *</label>
                <select value={formData.species} onChange={e => setFormData(p => ({ ...p, species: e.target.value, breed: '', customBreed: '' }))} required style={fieldStyle}>
                  <option value="">Select species</option>
                  {Object.keys(BREED_DATABASE).map(s => <option key={s} value={s}>{SPECIES_ICONS[s] || '🐾'} {s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Breed</label>
                {breeds.length > 0 ? (
                  <select value={formData.breed} onChange={e => setFormData(p => ({ ...p, breed: e.target.value, customBreed: '' }))} style={fieldStyle}>
                    <option value="">Select breed</option>
                    {breeds.map(b => <option key={b} value={b}>{b}</option>)}
                    <option value="Other">Other (specify)</option>
                  </select>
                ) : (
                  <input type="text" value={formData.customBreed} onChange={e => setFormData(p => ({ ...p, customBreed: e.target.value }))} style={fieldStyle} placeholder="Enter breed" />
                )}
              </div>
              {formData.breed === 'Other' && (
                <div>
                  <label style={labelStyle}>Custom Breed *</label>
                  <input type="text" value={formData.customBreed} onChange={e => setFormData(p => ({ ...p, customBreed: e.target.value }))} required style={fieldStyle} placeholder="Enter breed name" />
                </div>
              )}
              <div>
                <label style={labelStyle}>Gender</label>
                <select value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))} style={fieldStyle}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <input type="date" value={formData.dateOfBirth} onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))} style={fieldStyle} max={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label style={labelStyle}>Color / Markings</label>
                <input type="text" value={formData.color} onChange={e => setFormData(p => ({ ...p, color: e.target.value }))} style={fieldStyle} placeholder="e.g. Golden, Black & White" />
              </div>
              <div>
                <label style={labelStyle}>Weight (kg)</label>
                <input type="number" step="0.1" min="0" value={formData.weight} onChange={e => setFormData(p => ({ ...p, weight: e.target.value }))} style={fieldStyle} placeholder="e.g. 25.5" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
                <input type="checkbox" id="isNeutered" checked={formData.isNeutered} onChange={e => setFormData(p => ({ ...p, isNeutered: e.target.checked }))} style={{ width: 18, height: 18 }} />
                <label htmlFor="isNeutered" style={{ fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Spayed / Neutered</label>
              </div>
            </div>

            {/* ── Identification ── */}
            {sectionTitle('🏷️', 'Identification & Tracking')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label style={labelStyle}>Microchip ID</label>
                <input type="text" value={formData.microchipId} onChange={e => setFormData(p => ({ ...p, microchipId: e.target.value }))} style={fieldStyle} placeholder="e.g. 900118000123456" />
              </div>
              {showEarTag && (
                <div>
                  <label style={labelStyle}>Ear Tag ID</label>
                  <input type="text" value={formData.earTagId} onChange={e => setFormData(p => ({ ...p, earTagId: e.target.value }))} style={fieldStyle} placeholder="e.g. IN-08-MH-1234" />
                </div>
              )}
              <div>
                <label style={labelStyle}>Registration / Pedigree Number</label>
                <input type="text" value={formData.registrationNumber} onChange={e => setFormData(p => ({ ...p, registrationNumber: e.target.value }))} style={fieldStyle} placeholder="e.g. KCI/REG/2024/12345" />
              </div>
            </div>

            {/* ── Insurance ── */}
            {sectionTitle('🛡️', 'Insurance Details')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label style={labelStyle}>Insurance Provider</label>
                <input type="text" value={formData.insuranceProvider} onChange={e => setFormData(p => ({ ...p, insuranceProvider: e.target.value }))} style={fieldStyle} placeholder="e.g. PetPlan, Bajaj Allianz" />
              </div>
              <div>
                <label style={labelStyle}>Policy Number</label>
                <input type="text" value={formData.insurancePolicyNumber} onChange={e => setFormData(p => ({ ...p, insurancePolicyNumber: e.target.value }))} style={fieldStyle} placeholder="e.g. POL-2024-123456" />
              </div>
              <div>
                <label style={labelStyle}>Policy Expiry Date</label>
                <input type="date" value={formData.insuranceExpiry} onChange={e => setFormData(p => ({ ...p, insuranceExpiry: e.target.value }))} style={fieldStyle} />
                {formData.insuranceExpiry && new Date(formData.insuranceExpiry) < new Date() && (
                  <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>⚠️ Policy expired</span>
                )}
              </div>
            </div>

            {/* ── Medical Notes ── */}
            {sectionTitle('📋', 'Medical Notes')}
            <textarea value={formData.medicalNotes} onChange={e => setFormData(p => ({ ...p, medicalNotes: e.target.value }))}
              rows={3} style={{ ...fieldStyle, resize: 'vertical' }}
              placeholder="Any known conditions, allergies, dietary requirements, or special needs..." />

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="submit" className="btn-primary" style={{ padding: '10px 28px', fontSize: 14, fontWeight: 600 }}>
                {editingAnimal ? '💾 Update Animal' : '✅ Register Animal'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Animal Cards ──────────────────────────────────── */}
      <div className="module-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="loading-spinner" />
            <p style={{ color: '#6b7280', marginTop: 12 }}>Loading animals...</p>
          </div>
        ) : filteredAnimals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🐾</div>
            <h3 style={{ fontSize: 20, color: '#333', marginBottom: 8 }}>{searchTerm || speciesFilter ? 'No animals match your search' : 'No animals registered yet'}</h3>
            <p style={{ color: '#666' }}>{isPetOwner ? 'Register your first pet or farm animal to get started.' : 'No animals found in the system.'}</p>
            {isPetOwner && !showForm && (
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { resetForm(); setShowForm(true) }}>+ Register Animal</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {filteredAnimals.map(animal => {
              const age = calculateAge(animal.dateOfBirth)
              const insured = animal.insuranceProvider && animal.insurancePolicyNumber
              const insExpired = animal.insuranceExpiry && new Date(animal.insuranceExpiry) < new Date()
              return (
                <div key={animal.id} style={{
                  background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s',
                }}>
                  {/* Card Header */}
                  <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '16px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 32 }}>{SPECIES_ICONS[animal.species] || '🐾'}</span>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{animal.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.9 }}>{animal.species}{animal.breed ? ` • ${animal.breed}` : ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 12, fontFamily: 'monospace' }}>
                        {animal.uniqueId || `ID-${animal.id.substring(0, 8).toUpperCase()}`}
                      </div>
                      {age && <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>Age: {age}</div>}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
                      {animal.gender && <div><span style={{ color: '#6b7280' }}>Gender:</span> <strong>{animal.gender === 'male' ? '♂ Male' : '♀ Female'}</strong></div>}
                      {animal.weight && <div><span style={{ color: '#6b7280' }}>Weight:</span> <strong>{animal.weight} kg</strong></div>}
                      {animal.color && <div><span style={{ color: '#6b7280' }}>Color:</span> <strong>{animal.color}</strong></div>}
                      {animal.isNeutered && <div><span style={{ color: '#6b7280' }}>Neutered:</span> <strong style={{ color: '#059669' }}>Yes ✓</strong></div>}
                      {animal.dateOfBirth && <div><span style={{ color: '#6b7280' }}>DOB:</span> <strong>{formatDate(animal.dateOfBirth)}</strong></div>}
                      {animal.ownerName && (isVet || isAdmin) && <div><span style={{ color: '#6b7280' }}>Owner:</span> <strong>{animal.ownerName}</strong></div>}
                    </div>

                    {/* IDs Row */}
                    {(animal.microchipId || animal.earTagId || animal.registrationNumber) && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>🏷️ Identification</div>
                        {animal.microchipId && <div style={{ color: '#4b5563' }}>Microchip: <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{animal.microchipId}</span></div>}
                        {animal.earTagId && <div style={{ color: '#4b5563' }}>Ear Tag: <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{animal.earTagId}</span></div>}
                        {animal.registrationNumber && <div style={{ color: '#4b5563' }}>Reg #: <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{animal.registrationNumber}</span></div>}
                      </div>
                    )}

                    {/* Insurance Row */}
                    {insured && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: insExpired ? '#fef2f2' : '#f0fdf4', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: insExpired ? '#dc2626' : '#059669', marginBottom: 2 }}>
                          🛡️ {insExpired ? 'Insurance Expired' : 'Insured'}
                        </div>
                        <div style={{ color: '#4b5563' }}>{animal.insuranceProvider} — {animal.insurancePolicyNumber}</div>
                        {animal.insuranceExpiry && <div style={{ color: insExpired ? '#dc2626' : '#6b7280' }}>Expires: {formatDate(animal.insuranceExpiry)}</div>}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn-small" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}
                      onClick={() => setDetailAnimal(animal)}>📋 Details</button>
                    <button className="btn-small" onClick={() => navigate('/medical-records')}>📁 Records</button>
                    {isPetOwner && (
                      <>
                        <button className="btn-small" style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}
                          onClick={() => openEditForm(animal)}>✏️ Edit</button>
                        <button className="btn-small" style={{ color: '#dc2626', border: '1px solid #fca5a5', background: '#fef2f2' }}
                          onClick={() => handleDelete(animal.id)}>🗑️</button>
                      </>
                    )}
                    {isPetOwner && (
                      <button className="btn-small" style={{ marginLeft: 'auto', background: '#667eea', color: 'white', border: 'none' }}
                        onClick={() => navigate('/book-consultation')}>📅 Book</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Detail Modal ──────────────────────────────────── */}
      {detailAnimal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
          onClick={() => setDetailAnimal(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 0, width: '95%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px 28px', color: 'white', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 40 }}>{SPECIES_ICONS[detailAnimal.species] || '🐾'}</span>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{detailAnimal.name}</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>{detailAnimal.species}{detailAnimal.breed ? ` • ${detailAnimal.breed}` : ''} — {detailAnimal.uniqueId}</div>
                </div>
              </div>
              <button onClick={() => setDetailAnimal(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: 20, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>
            {/* Modal Body */}
            <div style={{ padding: '20px 28px' }}>
              {sectionTitle('📝', 'Basic Information')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 14 }}>
                <div><span style={{ color: '#6b7280' }}>Name:</span> <strong>{detailAnimal.name}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Species:</span> <strong>{detailAnimal.species}</strong></div>
                {detailAnimal.breed && <div><span style={{ color: '#6b7280' }}>Breed:</span> <strong>{detailAnimal.breed}</strong></div>}
                {detailAnimal.gender && <div><span style={{ color: '#6b7280' }}>Gender:</span> <strong>{detailAnimal.gender === 'male' ? '♂ Male' : '♀ Female'}</strong></div>}
                {detailAnimal.dateOfBirth && <div><span style={{ color: '#6b7280' }}>Date of Birth:</span> <strong>{formatDate(detailAnimal.dateOfBirth)}</strong></div>}
                {detailAnimal.dateOfBirth && <div><span style={{ color: '#6b7280' }}>Age:</span> <strong>{calculateAge(detailAnimal.dateOfBirth)}</strong></div>}
                {detailAnimal.weight && <div><span style={{ color: '#6b7280' }}>Weight:</span> <strong>{detailAnimal.weight} kg</strong></div>}
                {detailAnimal.color && <div><span style={{ color: '#6b7280' }}>Color:</span> <strong>{detailAnimal.color}</strong></div>}
                <div><span style={{ color: '#6b7280' }}>Neutered/Spayed:</span> <strong>{detailAnimal.isNeutered ? 'Yes ✓' : 'No'}</strong></div>
                {detailAnimal.ownerName && <div><span style={{ color: '#6b7280' }}>Owner:</span> <strong>{detailAnimal.ownerName}</strong></div>}
              </div>

              {sectionTitle('🏷️', 'Identification')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 14 }}>
                <div><span style={{ color: '#6b7280' }}>System ID:</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.uniqueId}</strong></div>
                {detailAnimal.microchipId && <div><span style={{ color: '#6b7280' }}>Microchip:</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.microchipId}</strong></div>}
                {detailAnimal.earTagId && <div><span style={{ color: '#6b7280' }}>Ear Tag:</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.earTagId}</strong></div>}
                {detailAnimal.registrationNumber && <div><span style={{ color: '#6b7280' }}>Registration #:</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.registrationNumber}</strong></div>}
              </div>

              {(detailAnimal.insuranceProvider || detailAnimal.insurancePolicyNumber) && (
                <>
                  {sectionTitle('🛡️', 'Insurance')}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 14 }}>
                    {detailAnimal.insuranceProvider && <div><span style={{ color: '#6b7280' }}>Provider:</span> <strong>{detailAnimal.insuranceProvider}</strong></div>}
                    {detailAnimal.insurancePolicyNumber && <div><span style={{ color: '#6b7280' }}>Policy #:</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.insurancePolicyNumber}</strong></div>}
                    {detailAnimal.insuranceExpiry && <div><span style={{ color: '#6b7280' }}>Expiry:</span> <strong>{formatDate(detailAnimal.insuranceExpiry)}</strong></div>}
                  </div>
                </>
              )}

              {detailAnimal.medicalNotes && (
                <>
                  {sectionTitle('📋', 'Medical Notes')}
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 }}>{detailAnimal.medicalNotes}</p>
                </>
              )}
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-small" onClick={() => navigate('/medical-records')}>📁 Medical Records</button>
              {isPetOwner && <button className="btn-small" style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }} onClick={() => { setDetailAnimal(null); openEditForm(detailAnimal) }}>✏️ Edit</button>}
              <button className="btn-small" onClick={() => setDetailAnimal(null)} style={{ padding: '6px 20px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Animals
