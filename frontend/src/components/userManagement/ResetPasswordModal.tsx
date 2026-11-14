import React from 'react'
import { useTranslation } from 'react-i18next'
import PasswordInput from '../PasswordInput'
import type { User } from './userManagementShared'

interface ResetPasswordModalProps {
  showResetPasswordModal: User | null
  setShowResetPasswordModal: (u: User | null) => void
  resetPasswordMsg: string
  resetPasswordValue: string
  setResetPasswordValue: (v: string) => void
  resetPasswordSaving: boolean
  onConfirm: () => void
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  showResetPasswordModal, setShowResetPasswordModal, resetPasswordMsg, resetPasswordValue,
  setResetPasswordValue, resetPasswordSaving, onConfirm,
}) => {
  const { t } = useTranslation()
  if (!showResetPasswordModal) return null
  return (
    <div className="modal-overlay" onClick={() => setShowResetPasswordModal(null)}>
      <div className="modal si-25615047" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔒 {t('userManagement.resetPasswordTitle')} - {showResetPasswordModal.firstName} {showResetPasswordModal.lastName}</h2>
          <button className="modal-close" onClick={() => setShowResetPasswordModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          {resetPasswordMsg && <div className="module-alert success si-bab8e8bc">{resetPasswordMsg}</div>}
          <div className="form-group">
            <label className="form-label">{t('userManagement.resetPasswordLabel')} *</label>
            <PasswordInput
              className="form-input"
              value={resetPasswordValue}
              onChange={e => setResetPasswordValue(e.target.value)}
              placeholder={t('userManagement.resetPasswordMin')}
              minLength={8}
              autoComplete="new-password"
            />
            {resetPasswordValue && resetPasswordValue.length < 8 && (
              <p className="si-513c70eb">⚠️ {t('userManagement.resetPasswordMin')}</p>
            )}
          </div>
          <div className="si-f5f9f5f6">
            <button className="btn btn-outline" onClick={() => setShowResetPasswordModal(null)}>{t('userManagement.cancel')}</button>
            <button
              className="btn btn-primary"
              disabled={resetPasswordSaving || !resetPasswordValue || resetPasswordValue.length < 8}
              onClick={onConfirm}
            >
              {resetPasswordSaving ? t('userManagement.saving') : t('userManagement.resetPasswordBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordModal
