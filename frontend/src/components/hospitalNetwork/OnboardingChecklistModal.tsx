import React from 'react'
import { HospitalNetwork } from './hospitalNetworksShared'

export interface OnboardingChecklistModalProps {
  onboardingNetwork: HospitalNetwork
  onClose: () => void
  onDismiss: (network: HospitalNetwork) => void
  t: (key: string) => string
}

const OnboardingChecklistModal: React.FC<OnboardingChecklistModalProps> = ({ onboardingNetwork, onClose, onDismiss, t }) => {
  const items = [
    { id: 'details', label: t('hospitalNetworks.onboarding.networkDetails'), done: true },
    { id: 'branch', label: t('hospitalNetworks.onboarding.addBranch'), done: false },
    { id: 'director', label: t('hospitalNetworks.onboarding.assignDirector'), done: false },
    { id: 'staff', label: t('hospitalNetworks.onboarding.inviteStaff'), done: false },
    { id: 'compliance', label: t('hospitalNetworks.onboarding.complianceOfficer'), done: false },
  ]

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal si-63396e81" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h3>🚀 {t('hospitalNetworks.onboarding.title')}</h3>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="hn-modal-body">
          <p className="si-57baef54">{t('hospitalNetworks.onboarding.subtitle')}</p>
          {items.map(item => (
            <div key={item.id} className="si-2c2ebf39">
              <span className="si-7ff2b341">{item.done ? '✅' : '⬜'}</span>
              <span className={`hn-onboarding-item-label${item.done ? ' is-done' : ''}`}>{item.label}</span>
            </div>
          ))}
          <div className="si-b32ecabd">
            <button className="module-btn primary" onClick={() => onDismiss(onboardingNetwork)}>
              🏗️ {t('hospitalNetworks.onboarding.dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingChecklistModal
