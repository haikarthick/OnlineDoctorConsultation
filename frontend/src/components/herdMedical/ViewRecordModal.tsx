import React from 'react'
import { useTranslation } from 'react-i18next'
import { RECORD_TYPE_ICONS, severityClass } from './herdMedicalShared'

interface ViewRecordModalProps {
  record: any
  onClose: () => void
  canManage: boolean
  onArchive: () => void
  fmtDate: (d: string) => string
}

const ViewRecordModal: React.FC<ViewRecordModalProps> = ({ record, onClose, canManage, onArchive, fmtDate }) => {
  const { t } = useTranslation()
  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal" onClick={e => e.stopPropagation()}>
        <div className="si-b1549cde">
          <h2 className="si-d4411fdc">{RECORD_TYPE_ICONS[record.recordType] || ''} {t('herdMedical.modal.medicalRecord')}</h2>
          <span className={severityClass(record.severity, 'lg')}>{record.severity}</span>
        </div>
        <div className="si-4edd7f5e">
          <div><strong className="si-46cf1b09">{t('herdMedical.modal.recordNumber')}</strong><br />{record.recordNumber || 'N/A'}</div>
          <div><strong className="si-46cf1b09">{t('common.status')}</strong><br />{record.status || 'active'}</div>
          <div><strong className="si-46cf1b09">{t('common.type')}</strong><br />{record.recordType?.replace(/_/g, ' ')}</div>
          <div><strong className="si-46cf1b09">{t('herdMedical.modal.created')}</strong><br />{fmtDate(record.createdAt)}</div>
          {record.followUpDate && <div><strong className="si-46cf1b09">{t('herdMedical.modal.followUp')}</strong><br />{fmtDate(record.followUpDate)}</div>}
        </div>
        <div className="si-d4411fdc">
          <strong className="si-c8844a87">{record.title}</strong>
          <div className="si-50865e53">{record.content}</div>
        </div>
        {record.medications && record.medications.length > 0 && (
          <div className="si-d4411fdc">
            <strong className="si-46cf1b09">{t('herdMedical.modal.medications')}</strong>
            <div className="si-1e849541">
              {record.medications.map((m: any, i: number) => (
                <span key={i} className="si-3024e94b">{m.name || m}</span>
              ))}
            </div>
          </div>
        )}
        {record.tags && record.tags.length > 0 && (
          <div className="si-d4411fdc">
            <strong className="si-46cf1b09">{t('herdMedical.modal.tags')}</strong>
            <div className="si-1e849541">
              {record.tags.map((tag: string, i: number) => (
                <span key={i} className="si-37556a30">{tag}</span>
              ))}
            </div>
          </div>
        )}
        <div className="si-66181d73">
          {canManage && <button className="btn btn-secondary si-f84f41a5" onClick={onArchive}>{t('herdMedical.records.archive')}</button>}
          <button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}

export default ViewRecordModal
