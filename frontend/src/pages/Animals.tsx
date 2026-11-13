import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useMasterData } from '../context/MasterDataContext'
import AnimalFilterBar from '../components/animals/AnimalFilterBar'
import AnimalFormModal from '../components/animals/AnimalFormModal'
import AnimalCard from '../components/animals/AnimalCard'
import AnimalDetailModal from '../components/animals/AnimalDetailModal'
import BulkImportModal from '../components/animals/BulkImportModal'
import { emptyAnimalFormData, type AnimalData, type EnterpriseOption, type GroupOption } from '../components/animals/animalsShared'

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
  const [formData, setFormData] = useState(emptyAnimalFormData)
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
    setFormData(emptyAnimalFormData)
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
  <h1>&#x1F43E; waytovet Health Passport</h1>
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
        <AnimalFilterBar
          animalNames={animals.map(a => a.name)}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          speciesFilter={speciesFilter}
          setSpeciesFilter={setSpeciesFilter}
          uniqueSpecies={uniqueSpecies}
          isFarmer={isFarmer}
          enterpriseOptions={enterpriseOptions}
          enterpriseFilter={enterpriseFilter}
          setEnterpriseFilter={setEnterpriseFilter}
          groupOptions={groupOptions}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          filteredCount={filteredAnimals.length}
          t={t}
          speciesIcon={speciesIcon}
          speciesLabel={speciesLabel}
        />
      )}

      {/* ─── Registration / Edit Form Modal ──────────────── */}
      {showForm && (
        <AnimalFormModal
          formRef={formRef}
          formData={formData}
          setFormData={setFormData}
          editingAnimal={editingAnimal}
          onClose={() => { setShowForm(false); resetForm() }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          breeds={breeds}
          showEarTag={showEarTag}
          speciesCategories={speciesCategories}
          classTermsForSpecies={classTermsForSpecies}
          findClassTerm={findClassTerm}
          breedLabel={breedLabel}
          resolveLabel={resolveLabel}
          speciesIcon={speciesIcon}
          speciesLabel={speciesLabel}
          isFarmer={isFarmer}
          isAdmin={isAdmin}
          enterpriseOptions={enterpriseOptions}
          groupOptions={groupOptions}
          animals={animals}
          navigate={navigate}
          t={t}
        />
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
            {filteredAnimals.map(animal => (
              <AnimalCard
                key={animal.id}
                animal={animal}
                t={t}
                speciesIcon={speciesIcon}
                speciesLabel={speciesLabel}
                breedLabel={breedLabel}
                findClassTerm={findClassTerm}
                resolveLabel={resolveLabel}
                formatDate={formatDate}
                isVet={isVet}
                isAdmin={isAdmin}
                isPetOwner={isPetOwner}
                canManageAnimals={canManageAnimals}
                copiedId={copiedId}
                setCopiedId={setCopiedId}
                setError={setError}
                navigate={navigate}
                onViewDetails={setDetailAnimal}
                onEdit={openEditForm}
                onDelete={handleDelete}
                onDownloadPassport={handleDownloadPassport}
                passportLoading={passportLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Detail Modal ──────────────────────────────────── */}
      {detailAnimal && (
        <AnimalDetailModal
          detailAnimal={detailAnimal}
          onClose={() => setDetailAnimal(null)}
          onEdit={(a) => { setDetailAnimal(null); openEditForm(a) }}
          canManageAnimals={canManageAnimals}
          t={t}
          speciesIcon={speciesIcon}
          speciesLabel={speciesLabel}
          breedLabel={breedLabel}
          findClassTerm={findClassTerm}
          resolveLabel={resolveLabel}
          formatDate={formatDate}
          navigate={navigate}
        />
      )}
      {/* ── Bulk Import Modal ────────────────────────────── */}
      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          t={t}
          csvInputRef={csvInputRef}
          handleCSVFile={handleCSVFile}
          downloadTemplate={downloadTemplate}
          importError={importError}
          importPreview={importPreview}
          setImportPreview={setImportPreview}
          importResults={importResults}
          importLoading={importLoading}
          handleBulkImport={handleBulkImport}
          speciesLabel={speciesLabel}
        />
      )}
    </div>
  )
}

export default Animals
