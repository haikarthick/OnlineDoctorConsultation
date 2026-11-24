import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { userMessage } from '../../utils/userMessage'

export interface StockMatch {
  medId: string
  name: string
  kind: 'medicine' | 'diet' | 'supplement'
  withdrawalMilkDays: number | null
  withdrawalMeatDays: number | null
  differs: boolean
}

export interface ReviewLine {
  name: string
  kind?: 'medicine' | 'medicated_feed' | 'diet' | 'supplement'
  treatmentDays?: number
  withdrawalMilkDays?: number
  withdrawalMeatDays?: number
  withdrawalNone?: boolean
  stockMatch?: StockMatch
}

interface Product { id: string; name: string; strength?: string | null; form?: string | null; product_kind: StockMatch['kind']; withdrawal_milk_days: number | null; withdrawal_meat_days: number | null }

/**
 * What the vet wrote on a prescription line (kind, treatment days, label withdrawal days) and which of the pharmacy's OWN
 * products it is - chosen once, remembered for the next prescription of the same medicine. The pharmacy's label days are shown
 * beside the vet's for the pharmacist's information; the vet's line is what the farm follows. No medicine list is shipped.
 */
export default function PrescriptionLineMatch({ line, pharmacyId }: { line: ReviewLine; pharmacyId?: string }) {
  const { t } = useTranslation()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [match, setMatch] = useState<StockMatch | undefined>(line.stockMatch)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!pharmacyId) return
    let live = true
    client.get(`/pharmacies/${pharmacyId}/medications`)
      .then(r => { if (live) setProducts(Array.isArray(r.data) ? r.data : []) })
      .catch(() => { if (live) setProducts([]) })
    return () => { live = false }
  }, [pharmacyId])

  const days = (v: number | null | undefined) => (v == null ? '-' : String(v))
  const vetGaveDays = line.withdrawalMilkDays != null || line.withdrawalMeatDays != null
  const kind = line.kind === 'medicated_feed' ? 'medicine' : (line.kind || 'medicine')

  const choose = async (medId: string) => {
    if (!pharmacyId) return
    setBusy(true); setError('')
    try {
      await client.put(`/pharmacies/${pharmacyId}/line-matches`, { lineName: line.name, medId: medId || null })
      const p = products?.find(x => x.id === medId)
      setMatch(p ? {
        medId: p.id, name: p.name, kind: p.product_kind, withdrawalMilkDays: p.withdrawal_milk_days, withdrawalMeatDays: p.withdrawal_meat_days,
        differs: (p.withdrawal_milk_days != null && line.withdrawalMilkDays != null && p.withdrawal_milk_days !== line.withdrawalMilkDays)
          || (p.withdrawal_meat_days != null && line.withdrawalMeatDays != null && p.withdrawal_meat_days !== line.withdrawalMeatDays),
      } : undefined)
    } catch (err) {
      setError(userMessage(err, 'pharmacy.review.matchFailed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="pharm-line-match">
      <div className="pharm-line-facts">
        {kind !== 'medicine' && <span className="pharm-badge">{t(`pharmacy.catalog.kind_${kind}`)}</span>}
        {line.treatmentDays ? <span className="pharm-badge">{t('pharmacy.review.lineTreatment', { count: line.treatmentDays })}</span> : null}
        {kind === 'medicine' && (line.withdrawalNone
          ? <span className="pharm-badge">{t('pharmacy.review.lineVetNone')}</span>
          : vetGaveDays
            ? <span className="pharm-badge">{t('pharmacy.review.lineVetLabel', { milk: days(line.withdrawalMilkDays), meat: days(line.withdrawalMeatDays) })}</span>
            : <span className="pharm-badge">{t('pharmacy.review.lineNotGiven')}</span>)}
      </div>

      {pharmacyId && (
        <label className="pharm-line-pick">
          <span>{match ? t('pharmacy.review.matchedTo', { name: match.name }) : t('pharmacy.review.matchPick')}</span>
          <select value={match?.medId || ''} disabled={busy || products === null} onChange={e => void choose(e.target.value)}>
            <option value="">{t('pharmacy.review.matchNone')}</option>
            {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}{p.strength ? ` ${p.strength}` : ''}</option>)}
          </select>
        </label>
      )}
      {match && (match.withdrawalMilkDays != null || match.withdrawalMeatDays != null) && (
        <p className="pharm-line-note">{t('pharmacy.review.matchedLabel', { milk: days(match.withdrawalMilkDays), meat: days(match.withdrawalMeatDays) })}</p>
      )}
      {match?.differs && <p className="pharm-line-warn" role="status">{t('pharmacy.review.matchDiffers')}</p>}
      {error && <p className="pharm-error" role="alert">{error}</p>}
    </div>
  )
}
