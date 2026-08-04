import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import AutocompleteInput from '../components/AutocompleteInput'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useMasterData } from '../context/MasterDataContext'
import type { AnimalClassTerm } from '../constants/speciesBreeds'

interface AnimalData {
  id: string; uniqueId?: string; name: string; species: string; breed?: string;
  dateOfBirth?: string; gender?: string; weight?: number; color?: string;
  microchipId?: string; earTagId?: string; registrationNumber?: string;
  isNeutered?: boolean; insuranceProvider?: string; insurancePolicyNumber?: string;
  insuranceExpiry?: string; medicalNotes?: string; ownerName?: string;
  enterpriseId?: string; groupId?: string; enterpriseName?: string; groupName?: string; groupColor?: string;
  animalClass?: string; sireId?: string; damId?: string; sireName?: string; damName?: string;
  breedingStatus?: string; lastBreedingDate?: string; expectedDueDate?: string;
}

interface EnterpriseOption { id: string; name: string }
interface GroupOption { id: string; name: string }

/** Species-correct class label ("Bullock") when set, falling back to raw gender ("Male"). */
function classOrGenderLabel(
  t: (k: string) => string,
  findClassTerm: (species: string, value: string) => AnimalClassTerm | undefined,
  resolveLabel: (item: AnimalClassTerm, t: (key: string) => string) => string,
  species: string, animalClass: string | undefined, gender: string | undefined
): string | null {
  const term = animalClass ? findClassTerm(species, animalClass) : undefined
  // Locale-aware (per-locale override → English label → labelKey translation), via resolveLabel.
  if (term) { const l = resolveLabel(term, t); if (l) return l }
  if (gender === 'male') return t('animals.form.maleDisplay')
  if (gender === 'female') return t('animals.form.femaleDisplay')
  return null
}

