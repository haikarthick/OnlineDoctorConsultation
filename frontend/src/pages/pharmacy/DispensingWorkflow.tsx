import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import PrescriptionReviewModal from './PrescriptionReviewModal'
import DispensingModal from './DispensingModal'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface Prescription {
  id: string
  pet_name: string
  owner_name: string
  vet_name: string
  medication_names: string
  created_at: string
  review_status: string
  target_pharmacy_id: string
}

interface Props {
  pharmacyId: string
  mode: 'review' | 'dispense'
  onRefresh?: () => void
}

export default function DispensingWorkflow({ pharmacyId, mode, onRefresh }: Props) {
  const { t } = useTranslation()
  const [items, setItems] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<Prescription | null>(null)

  const load = useCallback(async () => {
    const path = mode === 'review'
      ? `/pharmacies/${pharmacyId}/pending-prescriptions`
      : `/pharmacies/${pharmacyId}/ready-for-dispensing`
    try {
      const res = await client.get(path)
      setItems(res.data || [])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [pharmacyId, mode, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-dispense', load, 30000)

  const handleDone = () => {
    setTarget(null)
    load()
    onRefresh?.()
  }

  const title = mode === 'review' ? t('pharmacy.review.queueTitle') : t('pharmacy.dispense.queueTitle')
  const actionLabel = mode === 'review' ? t('pharmacy.actions.review') : t('pharmacy.actions.dispense')
  const emptyMsg = mode === 'review' ? t('pharmacy.noPendingReviews') : t('pharmacy.noReadyDispense')

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>{mode === 'review' ? '📋' : '✅'} {title}</h3>
        </div>
        {error && <div className="pharm-error">⚠️ {error}</div>}
        {loading ? (
          <p className="si-40d2db53">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="pharmacy-empty"><div className="empty-icon">{mode === 'review' ? '📋' : '✅'}</div><p>{emptyMsg}</p></div>
        ) : (
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.table.patient')}</th>
                  <th>{t('pharmacy.table.owner')}</th>
                  <th>{t('pharmacy.table.vet')}</th>
                  <th>{t('pharmacy.table.medications')}</th>
                  <th>{t('pharmacy.table.date')}</th>
                  <th>{t('pharmacy.table.status')}</th>
                  <th>{t('common.action')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(rx => (
                  <tr key={rx.id}>
                    <td>{rx.pet_name || '-'}</td>
                    <td>{rx.owner_name || '-'}</td>
                    <td>{rx.vet_name || '-'}</td>
                    <td className="si-d83d7d70">{rx.medication_names || '-'}</td>
                    <td>{rx.created_at ? new Date(rx.created_at).toLocaleDateString() : '-'}</td>
                    <td><span className={`pharm-badge ${rx.review_status === 'pending_review' ? 'pending' : 'approved'}`}>{rx.review_status}</span></td>
                    <td>
                      <button className="module-btn small primary" onClick={() => setTarget(rx)}>
                        {actionLabel}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {target && mode === 'review' && (
        <PrescriptionReviewModal
          prescription={target}
          pharmacyId={pharmacyId}
          onClose={() => setTarget(null)}
          onDone={handleDone}
        />
      )}
      {target && mode === 'dispense' && (
        <DispensingModal
          prescription={target}
          pharmacyId={pharmacyId}
          onClose={() => setTarget(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}
