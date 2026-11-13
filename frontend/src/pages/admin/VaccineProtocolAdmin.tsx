import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useMasterData } from '../../context/MasterDataContext'
import VaccineProtocolStatsPanel from '../../components/vaccineProtocol/VaccineProtocolStatsPanel'
import VaccineProtocolFilterBar from '../../components/vaccineProtocol/VaccineProtocolFilterBar'
import VaccineProtocolCard from '../../components/vaccineProtocol/VaccineProtocolCard'
import VaccineProtocolFormModal from '../../components/vaccineProtocol/VaccineProtocolFormModal'
import VaccineProtocolHistoryModal from '../../components/vaccineProtocol/VaccineProtocolHistoryModal'
import { Protocol, ProtocolChange, Stats, EMPTY_FORM } from '../../components/vaccineProtocol/vaccineProtocolShared'
import '../../styles/modules.css'
import './VaccineProtocolAdmin.css'

interface VaccineProtocolAdminProps {
  onNavigate: (path: string) => void
}

const VaccineProtocolAdmin: React.FC<VaccineProtocolAdminProps> = ({ onNavigate: _onNavigate }) => {
  const { t } = useTranslation()
  const { speciesLabel } = useMasterData()
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters
  const [filterSpecies, setFilterSpecies] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  // Modal state
  const [showFormModal, setShowFormModal] = useState(false)
  const [editProtocol, setEditProtocol] = useState<Protocol | null>(null)
  const [formData, setFormData] = useState<Partial<Protocol>>(EMPTY_FORM)
  const [formSaving, setFormSaving] = useState(false)

  // Change history panel
  const [historyProtocol, setHistoryProtocol] = useState<Protocol | null>(null)
  const [changes, setChanges] = useState<ProtocolChange[]>([])
  const [loadingChanges, setLoadingChanges] = useState(false)
  const [showAddChange, setShowAddChange] = useState(false)
  const [changeForm, setChangeForm] = useState({
    changedField: '', oldValue: '', newValue: '', changeReason: '', regulatoryStandard: '', effectiveDate: new Date().toISOString().split('T')[0],
  })
  const [savingChange, setSavingChange] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiService.adminListVaccineProtocols({
        species: filterSpecies || undefined,
        category: filterCategory || undefined,
        activeOnly: !showArchived,
      })
      setProtocols(res.data?.protocols || [])
      setStats(res.data?.stats || null)
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.errorLoading'))
    } finally {
      setLoading(false)
    }
  }, [filterSpecies, filterCategory, showArchived, t])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditProtocol(null)
    setFormData(EMPTY_FORM)
    setShowFormModal(true)
  }

  const openEdit = (p: Protocol) => {
    setEditProtocol(p)
    setFormData({ ...p })
    setShowFormModal(true)
  }

  const saveForm = async () => {
    if (!formData.name || !formData.disease || !formData.species?.length) {
      setError(t('vaccineProtocol.validation.nameDiseasesSpeciesRequired'))
      return
    }
    setFormSaving(true)
    setError('')
    try {
      if (editProtocol) {
        await apiService.adminUpdateVaccineProtocol(editProtocol.id, formData)
        setSuccess(t('vaccineProtocol.updatedSuccess'))
      } else {
        await apiService.adminCreateVaccineProtocol(formData)
        setSuccess(t('vaccineProtocol.createdSuccess'))
      }
      setShowFormModal(false)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.errorSaving'))
    } finally {
      setFormSaving(false)
    }
  }

  const toggleArchive = async (p: Protocol) => {
    try {
      if (p.isActive) {
        await apiService.adminArchiveVaccineProtocol(p.id)
        setSuccess(t('vaccineProtocol.archivedSuccess'))
      } else {
        await apiService.adminRestoreVaccineProtocol(p.id)
        setSuccess(t('vaccineProtocol.restoredSuccess'))
      }
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.errorSaving'))
    }
  }

  const openHistory = async (p: Protocol) => {
    setHistoryProtocol(p)
    setLoadingChanges(true)
    setShowAddChange(false)
    try {
      const res = await apiService.getVaccineProtocolChanges(p.id)
      setChanges(res.data || [])
    } catch {
      setChanges([])
    } finally {
      setLoadingChanges(false)
    }
  }

  const saveChange = async () => {
    if (!historyProtocol || !changeForm.changedField || !changeForm.newValue) return
    setSavingChange(true)
    try {
      await apiService.addVaccineProtocolChange(historyProtocol.id, changeForm)
      const res = await apiService.getVaccineProtocolChanges(historyProtocol.id)
      setChanges(res.data || [])
      setShowAddChange(false)
      setChangeForm({ changedField: '', oldValue: '', newValue: '', changeReason: '', regulatoryStandard: '', effectiveDate: new Date().toISOString().split('T')[0] })
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.errorSaving'))
    } finally {
      setSavingChange(false)
    }
  }

  const handleSpeciesToggle = (sp: string) => {
    const current = formData.species || []
    setFormData(prev => ({
      ...prev,
      species: current.includes(sp) ? current.filter(s => s !== sp) : [...current, sp],
    }))
  }

  const filtered = protocols.filter(p => {
    if (!search) return true
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.disease.toLowerCase().includes(search.toLowerCase()) ||
      p.species.some(s => s.toLowerCase().includes(search.toLowerCase()))
    )
  })

  return (
    <div className="module-page vpa-page">
      <div className="module-header">
        <h1>{t('vaccineProtocol.title')}</h1>
        <p>{t('vaccineProtocol.subtitle')}</p>
      </div>

      {error && (
        <div className="module-alert error">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
      {success && (
        <div className="module-alert success">
          {success}
          <button onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      <VaccineProtocolStatsPanel stats={stats} t={t} />

      <VaccineProtocolFilterBar
        search={search}
        setSearch={setSearch}
        protocols={protocols}
        filterSpecies={filterSpecies}
        setFilterSpecies={setFilterSpecies}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        filteredCount={filtered.length}
        onAdd={openAdd}
        t={t}
      />

      {/* Protocol Card Grid */}
      {loading ? (
        <div className="module-loading">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="vpa-empty-state">
          <div className="vpa-empty-icon">💉</div>
          <p>{t('vaccineProtocol.noProtocols')}</p>
        </div>
      ) : (
        <div className="vpa-protocol-grid">
          {filtered.map(p => (
            <VaccineProtocolCard
              key={p.id}
              protocol={p}
              onEdit={openEdit}
              onHistory={openHistory}
              onToggleArchive={toggleArchive}
              t={t}
              speciesLabel={speciesLabel}
            />
          ))}
        </div>
      )}

      {showFormModal && (
        <VaccineProtocolFormModal
          editProtocol={editProtocol}
          formData={formData}
          setFormData={setFormData}
          onSave={saveForm}
          onClose={() => setShowFormModal(false)}
          saving={formSaving}
          onSpeciesToggle={handleSpeciesToggle}
          t={t}
        />
      )}

      {historyProtocol && (
        <VaccineProtocolHistoryModal
          protocol={historyProtocol}
          changes={changes}
          loadingChanges={loadingChanges}
          showAddChange={showAddChange}
          setShowAddChange={setShowAddChange}
          changeForm={changeForm}
          setChangeForm={setChangeForm}
          onSaveChange={saveChange}
          savingChange={savingChange}
          onClose={() => setHistoryProtocol(null)}
          t={t}
        />
      )}
    </div>
  )
}

export default VaccineProtocolAdmin