const Animals: React.FC = () => {
  const { t } = useTranslation()
  const { speciesCategories, breedsForSpecies, breedLabel, classTermsForSpecies, findClassTerm, speciesIcon, earTagSpecies, speciesLabel, resolveLabel } = useMasterData()

  const { user } = useAuth()
  const { formatDate } = useSettings()
  const navigate = useNavigate()
  const [animals, setAnimals] = useState<AnimalData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [editingAnimal, setEditingAnimal] = useState<AnimalData | null>(null)
  const [detailAnimal, setDetailAnimal] = useState<AnimalData | null>(null)
  const [formData, setFormData] = useState({
    name: '', species: '', breed: '', customBreed: '', gender: '', weight: '', color: '',
    dateOfBirth: '', microchipId: '', earTagId: '', registrationNumber: '',
    isNeutered: false, insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
    medicalNotes: '', enterpriseId: '', groupId: '',
    animalClass: '', sireId: '', damId: '',
    breedingStatus: '', lastBreedingDate: '', expectedDueDate: ''
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('')
  const [enterpriseFilter, setEnterpriseFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [vetView, setVetView] = useState<'my-pets' | 'patients'>('my-pets')

  // Bulk import state (farmer only)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importResults, setImportResults] = useState<{ created: number; failed: number; errors: string[] } | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [passportLoading, setPassportLoading] = useState<string | null>(null)
  const [importError, setImportError] = useState('')
  const csvInputRef = React.useRef<HTMLInputElement>(null)

  // Enterprise / group options for farmer role
  const [enterpriseOptions, setEnterpriseOptions] = useState<EnterpriseOption[]>([])
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([])

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'
  const isFarmer = user?.role === 'farmer'
  const isPetOwner = user?.role === 'pet_owner'
  const canManageAnimals = isPetOwner || isFarmer || (isVet && vetView === 'my-pets')

  const breeds = useMemo(() => breedsForSpecies(formData.species), [formData.species, breedsForSpecies])
  const showEarTag = earTagSpecies.includes(formData.species)

  // Load enterprises for farmer
  useEffect(() => {
    if (!isFarmer && !isAdmin) return
    apiService.listEnterprises({ limit: 100 }).then(res => {
      setEnterpriseOptions((res.data?.items || []).map((e: any) => ({ id: e.id, name: e.name })))
    }).catch(() => setError(t('animals.toasts.failedLoadEnterprises')))
  }, [isFarmer, isAdmin, t])

  // Load groups when enterprise changes in form
  useEffect(() => {
    if (!formData.enterpriseId) { setGroupOptions([]); return }
    apiService.listAnimalGroups(formData.enterpriseId, { limit: 100 }).then(res => {
      setGroupOptions((res.data?.items || []).map((g: any) => ({ id: g.id, name: g.name })))
    }).catch(() => setGroupOptions([]))
  }, [formData.enterpriseId])

  const fetchAnimals = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (isVet && vetView === 'patients') params.view = 'patients'
      const res = await apiService.listAnimals(params)
      let animalList: AnimalData[] = res.data?.animals || []

      // For farmers, also load enterprise animals (not personally owned but part of their enterprise)
      if (isFarmer && enterpriseOptions.length > 0) {
        const enterpriseAnimalPromises = enterpriseOptions.map(ent =>
          apiService.listEnterpriseAnimals(ent.id, { limit: 200 }).catch(() => ({ data: { items: [] } }))
        )
        const enterpriseResults = await Promise.all(enterpriseAnimalPromises)
        const enterpriseAnimals = enterpriseResults.flatMap((r: any) => r.data?.items || [])
        const existingIds = new Set(animalList.map((a: AnimalData) => a.id))
        const newEntAnimals = enterpriseAnimals.filter((a: any) => !existingIds.has(a.id))
        animalList = [...animalList, ...newEntAnimals]
      }

      setAnimals(animalList)
      
    } catch {
      setAnimals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnimals() }, [vetView])
  useAutoRefresh('animals', fetchAnimals)

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setImportError('CSV must have a header row and at least one data row'); return }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return headers.reduce((obj: any, h, i) => { obj[h] = vals[i] || ''; return obj }, {})
      }).filter((r: any) => r.name)
      setImportPreview(rows)
      setImportError('')
      setImportResults(null)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const downloadTemplate = () => {
    // animalClass is optional - species-correct terms like cattle_cow, cattle_bull,
    // sheep_ewe, etc. (see ANIMAL_CLASS_TERMS in constants/speciesBreeds.ts); leave
    // blank for species without class terms, or to just use gender.
    const csv = 'name,species,breed,gender,animalClass,dateOfBirth,weight,color,microchipId\n' +
      'Bessie,Cattle,Gir,female,cattle_cow,2020-01-15,450,Black & White,900118001234567\n' +
      'Raja,Horse,Marwari,male,,2019-06-01,520,Brown,\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'animal_import_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkImport = async () => {
    if (importPreview.length === 0) return
    setImportLoading(true)
    setImportError('')
    try {
      const result = await (apiService as any).post('/animals/bulk-import', { animals: importPreview })
      setImportResults(result?.data?.data || result?.data)
      setImportPreview([])
      await fetchAnimals()
    } catch (err: any) {
      setImportError(err?.response?.data?.error || err?.message || 'Import failed')
    } finally {
      setImportLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', species: '', breed: '', customBreed: '', gender: '', weight: '', color: '',
      dateOfBirth: '', microchipId: '', earTagId: '', registrationNumber: '',
      isNeutered: false, insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
      medicalNotes: '', enterpriseId: '', groupId: '',
      animalClass: '', sireId: '', damId: '',
      breedingStatus: '', lastBreedingDate: '', expectedDueDate: ''
    })
    setEditingAnimal(null)
  }

  const openEditForm = (a: AnimalData) => {
    const breedList = breedsForSpecies(a.species)
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
      medicalNotes: a.medicalNotes || '',
      enterpriseId: (a as any).enterpriseId || (a as any).enterprise_id || '',
      groupId: (a as any).groupId || (a as any).group_id || '',
      animalClass: a.animalClass || '', sireId: a.sireId || '', damId: a.damId || '',
      breedingStatus: a.breedingStatus || '',
      lastBreedingDate: a.lastBreedingDate ? a.lastBreedingDate.split('T')[0] : '',
      expectedDueDate: a.expectedDueDate ? a.expectedDueDate.split('T')[0] : ''
    })
    setEditingAnimal(a)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
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
      enterpriseId: formData.enterpriseId || undefined,
      groupId: formData.groupId || undefined,
      animalClass: formData.animalClass || undefined,
      sireId: formData.sireId || undefined,
      damId: formData.damId || undefined,
      breedingStatus: formData.breedingStatus || undefined,
      lastBreedingDate: formData.lastBreedingDate || undefined,
      expectedDueDate: formData.expectedDueDate || undefined,
    }
    try {
      if (editingAnimal) {
        await apiService.updateAnimal(editingAnimal.id, payload)
        setSuccessMsg(t('animals.toasts.updated'))
      } else {
        await apiService.createAnimal(payload)
        setSuccessMsg(t('animals.toasts.registered'))
      }
      setShowForm(false)
      resetForm()
      fetchAnimals()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || t('animals.toasts.failedSave'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('animals.toasts.confirmRemove'))) return
    try {
      await apiService.deleteAnimal(id)
      setSuccessMsg(t('animals.toasts.removed'))
      fetchAnimals()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('animals.toasts.failedRemove'))
    }
  }

  const calculateAge = (dob?: string): string => {
    if (!dob) return ''
    const birth = new Date(dob)
    const now = new Date()
    const years = now.getFullYear() - birth.getFullYear()
    const months = now.getMonth() - birth.getMonth()
    if (years > 0) return months < 0 ? `${years - 1}y ${12 + months}m` : `${years}y ${months}m`
    return months <= 0 ? t('animals.newborn') : `${months}m`
  }

  // Filter animals
  const filteredAnimals = animals.filter(a => {
    const matchSearch = !searchTerm || a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.uniqueId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.earTagId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.microchipId || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchSpecies = !speciesFilter || a.species === speciesFilter
        const matchEnterprise = !enterpriseFilter || a.enterpriseId === enterpriseFilter
    const matchGroup = !groupFilter || a.groupId === groupFilter
    return matchSearch && matchSpecies && matchEnterprise && matchGroup
  })

  const uniqueSpecies = [...new Set(animals.map(a => a.species))]

  const sectionTitle = (icon: string, text: string) => (
    <div className="si-56b1c7d7">
      <span className="si-09aa6941">{icon}</span>
      <span className="si-e378c82e">{text}</span>
    </div>
  )

  const fieldStyle = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: '#4b5563', marginBottom: 4, display: 'block' }

  const handleDownloadPassport= async (animal: AnimalData) => {
    // Open the window SYNCHRONOUSLY before any await - browsers block popups
    // opened after an async gap because they're no longer tied to the user gesture.
    const win = window.open('', '_blank')
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site to generate the Health Passport.')
      return
    }
    // Show a loading placeholder immediately so the window isn't blank
    win.document.write('<html><body style="font-family:Arial;padding:40px;text-align:center"><p>⏳ Generating Health Passport...</p></body></html>')

    setPassportLoading(animal.id)
    try {
      // `/medical-records/animal/:id` was never a registered route - it 404'd on
      // every passport and the .catch() below turned that into "No medical
      // records found" on a printed medical document. The real endpoint is the
      // list route with an animalId filter, which returns { data: { records } }.
      let vaccFailed = false
      let medFailed = false
      const [vaccRes, medRes] = await Promise.all([
        (apiService as any).get(`/vaccinations/animal/${animal.id}`).catch(() => { vaccFailed = true; return null }),
        (apiService as any).get(`/medical-records?animalId=${animal.id}&limit=100`).catch(() => { medFailed = true; return null })
      ])
      const vaccinations: any[] = vaccRes?.data?.data?.vaccinations || vaccRes?.data?.vaccinations || (Array.isArray(vaccRes?.data?.data) ? vaccRes.data.data : []) || []
      const records: any[] = medRes?.data?.data?.records || medRes?.data?.records || (Array.isArray(medRes?.data?.data) ? medRes.data.data : []) || []

      const microchipHtml = animal.microchipId
        ? '<div class="info-item"><span class="label">Microchip:</span> ' + animal.microchipId + '</div>'
        : ''
      const vaccRowsHtml = vaccinations.map((v: any) =>
        '<tr><td>' + (v.vaccineName || v.vaccine_name || '') + '</td>' +
        '<td>' + ((v.dateAdministered || v.date_administered || '').split('T')[0] || 'N/A') + '</td>' +
        '<td>' + ((v.nextDueDate || v.next_due_date || '').split('T')[0] || 'N/A') + '</td>' +
        '<td>' + (v.batchNumber || v.batch_number || 'N/A') + '</td></tr>'
      ).join('')
      // A failed fetch must never render as "none found" on a medical document -
      // an empty section has to mean "there are none", not "we could not ask".
      const couldNotLoad = (what: string) =>
        '<p style="color:#b91c1c;font-weight:600">⚠ ' + what + ' could not be loaded - this section is incomplete. Do not treat it as a complete record.</p>'
      const vaccHtml = vaccFailed
        ? couldNotLoad('Vaccination history')
        : vaccinations.length === 0
        ? '<p style="color:#999">No vaccination records found</p>'
        : '<table><thead><tr><th>Vaccine</th><th>Date Administered</th><th>Next Due</th><th>Batch</th></tr></thead><tbody>' + vaccRowsHtml + '</tbody></table>'
      const medRowsHtml = records.map((r: any) =>
        '<tr><td>' + ((r.createdAt || r.created_at || '').split('T')[0] || 'N/A') + '</td>' +
        '<td>' + (r.recordType || r.record_type || r.type || '') + '</td>' +
        '<td>' + (r.title || '') + '</td>' +
        '<td>' + (r.vetName || r.vet_name || 'N/A') + '</td></tr>'
      ).join('')
      const medHtml = medFailed
        ? couldNotLoad('Medical history')
        : records.length === 0
        ? '<p style="color:#999">No medical records found</p>'
        : '<table><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Veterinarian</th></tr></thead><tbody>' + medRowsHtml + '</tbody></table>'

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Health Passport - ${animal.name}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 10px; }
    h2 { color: #2e4057; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #1a5276; color: white; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #f8f9fa; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 12px 0; }
    .info-item { display: flex; gap: 8px; } .label { font-weight: bold; color: #555; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>&#x1F43E; VetCare Health Passport</h1>
  <p style="color:#666; margin:0;">Generated on ${new Date().toLocaleDateString()}</p>
  <h2>Animal Information</h2>
  <div class="info-grid">
    <div class="info-item"><span class="label">Name:</span> ${animal.name}</div>
    <div class="info-item"><span class="label">Species:</span> ${animal.species}</div>
    <div class="info-item"><span class="label">Breed:</span> ${animal.breed || 'N/A'}</div>
    <div class="info-item"><span class="label">Gender:</span> ${animal.gender || 'N/A'}</div>
    <div class="info-item"><span class="label">DOB:</span> ${animal.dateOfBirth ? animal.dateOfBirth.split('T')[0] : 'N/A'}</div>
    <div class="info-item"><span class="label">Weight:</span> ${animal.weight ? String(animal.weight) + ' kg' : 'N/A'}</div>
    ${microchipHtml}
  </div>
  <h2>Vaccination History (${vaccinations.length} records)</h2>
  ${vaccHtml}
  <h2>Medical Records (${records.length} records)</h2>
  ${medHtml}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

      win.document.open()
      win.document.write(html)
      win.document.close()
    } catch (err) {
      console.error('Failed to generate health passport', err)
      win.document.write('<html><body style="font-family:Arial;padding:40px"><p style="color:red">Failed to generate Health Passport. Please close this tab and try again.</p></body></html>')
      win.document.close()
    } finally {
      setPassportLoading(null)
    }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{isFarmer ? '🐄' : '🐾'} {isVet ? (vetView === 'my-pets' ? t('animals.pageTitles.petOwner') : t('animals.pageTitles.vet')) : isAdmin ? t('animals.pageTitles.admin') : isFarmer ? t('animals.pageTitles.farmer') : t('animals.pageTitles.petOwner')}</h1>
          <p className="si-48d05eba">
            {isVet ? (vetView === 'my-pets' ? t('animals.subtitles.vetMyPets') : t('animals.subtitles.vet')) : isAdmin ? t('animals.subtitles.admin') : isFarmer ? t('animals.subtitles.farmer') : t('animals.subtitles.petOwner')}
          </p>
        </div>
        <div className="si-d223efb3">
          {isFarmer && (
            <>
              <button className="btn-small si-0a803082" onClick={downloadTemplate}>
                ⬇️ {t('animals.downloadTemplate')}
              </button>
              <button className="btn-small si-0a803082" onClick={() => { setShowBulkImport(true); setImportPreview([]); setImportResults(null); setImportError('') }}>
                📥 {t('animals.importCSV')}
              </button>
            </>
          )}
          {canManageAnimals && (
            <button className="btn-primary" onClick={() => { resetForm(); setShowForm(!showForm) }}>
              {showForm ? t('animals.actions.cancel') : t('animals.registerAnimal')}
            </button>
          )}
        </div>
      </div>

      {successMsg && <div className="si-3e658aef">{successMsg}</div>}
      {error && <div className="si-1bc255da">{error}</div>}

      {/* ─── Vet View Tabs ─────────────────────────────── */}
      {isVet && (
        <div className="module-tabs si-478be2e9">
          <button className={`module-tab ${vetView === 'my-pets' ? 'active' : ''}`} onClick={() => setVetView('my-pets')}>
            🐾 {t('animals.vetTabs.myPets')}
          </button>
          <button className={`module-tab ${vetView === 'patients' ? 'active' : ''}`} onClick={() => setVetView('patients')}>
            🩺 {t('animals.vetTabs.patientAnimals')}
          </button>
        </div>
      )}

      {/* ─── Search & Filter Bar ───────────────────────────── */}
      {!showForm && animals.length > 0 && (
        <div className="si-72baa289">
          <AutocompleteInput
            value={searchTerm}
            onChange={setSearchTerm}
            options={animals.map(a => a.name)}
            placeholder={t('animals.searchPlaceholder')}
            className="animals-search"
          />
          <select value={speciesFilter} onChange={e => setSpeciesFilter(e.target.value)} style={{ ...fieldStyle, maxWidth: 160 }}>
            <option value="">{t('animals.allSpecies')}</option>
            {uniqueSpecies.map(s => <option key={s} value={s}>{speciesIcon(s)} {speciesLabel(s, t)}</option>)}
          </select>
          {isFarmer && enterpriseOptions.length > 0 && (
            <select value={enterpriseFilter} onChange={e => { setEnterpriseFilter(e.target.value); setGroupFilter('') }} style={{ ...fieldStyle, maxWidth: 180 }}>
              <option value=''>{t('animals.enterprise.filterByEnterprise')}</option>
              {enterpriseOptions.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
            </select>
          )}
          {isFarmer && enterpriseFilter && groupOptions.length > 0 && (
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ ...fieldStyle, maxWidth: 160 }}>
              <option value=''>{t('animals.enterprise.filterByGroup')}</option>
              {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <span className="si-c3b93ebb">{filteredAnimals.length} {filteredAnimals.length !== 1 ? t('animals.animalsCount') : t('animals.animalCount')}</span>
        </div>
      )}

      {/* ─── Registration / Edit Form Modal ──────────────── */}
      {showForm && (
        <div className="edit-form-overlay" onClick={() => { setShowForm(false); resetForm() }}>
          <div ref={formRef} className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
            <button className="edit-form-close" onClick={() => { setShowForm(false); resetForm() }} aria-label="Close">✕</button>
            {editingAnimal && <div className="edit-form-badge">{t('animals.registerModal.editingMode')}</div>}
            <h2>
              {editingAnimal ? `✏️ ${t('animals.registerModal.titleEdit', { name: editingAnimal.name })}` : t('animals.registerModal.titleNew')}
            </h2>
          <p className="si-5b728486">{t('animals.registerModal.requiredNote')}</p>

          <form onSubmit={handleSubmit}>
            {/* ── Basic Information ── */}
            {sectionTitle('📝', t('animals.sections.basicInfo'))}
            <div className="si-99cba706">
              <div>
                <label style={labelStyle}>{t('animals.registerModal.name')}</label>
                <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required style={fieldStyle} placeholder={t('animals.form.placeholderName')} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.species')}</label>
                <select value={formData.species} onChange={e => setFormData(p => ({ ...p, species: e.target.value, breed: '', customBreed: '' }))} required style={fieldStyle}>
                  <option value="">{t('animals.form.selectSpecies')}</option>
                  {speciesCategories.map(cat => (
                    <optgroup key={cat.label} label={cat.label}>
                      {cat.species.map(s => (
                        <option key={s} value={s}>{speciesIcon(s)} {speciesLabel(s, t)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.breed')}</label>
                {breeds.length > 0 ? (
                  <select value={formData.breed} onChange={e => setFormData(p => ({ ...p, breed: e.target.value, customBreed: '' }))} style={fieldStyle}>
                    <option value="">{t('animals.registerModal.selectBreed')}</option>
                    {breeds.map(b => <option key={b} value={b}>{breedLabel(formData.species, b)}</option>)}
                    <option value="Other">{t('animals.registerModal.otherBreed')}</option>
                  </select>
                ) : (
                  <input type="text" value={formData.customBreed} onChange={e => setFormData(p => ({ ...p, customBreed: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderBreed')} />
                )}
              </div>
              {formData.breed === 'Other' && (
                <div>
                  <label style={labelStyle}>{t('animals.registerModal.customBreed')}</label>
                  <input type="text" value={formData.customBreed} onChange={e => setFormData(p => ({ ...p, customBreed: e.target.value }))} required style={fieldStyle} placeholder={t('animals.form.placeholderBreedName')} />
                </div>
              )}
              <div>
                {classTermsForSpecies(formData.species).length > 0 ? (
                  <>
                    <label style={labelStyle}>{t('animalClass.fieldLabel')}</label>
                    <select value={formData.animalClass} onChange={e => {
                      const term = findClassTerm(formData.species, e.target.value)
                      setFormData(p => ({ ...p, animalClass: e.target.value, gender: term?.impliedGender || p.gender }))
                    }} style={fieldStyle}>
                      <option value="">{t('animalClass.selectClass')}</option>
                      {classTermsForSpecies(formData.species).map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t)}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label style={labelStyle}>{t('animals.registerModal.gender')}</label>
                    <select value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))} style={fieldStyle}>
                      <option value="">{t('animals.form.selectGender')}</option>
                      <option value="male">{t('animals.form.male')}</option>
                      <option value="female">{t('animals.form.female')}</option>
                    </select>
                  </>
                )}
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.dob')}</label>
                <input type="date" value={formData.dateOfBirth} onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))} style={fieldStyle} max={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.color')}</label>
                <input type="text" value={formData.color} onChange={e => setFormData(p => ({ ...p, color: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderColor')} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.weight')}</label>
                <input type="number" step="0.1" min="0" value={formData.weight} onChange={e => setFormData(p => ({ ...p, weight: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderWeight')} />
              </div>
              <div className="si-6046e8a3">
                <input type="checkbox" id="isNeutered" checked={formData.isNeutered} onChange={e => setFormData(p => ({ ...p, isNeutered: e.target.checked }))} className="si-8f286607" />
                <label htmlFor="isNeutered" className="si-a84a6c30">{t('animals.registerModal.neutered')}</label>
              </div>
              <div>
                <label style={labelStyle}>{t('animalClass.sire')}</label>
                <select value={formData.sireId} onChange={e => setFormData(p => ({ ...p, sireId: e.target.value }))} style={fieldStyle}>
                  <option value="">{t('animalClass.selectSire')}</option>
                  {animals.filter(a => a.species === formData.species && a.gender === 'male' && a.id !== editingAnimal?.id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('animalClass.dam')}</label>
                <select value={formData.damId} onChange={e => setFormData(p => ({ ...p, damId: e.target.value }))} style={fieldStyle}>
                  <option value="">{t('animalClass.selectDam')}</option>
                  {animals.filter(a => a.species === formData.species && a.gender === 'female' && a.id !== editingAnimal?.id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              {findClassTerm(formData.species, formData.animalClass)?.canBePregnant && (
                <>
                  <div>
                    <label style={labelStyle}>{t('animalClass.breedingStatus')}</label>
                    <select value={formData.breedingStatus} onChange={e => setFormData(p => ({ ...p, breedingStatus: e.target.value }))} style={fieldStyle}>
                      <option value="">{t('animalClass.selectBreedingStatus')}</option>
                      <option value="not_bred">{t('animalClass.notBred')}</option>
                      <option value="pregnant">{t('animalClass.pregnant')}</option>
                      <option value="not_pregnant">{t('animalClass.notPregnant')}</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{t('animalClass.lastBreedingDate')}</label>
                    <input type="date" value={formData.lastBreedingDate} onChange={e => setFormData(p => ({ ...p, lastBreedingDate: e.target.value }))} style={fieldStyle} max={new Date().toISOString().split('T')[0]} />
                  </div>
                  {formData.breedingStatus === 'pregnant' && (
                    <div>
                      <label style={labelStyle}>{t('animalClass.expectedDueDate')}</label>
                      <input type="date" value={formData.expectedDueDate} onChange={e => setFormData(p => ({ ...p, expectedDueDate: e.target.value }))} style={fieldStyle} />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Identification ── */}
            {sectionTitle('🏷️', t('animals.sections.identification'))}
            <div className="si-b064b4a1">
              <div>
                <label style={labelStyle}>{t('animals.registerModal.microchip')}</label>
                <input type="text" value={formData.microchipId} onChange={e => setFormData(p => ({ ...p, microchipId: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderMicrochip')} />
              </div>
              {showEarTag && (
                <div>
                  <label style={labelStyle}>{t('animals.registerModal.earTag')}</label>
                  <input type="text" value={formData.earTagId} onChange={e => setFormData(p => ({ ...p, earTagId: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderEarTag')} />
                </div>
              )}
              <div>
                <label style={labelStyle}>{t('animals.registerModal.regNumber')}</label>
                <input type="text" value={formData.registrationNumber} onChange={e => setFormData(p => ({ ...p, registrationNumber: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderRegNumber')} />
              </div>
            </div>

            {/* ── Insurance ── */}
            {sectionTitle('🛡️', t('animals.sections.insurance'))}
            <div className="si-b064b4a1">
              <div>
                <label style={labelStyle}>{t('animals.registerModal.insuranceProvider')}</label>
                <input type="text" value={formData.insuranceProvider} onChange={e => setFormData(p => ({ ...p, insuranceProvider: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderInsurance')} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.policyNumber')}</label>
                <input type="text" value={formData.insurancePolicyNumber} onChange={e => setFormData(p => ({ ...p, insurancePolicyNumber: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderPolicy')} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.policyExpiry')}</label>
                <input type="date" value={formData.insuranceExpiry} onChange={e => setFormData(p => ({ ...p, insuranceExpiry: e.target.value }))} style={fieldStyle} />
                {formData.insuranceExpiry && new Date(formData.insuranceExpiry) < new Date() && (
                  <span className="si-58dcc166">{t('animals.registerModal.policyExpired')}</span>
                )}
              </div>
            </div>

            {/* ── Medical Notes ── */}
            {sectionTitle('📋', t('animals.sections.medicalNotes'))}
            <textarea value={formData.medicalNotes} onChange={e => setFormData(p => ({ ...p, medicalNotes: e.target.value }))}
              rows={3} style={{ ...fieldStyle, resize: 'vertical' }}
              placeholder={t('animals.form.placeholderMedical')} />

            {/* ── Enterprise & Group (Farmer/Admin only) ── */}
            {(isFarmer || isAdmin) && enterpriseOptions.length > 0 && (
              <>
                {sectionTitle('🏢', t('animals.sections.enterprise'))}
                <p className="si-8c99d39c">
                  {t('animals.enterprise.description')}
                </p>
                <div className="si-b064b4a1">
                  <div>
                    <label style={labelStyle}>{t('animals.enterprise.label')}</label>
                    <select value={formData.enterpriseId} onChange={e => setFormData(p => ({ ...p, enterpriseId: e.target.value, groupId: '' }))} style={fieldStyle}>
                      <option value="">{t('animals.enterprise.none')}</option>
                      {enterpriseOptions.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                    </select>
                  </div>
                  {formData.enterpriseId && (
                    <div>
                      <label style={labelStyle}>{t('animals.enterprise.herdGroup')}</label>
                      <select value={formData.groupId} onChange={e => setFormData(p => ({ ...p, groupId: e.target.value }))} style={fieldStyle}>
                        <option value="">{t('animals.enterprise.noGroup')}</option>
                        {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      {groupOptions.length === 0 && (
                        <span className="si-a213bf41">{t('animals.enterprise.noGroupsFound')} <span className="si-3745f306" onClick={() => navigate('/animal-groups')}>{t('animals.enterprise.createOne')}</span></span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="si-961e4c67">
              <button type="submit" className="btn-primary si-542676d1" disabled={isSubmitting}>
                {isSubmitting ? '⏳ ' + (editingAnimal ? t('animals.registerModal.updateBtn') : t('animals.registerModal.registerBtn')) + '...' : (editingAnimal ? t('animals.registerModal.updateBtn') : t('animals.registerModal.registerBtn'))}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                className="si-71a7eeee">
                {t('animals.actions.cancel')}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* ─── Animal Cards ──────────────────────────────────── */}
      <div className="module-content">
        {loading ? (
          <div className="si-86638a30">
            <div className="loading-spinner" />
            <p className="si-c429ecf4">{t('animals.loading')}</p>
          </div>
        ) : filteredAnimals.length === 0 ? (
          <div className="si-9fa8d292">
            <div className="si-86e06f73">🐾</div>
            <h3 className="si-e34d1325">{searchTerm || speciesFilter ? t('animals.emptySearch') : t('animals.emptyAnimals')}</h3>
            <p className="si-50edd4e9">{canManageAnimals ? t('animals.petOwnerCTA') : t('animals.adminCTA')}</p>
            {canManageAnimals && !showForm && (
              <button className="btn-primary si-b0aee75b" onClick={() => { resetForm(); setShowForm(true) }}>{t('animals.registerAnimal')}</button>
            )}
          </div>
        ) : (
          <div className="si-af8b7d7f">
            {filteredAnimals.map(animal => {
              const age = calculateAge(animal.dateOfBirth)
              const insured = animal.insuranceProvider && animal.insurancePolicyNumber
              const insExpired = animal.insuranceExpiry && new Date(animal.insuranceExpiry) < new Date()
              return (
                <div key={animal.id} className="si-9a7422fb">
                  {/* Card Header */}
                  <div className="si-6ac50557">
                    <div className="si-0b20392f">
                      <span className="si-42fc55d5">{speciesIcon(animal.species)}</span>
                      <div>
                        <div className="si-90c2c65d">{animal.name}</div>
                        <div className="si-122e0f6b">{speciesLabel(animal.species, t)}{animal.breed ? ` • ${breedLabel(animal.species, animal.breed)}` : ''}</div>
                      </div>
                    </div>
                    <div className="si-f4e64596">
                      <div
                        className="si-ddf63368"
                        onClick={() => {
                          const id = animal.uniqueId
                          if (id) {
                            navigator.clipboard?.writeText(id).then(() => {
                              setCopiedId(id)
                              setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500)
                            }).catch(() => setError(t('common.copyFailed')))
                          }
                        }}
                        title={animal.uniqueId ? `Click to copy: ${animal.uniqueId}` : ''}
                      >
                        {animal.uniqueId && copiedId === animal.uniqueId ? `✅ ${t('common.copied')}` : (animal.uniqueId || `ID-${animal.id.substring(0, 8).toUpperCase()}`)}
                      </div>
                      {age && <div className="si-706df161">{t('animals.cardLabels.age')} {age}</div>}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="si-d29f2575">
                    <div className="si-3b3a79d7">
                      {(animal.animalClass || animal.gender) && <div><span className="si-23033f05">{t('animals.cardLabels.gender')}</span> <strong>{classOrGenderLabel(t, findClassTerm, resolveLabel, animal.species, animal.animalClass, animal.gender)}</strong></div>}
                      {animal.weight && <div><span className="si-23033f05">{t('animals.cardLabels.weight')}</span> <strong>{animal.weight} kg</strong></div>}
                      {animal.color && <div><span className="si-23033f05">{t('animals.cardLabels.color')}</span> <strong>{animal.color}</strong></div>}
                      {animal.isNeutered && <div><span className="si-23033f05">{t('animals.cardLabels.neutered')}</span> <strong className="si-487e8582">{t('animals.cardLabels.yesCheck')}</strong></div>}
                      {animal.dateOfBirth && <div><span className="si-23033f05">{t('animals.cardLabels.dob')}</span> <strong>{formatDate(animal.dateOfBirth)}</strong></div>}
                      {animal.ownerName && (isVet || isAdmin) && <div><span className="si-23033f05">{t('animals.cardLabels.owner')}</span> <strong>{animal.ownerName}</strong></div>}
                    </div>

                                        {/* Enterprise / Group (Farmer view) */}
                    {(animal.enterpriseName || animal.groupName) && (
                      <div className="si-83b1e87d">
                        {animal.groupColor && (
                          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: animal.groupColor, marginRight: 6, verticalAlign: 'middle' }} />
                        )}
                        {animal.enterpriseName && <span className="si-5fd5ba20">🏢 {animal.enterpriseName}</span>}
                        {animal.groupName && <span className="si-c12e23c3">· {animal.groupName}</span>}
                      </div>
                    )}

                    {/* IDs Row */}
                    {(animal.microchipId || animal.earTagId || animal.registrationNumber) && (
                      <div className="si-96553843">
                        <div className="si-c3f28cd6">{t('animals.cardLabels.identification')}</div>
                        {animal.microchipId && <div className="si-91a28c8c">{t('animals.cardLabels.microchip')} <span className="si-2c506e3b">{animal.microchipId}</span></div>}
                        {animal.earTagId && <div className="si-91a28c8c">{t('animals.cardLabels.earTag')} <span className="si-2c506e3b">{animal.earTagId}</span></div>}
                        {animal.registrationNumber && <div className="si-91a28c8c">{t('animals.cardLabels.regNumber')} <span className="si-2c506e3b">{animal.registrationNumber}</span></div>}
                      </div>
                    )}

                    {/* Insurance Row */}
                    {insured && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: insExpired ? '#fef2f2' : '#f0fdf4', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: insExpired ? '#dc2626' : '#059669', marginBottom: 2 }}>
                          {insExpired ? t('animals.cardLabels.insuranceExpired') : `🛡️ ${t('animals.cardLabels.insured')}`}
                        </div>
                        <div className="si-91a28c8c">{animal.insuranceProvider} - {animal.insurancePolicyNumber}</div>
                        {animal.insuranceExpiry && <div style={{ color: insExpired ? '#dc2626' : '#6b7280' }}>{t('animals.cardLabels.expires')} {formatDate(animal.insuranceExpiry)}</div>}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="si-ab8d87a7">
                    <button className="btn-small si-72b31bb1"
                      onClick={() => setDetailAnimal(animal)}>{t('animals.cardLabels.details')}</button>
                    <button className="btn-small" onClick={() => navigate('/medical-records')}>{t('animals.cardActions.records')}</button>
                    {canManageAnimals && (
                      <>
                        <button className="btn-small si-f8147336"
                          onClick={() => openEditForm(animal)}>{t('animals.cardActions.edit')}</button>
                        <button className="btn-small si-415f0ec0"
                          onClick={() => handleDelete(animal.id)}>🗑️</button>
                      </>
                    )}
                    {isPetOwner && (
                      <button className="btn-small si-a0f947bf"
                        onClick={() => navigate(`/book-consultation?animalId=${animal.id}`)}>{t('animals.actions.bookConsultation')}</button>
                    )}
                    <button
                      className="btn-small si-14989fd1"
                     
                      onClick={() => handleDownloadPassport(animal)}
                      disabled={passportLoading === animal.id}
                    >
                      {passportLoading === animal.id ? t('animals.generatingPassport') : `\u{1F6C2} ${t('animals.healthPassport')}`}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Detail Modal ──────────────────────────────────── */}
      {detailAnimal && (
        <div className="si-10f9485f"
          onClick={() => setDetailAnimal(null)}>
          <div className="si-64d8c528"
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="si-b4f50afa">
              <div className="si-1ec723fc">
                <span className="si-0067e898">{speciesIcon(detailAnimal.species)}</span>
                <div>
                  <div className="si-f0920f33">{detailAnimal.name}</div>
                  <div className="si-e17c55f7">{speciesLabel(detailAnimal.species, t)}{detailAnimal.breed ? ` • ${breedLabel(detailAnimal.species, detailAnimal.breed)}` : ''} - {detailAnimal.uniqueId}</div>
                </div>
              </div>
              <button onClick={() => setDetailAnimal(null)} className="si-1b1a545b">✕</button>
            </div>
            {/* Modal Body */}
            <div className="si-4cea2692">
              {sectionTitle('📝', t('animals.detailModal.basicInfo'))}
              <div className="si-7e1e70ef">
                <div><span className="si-23033f05">{t('animals.detailModal.name')}</span> <strong>{detailAnimal.name}</strong></div>
                <div><span className="si-23033f05">{t('animals.detailModal.species')}</span> <strong>{speciesLabel(detailAnimal.species, t)}</strong></div>
                {detailAnimal.breed && <div><span className="si-23033f05">{t('animals.detailModal.breed')}</span> <strong>{breedLabel(detailAnimal.species, detailAnimal.breed)}</strong></div>}
                {(detailAnimal.animalClass || detailAnimal.gender) && <div><span className="si-23033f05">{t('animals.detailModal.gender')}</span> <strong>{classOrGenderLabel(t, findClassTerm, resolveLabel, detailAnimal.species, detailAnimal.animalClass, detailAnimal.gender)}</strong></div>}
                {detailAnimal.dateOfBirth && <div><span className="si-23033f05">{t('animals.detailModal.dob')}</span> <strong>{formatDate(detailAnimal.dateOfBirth)}</strong></div>}
                {detailAnimal.sireName && <div><span className="si-23033f05">{t('animalClass.sire')}</span> <strong>{detailAnimal.sireName}</strong></div>}
                {detailAnimal.damName && <div><span className="si-23033f05">{t('animalClass.dam')}</span> <strong>{detailAnimal.damName}</strong></div>}
                {detailAnimal.breedingStatus && <div><span className="si-23033f05">{t('animalClass.breedingStatus')}</span> <strong>{t(`animalClass.${detailAnimal.breedingStatus === 'not_bred' ? 'notBred' : detailAnimal.breedingStatus === 'pregnant' ? 'pregnant' : 'notPregnant'}`)}</strong></div>}
                {detailAnimal.breedingStatus === 'pregnant' && detailAnimal.expectedDueDate && <div><span className="si-23033f05">{t('animalClass.expectedDueDate')}</span> <strong>{formatDate(detailAnimal.expectedDueDate)}</strong></div>}
                {detailAnimal.dateOfBirth && <div><span className="si-23033f05">{t('animals.detailModal.age')}</span> <strong>{calculateAge(detailAnimal.dateOfBirth)}</strong></div>}
                {detailAnimal.weight && <div><span className="si-23033f05">{t('animals.detailModal.weight')}</span> <strong>{detailAnimal.weight} kg</strong></div>}
                {detailAnimal.color && <div><span className="si-23033f05">{t('animals.detailModal.color')}</span> <strong>{detailAnimal.color}</strong></div>}
                <div><span className="si-23033f05">{t('animals.detailModal.neutered')}</span> <strong>{detailAnimal.isNeutered ? t('animals.detailModal.yesCheck') : t('animals.detailModal.no')}</strong></div>
                {detailAnimal.ownerName && <div><span className="si-23033f05">{t('animals.detailModal.owner')}</span> <strong>{detailAnimal.ownerName}</strong></div>}
              </div>

              {sectionTitle('🏷️', t('animals.detailModal.identificationSection'))}
              <div className="si-7e1e70ef">
                <div><span className="si-23033f05">{t('animals.detailModal.systemId')}</span> <strong className="si-d70e5ad0">{detailAnimal.uniqueId}</strong></div>
                {detailAnimal.microchipId && <div><span className="si-23033f05">{t('animals.detailModal.microchip')}</span> <strong className="si-d70e5ad0">{detailAnimal.microchipId}</strong></div>}
                {detailAnimal.earTagId && <div><span className="si-23033f05">{t('animals.detailModal.earTag')}</span> <strong className="si-d70e5ad0">{detailAnimal.earTagId}</strong></div>}
                {detailAnimal.registrationNumber && <div><span className="si-23033f05">{t('animals.detailModal.regNumber')}</span> <strong className="si-d70e5ad0">{detailAnimal.registrationNumber}</strong></div>}
              </div>

              {(detailAnimal.insuranceProvider || detailAnimal.insurancePolicyNumber) && (
                <>
                  {sectionTitle('🛡️', t('animals.detailModal.insuranceSection'))}
                  <div className="si-7e1e70ef">
                    {detailAnimal.insuranceProvider && <div><span className="si-23033f05">{t('animals.detailModal.provider')}</span> <strong>{detailAnimal.insuranceProvider}</strong></div>}
                    {detailAnimal.insurancePolicyNumber && <div><span className="si-23033f05">{t('animals.detailModal.policyNumber')}</span> <strong className="si-d70e5ad0">{detailAnimal.insurancePolicyNumber}</strong></div>}
                    {detailAnimal.insuranceExpiry && <div><span className="si-23033f05">{t('animals.detailModal.expiry')}</span> <strong>{formatDate(detailAnimal.insuranceExpiry)}</strong></div>}
                  </div>
                </>
              )}

              {detailAnimal.medicalNotes && (
                <>
                  {sectionTitle('📋', t('animals.detailModal.medicalNotesSection'))}
                  <p className="si-7670ba8d">{detailAnimal.medicalNotes}</p>
                </>
              )}
            </div>
            <div className="si-6a645de2">
              <button className="btn-small" onClick={() => navigate('/medical-records')}>{t('animals.detailModal.medicalRecords')}</button>
              {canManageAnimals && <button className="btn-small si-f8147336" onClick={() => { setDetailAnimal(null); openEditForm(detailAnimal) }}>{t('animals.detailModal.editBtn')}</button>}
              <button className="btn-small si-c0374481" onClick={() => setDetailAnimal(null)}>{t('animals.detailModal.closeBtn')}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Bulk Import Modal ────────────────────────────── */}
      {showBulkImport && (
        <div className="edit-form-overlay" onClick={() => setShowBulkImport(false)}>
          <div className="edit-form-panel edit-form-modal si-be8d250d" onClick={e => e.stopPropagation()}>
            <button className="edit-form-close" onClick={() => setShowBulkImport(false)} aria-label="Close">✕</button>
            <h2>📥 {t('animals.bulkImport')}</h2>
            <p className="si-31e8dd17">{t('animals.csvHeaders')}</p>

            {importError && (
              <div className="si-c4c55552">{importError}</div>
            )}

            {!importResults && (
              <>
                <input ref={csvInputRef} type="file" accept=".csv" className="si-d6a2f871" onChange={handleCSVFile} />
                <div className="si-6e782388">
                  <button className="btn-primary" onClick={() => csvInputRef.current?.click()}>
                    📂 {t('animals.importCSV')}
                  </button>
                  <button className="btn-small" onClick={downloadTemplate}>⬇️ {t('animals.downloadTemplate')}</button>
                </div>
                <p className="si-c3b93ebb">{t('animals.maxAnimals')}</p>
              </>
            )}

            {importPreview.length > 0 && !importResults && (
              <>
                <h4 className="si-24d15068">{t('animals.importPreview')} ({importPreview.length} {t('animals.animalsCount')})</h4>
                <div className="data-table-container si-b7791771">
                  <table className="module-table">
                    <thead>
                      <tr>
                        <th>{t('animals.registerModal.name')}</th>
                        <th>{t('animals.registerModal.species')}</th>
                        <th>{t('animals.registerModal.breed')}</th>
                        <th>{t('animals.registerModal.gender')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 20).map((row, i) => (
                        <tr key={i}>
                          <td>{row.name}</td>
                          <td>{speciesLabel(row.species, t)}</td>
                          <td>{row.breed || '-'}</td>
                          <td>{row.gender || '-'}</td>
                        </tr>
                      ))}
                      {importPreview.length > 20 && (
                        <tr><td colSpan={4} className="si-ce2b8b2e">…and {importPreview.length - 20} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="si-f5f9f5f6">
                  <button className="btn-small" onClick={() => setImportPreview([])}>✕ Clear</button>
                  <button className="btn-primary" onClick={handleBulkImport} disabled={importLoading}>
                    {importLoading ? '⏳ Importing...' : `✅ Import ${importPreview.length} animals`}
                  </button>
                </div>
              </>
            )}

            {importResults && (
              <div>
                <h4 className="si-5aae4571">{t('animals.importResults')}</h4>
                <div className="si-10e693aa">
                  <div className="si-e3ece768">
                    <div className="si-676727df">{importResults.created}</div>
                    <div className="si-698e648e">{t('animals.animalsCreated')}</div>
                  </div>
                  <div style={{ padding: 16, background: importResults.failed > 0 ? '#ffebee' : '#f5f5f5', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: importResults.failed > 0 ? '#c62828' : '#9e9e9e' }}>{importResults.failed}</div>
                    <div className="si-3ee35c05">{t('animals.animalsFailed')}</div>
                  </div>
                </div>
                {importResults.errors.length > 0 && (
                  <div className="si-54785ed0">
                    <strong>{t('animals.importErrors')}:</strong>
                    {importResults.errors.map((e, i) => <div key={i} className="si-011cf8c3">• {e}</div>)}
                  </div>
                )}
                <div className="si-3f63b982">
                  <button className="btn-primary" onClick={() => setShowBulkImport(false)}>✓ Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Animals
