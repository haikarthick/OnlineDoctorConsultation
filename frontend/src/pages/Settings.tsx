import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'

const Settings: React.FC = () => {
  const { t } = useTranslation()

  const { user } = useAuth()
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = () => {
    alert(t('settings.profile.saved'))
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('settings.pageTitle')}</h1>
      </div>

      <div className="module-content">
        <div className="settings-container">
          <div className="settings-section">
            <h2>{t('settings.profile.title')}</h2>
            <div className="settings-form">
              <div className="form-group">
                <label>{t('settings.profile.firstName')}</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder={t('settings.profile.firstName')}
                />
              </div>
              <div className="form-group">
                <label>{t('settings.profile.lastName')}</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder={t('settings.profile.lastName')}
                />
              </div>
              <div className="form-group">
                <label>{t('settings.profile.email')}</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={t('settings.profile.email')}
                  disabled
                />
              </div>
              <div className="form-group">
                <label>{t('settings.profile.phone')}</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={t('settings.profile.phone')}
                />
              </div>
              <button className="btn-primary" onClick={handleSave}>{t('settings.profile.saveChanges')}</button>
            </div>
          </div>

          <div className="settings-section">
            <h2>{t('settings.preferences.title')}</h2>
            <div className="preferences-list">
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>{t('settings.preferences.emailNotifications')}</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>{t('settings.preferences.smsReminders')}</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" />
                <span>{t('settings.preferences.marketingEmails')}</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>{t('settings.preferences.shareHealth')}</span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h2>{t('settings.security.title')}</h2>
            <div className="security-list">
              <div className="security-item">
                <h4>{t('settings.security.changePassword')}</h4>
                <p>{t('settings.security.changePasswordDesc')}</p>
                <button className="btn-small">{t('settings.security.changePassword')}</button>
              </div>
              <div className="security-item">
                <h4>{t('settings.security.twoFactor')}</h4>
                <p>{t('settings.security.twoFactorDesc')}</p>
                <button className="btn-small">{t('settings.security.enable2FA')}</button>
              </div>
              <div className="security-item">
                <h4>{t('settings.security.activeSessions')}</h4>
                <p>{t('settings.security.activeSessionsDesc')}</p>
                <button className="btn-small">{t('settings.security.viewSessions')}</button>
              </div>
            </div>
          </div>

          <div className="settings-section danger-zone">
            <h2>{t('settings.dangerZone.title')}</h2>
            <div className="danger-item">
              <h4>{t('settings.dangerZone.deleteAccount')}</h4>
              <p>{t('settings.dangerZone.deleteAccountDesc')}</p>
              <button className="btn-danger">{t('settings.dangerZone.deleteAccount')}</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .settings-container {
          max-width: 600px;
        }

        .settings-section {
          margin-bottom: 32px;
          padding-bottom: 32px;
          border-bottom: 1px solid #e0e0e0;
        }

        .settings-section:last-child {
          border-bottom: none;
        }

        .settings-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 16px 0;
        }

        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 600;
          font-size: 13px;
          color: #1a1a1a;
        }

        .form-group input {
          padding: 10px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input:disabled {
          background: #f5f5f5;
          color: #999;
          cursor: not-allowed;
        }

        .preferences-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preference-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 6px;
          background: #f9f9f9;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .preference-item:hover {
          background: #f0f0f0;
        }

        .preference-item input[type="checkbox"] {
          cursor: pointer;
          width: 18px;
          height: 18px;
        }

        .preference-item span {
          font-size: 14px;
          color: #1a1a1a;
        }

        .security-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .security-item {
          padding: 16px;
          background: #f9f9f9;
          border-radius: 6px;
          border-left: 4px solid #667eea;
        }

        .security-item h4 {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 4px 0;
        }

        .security-item p {
          font-size: 13px;
          color: #666;
          margin: 0 0 12px 0;
        }

        .danger-zone {
          background: #ffebee;
          padding: 16px;
          border-radius: 6px;
          border-left: 4px solid #d32f2f;
        }

        .danger-item {
          padding: 16px;
          background: white;
          border-radius: 6px;
        }

        .danger-item h4 {
          font-size: 14px;
          font-weight: 600;
          color: #d32f2f;
          margin: 0 0 4px 0;
        }

        .danger-item p {
          font-size: 13px;
          color: #666;
          margin: 0 0 12px 0;
        }

        .btn-danger {
          background: #d32f2f;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-danger:hover {
          background: #c62828;
        }

        @media (max-width: 768px) {
          .settings-container {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

export default Settings
