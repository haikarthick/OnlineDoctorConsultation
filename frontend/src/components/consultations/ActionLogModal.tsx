import type { TFunction } from 'i18next'

interface Props {
  t: TFunction
  actionLogs: any[]
  actionLogsLoading: boolean
  formatSlotTime: (s: string) => string
  actionLabel: (action: string) => string
  onClose: () => void
}

const ActionLogModal = ({ t, actionLogs, actionLogsLoading, formatSlotTime, actionLabel, onClose }: Props) => (
  <div className="si-8d03dc26" onClick={onClose}>
    <div className="si-49aa5192" onClick={e => e.stopPropagation()}>
      <div className="si-101fd1d0">
        <h2 className="si-670df8d2">{t('consultations.actionLog.title')}</h2>
        <button type="button" onClick={onClose} className="si-60f45c55">✕</button>
      </div>

      {actionLogsLoading && <p className="si-23033f05">{t('consultations.actionLog.loading')}</p>}

      {!actionLogsLoading && actionLogs.length === 0 && (
        <p className="si-8a6a7c8a">{t('consultations.actionLog.empty')}</p>
      )}

      {!actionLogsLoading && actionLogs.length > 0 && (
        <div className="si-3edfa4b6">
          {actionLogs.map((log, idx) => (
            <div key={log.id} className={`consult-log-entry${idx < actionLogs.length - 1 ? ' has-border' : ''}`}>
              <div className={`consult-log-dot action-${log.action === 'BOOKING_CREATED' ? 'created'
                : log.action === 'BOOKING_CONFIRMED' ? 'confirmed'
                : log.action === 'BOOKING_CANCELLED' ? 'cancelled'
                : log.action === 'BOOKING_RESCHEDULED' ? 'rescheduled' : 'default'}`} />
              <div className="si-6acd75e8">
                <div className="si-807dc7b4">
                  {actionLabel(log.action)}
                </div>
                <div className="si-d93f66e1">
                  {t('consultations.actionLog.by')} <strong>{log.userName || t('consultations.actionLog.system')}</strong>
                  {log.details?.role && <span> ({log.details.role})</span>}
                  {' · '}
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                </div>
                {log.action === 'BOOKING_RESCHEDULED' && log.details && (
                  <div className="si-e4117c98">
                    {t('consultations.actionLog.newSlot')} {log.details.newDate} {formatSlotTime(log.details.newTimeSlotStart)}-{formatSlotTime(log.details.newTimeSlotEnd)}
                    {log.details.newStatus === 'pending' && (
                      // Check if a subsequent confirmation exists in the log
                      actionLogs.some((l, j) => j > idx && l.action === 'BOOKING_CONFIRMED')
                        ? <span className="si-487e8582"> {t('consultations.actionLog.approved')}</span>
                        : <span className="si-cdb09cc1"> {t('consultations.actionLog.awaitingApproval')}</span>
                    )}
                    {log.details.newStatus === 'confirmed' && <span className="si-487e8582"> {t('consultations.actionLog.autoConfirmed')}</span>}
                  </div>
                )}
                {log.action === 'BOOKING_CANCELLED' && (
                  <div className="si-9e7b17f4">
                    {log.details?.cancelledByRole && <span>{t('consultations.actionLog.cancelledBy', { role: log.details.cancelledByRole })} </span>}
                    {log.details?.reason && <span>{t('consultations.actionLog.reason', { reason: log.details.reason })}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="si-87877f89">
        <button type="button" className="btn-small si-71810deb" onClick={onClose}>{t('consultations.actionLog.close')}</button>
      </div>
    </div>
  </div>
)

export default ActionLogModal
