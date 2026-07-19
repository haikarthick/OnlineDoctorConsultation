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
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', margin: '0 auto 8px', maxWidth: 480, fontSize: 13, color: '#1d4ed8' }}>
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
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14 }}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔀</div>
          <p>{t('referrals.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {referrals.map((r) => (
            <div key={r.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {r.fromVetName} → {r.toVetName || t('referrals.anyDoctor')}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                    {r.animalName ? `${r.animalName} · ` : ''}{r.reason}
                  </div>
                  {r.paidAmount && (
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      {t('referrals.paidAmount')}: <strong>{formatCurrency(parseFloat(String(r.paidAmount)))}</strong>
                    </div>
                  )}
                  <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                    {r.createdAt ? formatDate(r.createdAt) : ''}
                    {r.transferStatus === 'offered' && deadlineLeft(r) ? ` · ${deadlineLeft(r)}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ background: '#f3f4f6', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                    {statusLabel(r)}
                  </span>
                  {!isVet && r.transferStatus === 'offered' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {r.toVetId && (
                        <button className="module-btn primary" disabled={busy} onClick={() => startAccept(r, false)}>
                          {t('referrals.accept')}
                        </button>
                      )}
                      <button className="module-btn" disabled={busy} onClick={() => startAccept(r, true)}>
                        {t('referrals.chooseAnother')}
                      </button>
                      <button className="module-btn" style={{ color: '#b91c1c' }} disabled={busy} onClick={() => setDeclining(r)}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
            <h3 style={{ marginBottom: 6 }}>{chooseOther ? t('referrals.chooseAnother') : t('referrals.acceptTitle')}</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>{t('referrals.acceptHint')}</p>

            {(chooseOther || !accepting.toVetId) && (
              <select
                value={chosenVetId}
                onChange={(e) => { setChosenVetId(e.target.value); if (slotDate) loadSlots(e.target.value, slotDate) }}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}
              >
                <option value="">{t('referrals.selectDoctor')}</option>
                {vets.filter((v: any) => (v.userId || v.id) !== accepting.fromVetId).map((v: any) => (
                  <option key={v.userId || v.id} value={v.userId || v.id}>
                    Dr. {v.firstName} {v.lastName} — {formatCurrency(parseFloat(String(v.consultationFee || 0)))}
                  </option>
                ))}
              </select>
            )}

            <input
              type="date"
              value={slotDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => { setSlotDate(e.target.value); loadSlots(targetVetIdFor(accepting), e.target.value) }}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}
            />

            {slotsLoading ? (
              <p style={{ color: '#6b7280', fontSize: 13 }}>{t('common.loading')}</p>
            ) : slots.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {slots.map((s: any) => (
                  <button
                    key={s.startTime}
                    className={`module-btn${chosenSlot?.startTime === s.startTime ? ' primary' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => setChosenSlot(s)}
                  >
                    {s.startTime}
                  </button>
                ))}
              </div>
            ) : slotDate ? (
              <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 14 }}>{t('referrals.noSlots')}</p>
            ) : null}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setAccepting(null)} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !chosenSlot || !targetVetIdFor(accepting)} onClick={confirmAccept}>
                {busy ? t('common.loading') : t('referrals.confirmAccept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline (refund) modal with destination choice (D7) */}
      {declining && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 420, width: '100%', padding: 24 }}>
            <h3 style={{ marginBottom: 6 }}>{t('referrals.refundTitle')}</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{t('referrals.refundHint')}</p>
            <div style={{ display: 'grid', gap: 10 }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
            <h3 style={{ marginBottom: 6 }}>{t('referrals.referTitle')}</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>{t('referrals.referHint')}</p>

            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t('referrals.upcomingBookings')}</div>
            {referable.bookings.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>{t('referrals.none')}</p>}
            {referable.bookings.map((b: any) => (
              <label key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name="referSource" checked={referSource?.kind === 'booking' && referSource.id === b.id}
                  onChange={() => setReferSource({ kind: 'booking', id: b.id })} />
                <span>
                  {b.patientName}{b.animalName ? ` (${b.animalName})` : ''} — {b.scheduledDate ? formatDate(b.scheduledDate) : ''} {b.timeSlotStart}
                  {b.priority === 'emergency' ? ' ⚡' : ''}
                </span>
              </label>
            ))}

            <div style={{ fontWeight: 600, fontSize: 13, margin: '12px 0 6px' }}>{t('referrals.recentConsultations')}</div>
            {referable.consultations.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>{t('referrals.none')}</p>}
            {referable.consultations.map((c: any) => (
              <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name="referSource" checked={referSource?.kind === 'consultation' && referSource.id === c.id}
                  onChange={() => setReferSource({ kind: 'consultation', id: c.id })} />
                <span>{c.patientName}{c.animalName ? ` (${c.animalName})` : ''} — {c.completedAt ? formatDate(c.completedAt) : ''}</span>
              </label>
            ))}

            <div style={{ fontWeight: 600, fontSize: 13, margin: '12px 0 6px' }}>{t('referrals.targetDoctor')}</div>
            <select value={referTargetId} onChange={(e) => setReferTargetId(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <option value="">{referSource?.kind === 'booking' ? t('referrals.patientChooses') : t('referrals.selectDoctor')}</option>
              {vets.filter((v: any) => (v.userId || v.id) !== user?.id).map((v: any) => (
                <option key={v.userId || v.id} value={v.userId || v.id}>
                  Dr. {v.firstName} {v.lastName} — {formatCurrency(parseFloat(String(v.consultationFee || 0)))}
                </option>
              ))}
            </select>

            <textarea placeholder={t('referrals.reasonPlaceholder')} value={referReason}
              onChange={(e) => setReferReason(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', minHeight: 70, marginBottom: 6 }} />

            {referSource?.kind === 'booking' && (
              <p style={{ color: '#b45309', fontSize: 12, marginBottom: 10 }}>{t('referrals.referCostNotice')}</p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowRefer(false)} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }}
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
