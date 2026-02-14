import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './ModulePage.css'

const Settings: React.FC = () => {
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
    alert('Settings saved! (This is a demo)')
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>⚙️ Settings</h1>
      </div>

      <div className="module-content">
        <div className="settings-container">
          <div className="settings-section">
            <h2>Profile Information</h2>
            <div className="settings-form">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="First name"
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Last name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  disabled
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </div>
              <button className="btn-primary" onClick={handleSave}>Save Changes</button>
            </div>
          </div>

          <div className="settings-section">
            <h2>Preferences</h2>
            <div className="preferences-list">
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>Email notifications for appointments</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>SMS reminders for consultations</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" />
                <span>Marketing emails and offers</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>Share health data with doctors</span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h2>Security</h2>
            <div className="security-list">
              <div className="security-item">
                <h4>Change Password</h4>
                <p>Update your password regularly for better security</p>
                <button className="btn-small">Change Password</button>
              </div>
              <div className="security-item">
                <h4>Two-Factor Authentication</h4>
                <p>Add an extra layer of security to your account</p>
                <button className="btn-small">Enable 2FA</button>
              </div>
              <div className="security-item">
                <h4>Active Sessions</h4>
                <p>Manage your active login sessions</p>
                <button className="btn-small">View Sessions</button>
              </div>
            </div>
          </div>

          <div className="settings-section danger-zone">
            <h2>Danger Zone</h2>
            <div className="danger-item">
              <h4>Delete Account</h4>
              <p>Permanently delete your account and all associated data</p>
              <button className="btn-danger">Delete Account</button>
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
