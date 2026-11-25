import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { vetHospitalApi } from '../../services/api/vetHospitalApi'
import { useAuth } from '../../context/AuthContext'
import { BottomSheet } from '../mobile/BottomSheet'
import { userMessage } from '../../utils/userMessage'
import './AttachHospitalSheet.css'

interface Props { open: boolean; networkId: string; onClose: () => void; onAttached: () => void }
interface Mine { id: string; name: string; city?: string; owner_id?: string; ownerId?: string; branch_network_id?: string | null; branchNetworkId?: string | null }

/**
 * A corporate admin attaches a hospital they own to their network. The server checks that the hospital is theirs and not already
 * part of another network, and says so in plain words when it is not; this list only offers hospitals that can be attached.
 */
export function AttachHospitalSheet({ open, networkId, onClose, onAttached }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [list, setList] = useState<Mine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let live = true
    setLoading(true); setError('')
    vetHospitalApi.listMyHospitals()
      .then(rows => { if (live) setList((rows as unknown as Mine[]).filter(h => (h.owner_id ?? h.ownerId) === user?.id && !(h.branch_network_id ?? h.branchNetworkId))) })
      .catch(e => { if (live) setError(userMessage(e, 'attachHospital.loadFailed')) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [open, user?.id])

  const attach = async (id: string) => {
    if (busy) return
    setBusy(true); setError('')
    try { await apiService.assignHospitalToNetwork(networkId, id); onAttached(); onClose() }
    catch (e) { setError(userMessage(e, 'attachHospital.failed')) }
    finally { setBusy(false) }
  }

  return (
    <BottomSheet open={open} title={t('attachHospital.title')} onClose={onClose}>
      <div className="ah-sheet">
        <p className="ah-hint">{t('attachHospital.hint')}</p>
        {loading && <p role="status">{t('common.loading')}</p>}
        {error && <p className="ah-error" role="alert">{error}</p>}
        {!loading && !error && list.length === 0 && <p className="ah-hint">{t('attachHospital.none')}</p>}
        <ul className="ah-list">
          {list.map(h => (
            <li key={h.id}>
              <span><strong>{h.name}</strong>{h.city ? ` · ${h.city}` : ''}</span>
              <button type="button" className="module-btn primary" disabled={busy} onClick={() => attach(h.id)}>{t('attachHospital.attach')}</button>
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  )
}
