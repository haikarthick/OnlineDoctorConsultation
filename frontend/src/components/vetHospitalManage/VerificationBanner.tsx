import React from 'react'
import type { TFunction } from 'i18next'
import type { VetHospital } from '../../types'
import { REQUIRED_DOC_TYPES } from '../../types'
import { getVerificationStatusInfo } from './vetHospitalManageShared'

interface Props {
  t: TFunction
  hospital: VetHospital
  onManageDocuments: () => void
}

const VerificationBanner: React.FC<Props> = ({ t, hospital, onManageDocuments }) => {
  const vs = hospital.verificationStatus || 'pending_documents'
  const info = getVerificationStatusInfo(REQUIRED_DOC_TYPES.length)[vs]
  if (!info) return null
  return (
    <div className={`verification-banner ${info.className}`}>
      <span className="vstatus-badge">{info.label}</span>
      <span className="vstatus-msg">{info.msg}</span>
      {(vs === 'pending_documents' || vs === 'rejected' || vs === 'suspended') && (
        <button className="vstatus-action-btn" onClick={onManageDocuments}>{t('vetHospitalManage.manageDocuments')}</button>
      )}
    </div>
  )
}

export default VerificationBanner
