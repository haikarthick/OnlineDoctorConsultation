import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import PaymentCheckout from '../components/PaymentCheckout'
import '../styles/modules.css'

/**
 * Referrals (docs/PAYMENT_MODULE_PLAN.md §4.4, D10).
 * Patients: act on offered referrals (accept / choose another doctor / refund)
 * and see history. Doctors: initiate referrals and see sent/received history.
 */
const Referrals: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatCurrency, formatDate } = useSettings()
  const isVet = user?.role === 'veterinarian'

  const [referrals, setReferrals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Patient accept flow state
  const [accepting, setAccepting] = useState<any | null>(null) // referral being accepted
  const [chooseOther, setChooseOther] = useState(false)
  const [vets, setVets] = useState<any[]>([])
  const [chosenVetId, setChosenVetId] = useState('')
  const [slotDate, setSlotDate] = useState('')
  const [slots, setSlots] = useState<any[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [chosenSlot, setChosenSlot] = useState<any | null>(null)
  const [declining, setDeclining] = useState<any | null>(null)
  const [checkout, setCheckout] = useState<{ bookingId: string; amount: number; expiresAt: string | null } | null>(null)

  // Doctor initiate flow state
  const [showRefer, setShowRefer] = useState(false)
  const [referable, setReferable] = useState<{ bookings: any[]; consultations: any[] }>({ bookings: [], consultations: [] })
  const [referSource, setReferSource] = useState<{ kind: 'booking' | 'consultation'; id: string } | null>(null)
  const [referTargetId, setReferTargetId] = useState('')
  const [referReason, setReferReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp: any = await apiService.listMyPlatformReferrals()
      setReferrals(Array.isArray(resp?.data) ? resp.data : [])
    } catch { setReferrals([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const loadVets = useCallback(async () => {
    try {
      const resp: any = await apiService.listVets({ limit: 100, availableOnly: 'true' })
      const data = resp?.data || resp
      const list = data?.profiles || data?.items || data || []
      setVets(Array.isArray(list) ? list : [])
    } catch { setVets([]) }
  }, [])

  const loadSlots = useCallback(async (vetId: string, date: string) => {
    if (!vetId || !date) return
    try {
      setSlotsLoading(true)
      setChosenSlot(null)
      const resp: any = await apiService.getVetAvailability(vetId, date)
      const data = resp?.data || resp
      const list = data?.slots || data || []
      setSlots(Array.isArray(list) ? list.filter((s: any) => s.isAvailable !== false) : [])
    } catch { setSlots([]) } finally { setSlotsLoading(false) }
  }, [])

  const targetVetIdFor = (r: any) => (chooseOther ? chosenVetId : (r.toVetId || chosenVetId))

  const startAccept = (r: any, other: boolean) => {
    setAccepting(r)
    setChooseOther(other)
    setChosenVetId(other ? '' : (r.toVetId || ''))
    setSlotDate('')
    setSlots([])
    setChosenSlot(null)
    setMessage('')
    if (other || !r.toVetId) loadVets()
  }

  const confirmAccept = async () => {
    if (!accepting || !chosenSlot) return
    const vetId = targetVetIdFor(accepting)
    if (!vetId) return
    try {
      setBusy(true)
      setMessage('')
      const resp: any = await apiService.acceptPlatformReferral(accepting.id, {
        veterinarianId: chooseOther ? vetId : undefined,
        scheduledDate: slotDate,
        timeSlotStart: chosenSlot.startTime,
        timeSlotEnd: chosenSlot.endTime,
      })
      const booking = resp?.data || resp
      setAccepting(null)
      if (booking?.paymentId) {
        setCheckout({
          bookingId: booking.id,
          amount: parseFloat(String(booking.paymentAmount || 0)),
          expiresAt: booking.paymentExpiresAt || null,
        })
      } else {
        setMessage(t('referrals.accepted'))
        await load()
      }
    } catch (err: any) {
      setMessage(err.response?.data?.error?.message || err.response?.data?.error || t('referrals.actionFailed'))
    } finally { setBusy(false) }
  }

  const confirmDecline = async (destination: 'wallet' | 'gateway') => {
    if (!declining) return
    try {
      setBusy(true)
      setMessage('')
      await apiService.declinePlatformReferral(declining.id, destination)
      setDeclining(null)
      setMessage(t('referrals.refunded'))
      await load()
    } catch (err: any) {
      setMessage(err.response?.data?.error?.message || err.response?.data?.error || t('referrals.actionFailed'))
    } finally { setBusy(false) }
  }

  const openReferModal = async () => {
    setShowRefer(true)
    setReferSource(null)
    setReferTargetId('')
    setReferReason('')
    try {
      const [refResp] = await Promise.all([apiService.getReferableItems(), loadVets()])
      const data = (refResp as any)?.data || {}
      setReferable({ bookings: data.bookings || [], consultations: data.consultations || [] })
    } catch { setReferable({ bookings: [], consultations: [] }) }
  }

  const submitReferral = async () => {
    if (!referSource || !referReason.trim()) return
    if (referSource.kind === 'consultation' && !referTargetId) return
    try {
      setBusy(true)
      setMessage('')
      await apiService.createPlatformReferral({
        toVetId: referTargetId || null,
        reason: referReason.trim(),
        bookingId: referSource.kind === 'booking' ? referSource.id : undefined,
        consultationId: referSource.kind === 'consultation' ? referSource.id : undefined,
      })
      setShowRefer(false)
      setMessage(t('referrals.created'))
      await load()
    } catch (err: any) {
      setMessage(err.response?.data?.error?.message || err.response?.data?.error || t('referrals.actionFailed'))
    } finally { setBusy(false) }
  }

  const statusLabel = (r: any) => {
    if (r.transferStatus) return String(t(`referrals.transferStatuses.${r.transferStatus}`, r.transferStatus))
    return String(t('referrals.informational'))
  }

  const deadlineLeft = (r: any) => {
    if (!r.actionDeadline) return null
    const ms = new Date(r.actionDeadline).getTime() - Date.now()
    if (ms <= 0) return t('referrals.deadlinePassed')
    const hours = Math.floor(ms / 3600000)
    return t('referrals.deadlineIn', { hours })
  }

  // Checkout screen after accepting (wallet credit auto-applied)
  if (checkout) {
    return (
      <div className="module-page">
        <div className="si-3234335a">
          {t('referrals.walletHopNotice')}
        </div>
        <PaymentCheckout
          bookingId={checkout.bookingId}
          amount={checkout.amount}
          expiresAt={checkout.expiresAt}
          defaultUseWallet={true}
          onSuccess={() => { setCheckout(null); setMessage(t('referrals.accepted')); load() }}
          onCancel={() => { setCheckout(null); onNavigate && onNavigate('/consultations') }}
        />
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('referrals.title')}</h1>
          <p className="page-subtitle">{isVet ? t('referrals.subtitleVet') : t('referrals.subtitlePatient')}</p>
        </div>
        {isVet && (
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={openReferModal}>{t('referrals.referButton')}</button>
          </div>
        )}
      </div>

      {message && (
        <div className="si-900a41f7">
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : referrals.length === 0 ? (
        <div className="si-71785fd4">
          <div className="si-fc4388e2">🔀</div>
          <p>{t('referrals.empty')}</p>
        </div>
      ) : (
        <div className="si-2a57fba0">
          {referrals.map((r) => (
            <div key={r.id} className="si-2e21f3c6">
              <div className="si-fa065845">
                <div className="si-8b796880">
                  <div className="si-f3347717">
                    {r.fromVetName} → {r.toVetName || t('referrals.anyDoctor')}
                  </div>
                  <div className="si-6467593a">
                    {r.animalName ? `${r.animalName} · ` : ''}{r.reason}
                  </div>
                  {r.paidAmount && (
                    <div className="si-62c5167c">
                      {t('referrals.paidAmount')}: <strong>{formatCurrency(parseFloat(String(r.paidAmount)))}</strong>
                    </div>
                  )}
                  <div className="si-322b324f">
                    {r.createdAt ? formatDate(r.createdAt) : ''}
                    {r.transferStatus === 'offered' && deadlineLeft(r) ? ` · ${deadlineLeft(r)}` : ''}
                  </div>
                </div>
                <div className="si-f4e64596">
                  <span className="si-d59e7ca1">
                    {statusLabel(r)}
                  </span>
                  {!isVet && r.transferStatus === 'offered' && (
                    <div className="si-a5676f76">
                      {r.toVetId && (
                        <button className="module-btn primary" disabled={busy} onClick={() => startAccept(r, false)}>
                          {t('referrals.accept')}
                        </button>
                      )}
                      <button className="module-btn" disabled={busy} onClick={() => startAccept(r, true)}>
                        {t('referrals.chooseAnother')}
                      </button>
                      <button className="module-btn si-650f6574" disabled={busy} onClick={() => setDeclining(r)}>
                        {t('referrals.refund')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accept modal: doctor (if choosing) + date + slot */}
      {accepting && (
        <div className="si-9f028f26">
          <div className="si-ae33cd59">
            <h3 className="si-3c64c436">{chooseOther ? t('referrals.chooseAnother') : t('referrals.acceptTitle')}</h3>
            <p className="si-ea95bef1">{t('referrals.acceptHint')}</p>

            {(chooseOther || !accepting.toVetId) && (
              <select
                value={chosenVetId}
                onChange={(e) => { setChosenVetId(e.target.value); if (slotDate) loadSlots(e.target.value, slotDate) }}
                className="si-a01c8879"
              >
                <option value="">{t('referrals.selectDoctor')}</option>
                {vets.filter((v: any) => (v.userId || v.id) !== accepting.fromVetId).map((v: any) => (
                  <option key={v.userId || v.id} value={v.userId || v.id}>
                    Dr. {v.firstName} {v.lastName} - {formatCurrency(parseFloat(String(v.consultationFee || 0)))}
                  </option>
                ))}
              </select>
            )}

            <input
              type="date"
              value={slotDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => { setSlotDate(e.target.value); loadSlots(targetVetIdFor(accepting), e.target.value) }}
              className="si-a01c8879"
            />

            {slotsLoading ? (
              <p className="si-c3b93ebb">{t('common.loading')}</p>
            ) : slots.length > 0 ? (
              <div className="si-ed546b5f">
                {slots.map((s: any) => (
                  <button
                    key={s.startTime}
                    className={`module-btn${chosenSlot?.startTime === s.startTime ? ' primary' : ''} si-d7b5d9f9`}
                   
                    onClick={() => setChosenSlot(s)}
                  >
                    {s.startTime}
                  </button>
                ))}
              </div>
            ) : slotDate ? (
              <p className="si-cf43e3ec">{t('referrals.noSlots')}</p>
            ) : null}

            <div className="si-ad918842">
              <button className="btn btn-outline si-6acd75e8" onClick={() => setAccepting(null)} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary si-6acd75e8" disabled={busy || !chosenSlot || !targetVetIdFor(accepting)} onClick={confirmAccept}>
                {busy ? t('common.loading') : t('referrals.confirmAccept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline (refund) modal with destination choice (D7) */}
      {declining && (
        <div className="si-9f028f26">
          <div className="si-da07280d">
            <h3 className="si-3c64c436">{t('referrals.refundTitle')}</h3>
            <p className="si-9a3b1c05">{t('referrals.refundHint')}</p>
            <div className="si-faca492d">
              <button className="btn btn-primary" disabled={busy} onClick={() => confirmDecline('wallet')}>
                {t('referrals.refundToWallet')} ⚡
              </button>
              <button className="btn btn-outline" disabled={busy} onClick={() => confirmDecline('gateway')}>
                {t('referrals.refundToSource')}
              </button>
              <button className="btn btn-outline" onClick={() => setDeclining(null)} disabled={busy}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor: initiate referral modal */}
      {showRefer && (
        <div className="si-9f028f26">
          <div className="si-86866731">
            <h3 className="si-3c64c436">{t('referrals.referTitle')}</h3>
            <p className="si-ea95bef1">{t('referrals.referHint')}</p>

            <div className="si-f14fec9c">{t('referrals.upcomingBookings')}</div>
            {referable.bookings.length === 0 && <p className="si-7b05444b">{t('referrals.none')}</p>}
            {referable.bookings.map((b: any) => (
              <label key={b.id} className="si-db8d8b8b">
                <input type="radio" name="referSource" checked={referSource?.kind === 'booking' && referSource.id === b.id}
                  onChange={() => setReferSource({ kind: 'booking', id: b.id })} />
                <span>
                  {b.patientName}{b.animalName ? ` (${b.animalName})` : ''} - {b.scheduledDate ? formatDate(b.scheduledDate) : ''} {b.timeSlotStart}
                  {b.priority === 'emergency' ? ' ⚡' : ''}
                </span>
              </label>
            ))}

            <div className="si-648403c6">{t('referrals.recentConsultations')}</div>
            {referable.consultations.length === 0 && <p className="si-7b05444b">{t('referrals.none')}</p>}
            {referable.consultations.map((c: any) => (
              <label key={c.id} className="si-db8d8b8b">
                <input type="radio" name="referSource" checked={referSource?.kind === 'consultation' && referSource.id === c.id}
                  onChange={() => setReferSource({ kind: 'consultation', id: c.id })} />
                <span>{c.patientName}{c.animalName ? ` (${c.animalName})` : ''} - {c.completedAt ? formatDate(c.completedAt) : ''}</span>
              </label>
            ))}

            <div className="si-648403c6">{t('referrals.targetDoctor')}</div>
            <select value={referTargetId} onChange={(e) => setReferTargetId(e.target.value)}
              className="si-a01c8879">
              <option value="">{referSource?.kind === 'booking' ? t('referrals.patientChooses') : t('referrals.selectDoctor')}</option>
              {vets.filter((v: any) => (v.userId || v.id) !== user?.id).map((v: any) => (
                <option key={v.userId || v.id} value={v.userId || v.id}>
                  Dr. {v.firstName} {v.lastName} - {formatCurrency(parseFloat(String(v.consultationFee || 0)))}
                </option>
              ))}
            </select>

            <textarea placeholder={t('referrals.reasonPlaceholder')} value={referReason}
              onChange={(e) => setReferReason(e.target.value)}
              className="si-0433bebb" />

            {referSource?.kind === 'booking' && (
              <p className="si-3926e87f">{t('referrals.referCostNotice')}</p>
            )}

            <div className="si-ad918842">
              <button className="btn btn-outline si-6acd75e8" onClick={() => setShowRefer(false)} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary si-6acd75e8"
                disabled={busy || !referSource || !referReason.trim() || (referSource?.kind === 'consultation' && !referTargetId)}
                onClick={submitReferral}>
                {busy ? t('common.loading') : t('referrals.submitReferral')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Referrals
