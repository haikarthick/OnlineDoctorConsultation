import React from 'react'
import type { TFunction } from 'i18next'
import MapView from '../MapView'
import { Enterprise, EnterpriseType, ENTERPRISE_TYPE_LABELS } from '../../types'

export interface EnterpriseFormData {
  name: string
  enterpriseType: EnterpriseType
  description: string
  address: string
  city: string
  state: string
  country: string
  postalCode: string
  totalArea: string
  areaUnit: string
  licenseNumber: string
  regulatoryId: string
  taxId: string
  phone: string
  email: string
  website: string
  gpsLatitude: string
  gpsLongitude: string
}

// ─── Create/edit enterprise modal — the long address/contact/location form ───
export const EnterpriseFormModal: React.FC<{
  formRef: React.RefObject<HTMLDivElement>
  editingEnterprise: Enterprise | null
  formData: EnterpriseFormData
  error: string
  t: TFunction
  onChange: (updater: (f: EnterpriseFormData) => EnterpriseFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}> = ({ formRef, editingEnterprise, formData, error, t, onChange, onSubmit, onCancel }) => {
  return (
    <>
      <div className="edit-form-overlay" onClick={onCancel} />
      <div ref={formRef} className="edit-form-panel">
        <h2>{editingEnterprise ? t('enterpriseManagement.modal.editTitle') : t('enterpriseManagement.modal.createTitle')}</h2>
        <form onSubmit={onSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="si-ec24da01">
            <div className="form-group si-06af062a">
              <label>Enterprise Name *</label>
              <input type="text" value={formData.name} onChange={e => onChange(f => ({ ...f, name: e.target.value }))} required />
            </div>

            <div className="form-group">
              <label>Enterprise Type *</label>
              <select value={formData.enterpriseType} onChange={e => onChange(f => ({ ...f, enterpriseType: e.target.value as EnterpriseType }))} required>
                <option value="">Select type...</option>
                {Object.entries(ENTERPRISE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={formData.phone} onChange={e => onChange(f => ({ ...f, phone: e.target.value }))} />
            </div>

            <div className="form-group si-06af062a">
              <label>Description</label>
              <textarea rows={2} value={formData.description} onChange={e => onChange(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="form-group si-06af062a">
              <label>Address</label>
              <input type="text" value={formData.address} onChange={e => onChange(f => ({ ...f, address: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>City</label>
              <input type="text" value={formData.city} onChange={e => onChange(f => ({ ...f, city: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>State</label>
              <input type="text" value={formData.state} onChange={e => onChange(f => ({ ...f, state: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>Country</label>
              <input type="text" value={formData.country} onChange={e => onChange(f => ({ ...f, country: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>Postal Code</label>
              <input type="text" value={formData.postalCode} onChange={e => onChange(f => ({ ...f, postalCode: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>Total Area</label>
              <div className="si-6fdaaf49">
                <input type="number" step="0.01" value={formData.totalArea} onChange={e => onChange(f => ({ ...f, totalArea: e.target.value }))} className="si-6acd75e8" />
                <select value={formData.areaUnit} onChange={e => onChange(f => ({ ...f, areaUnit: e.target.value }))} className="si-fccc6ec7">
                  <option value="acres">Acres</option>
                  <option value="hectares">Hectares</option>
                  <option value="sqft">Sq Ft</option>
                  <option value="sqm">Sq M</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <input type="email" value={formData.email} onChange={e => onChange(f => ({ ...f, email: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>License Number</label>
              <input type="text" value={formData.licenseNumber} onChange={e => onChange(f => ({ ...f, licenseNumber: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>Regulatory ID</label>
              <input type="text" value={formData.regulatoryId} onChange={e => onChange(f => ({ ...f, regulatoryId: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>Tax ID</label>
              <input type="text" value={formData.taxId} onChange={e => onChange(f => ({ ...f, taxId: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>Website</label>
              <input type="url" value={formData.website} onChange={e => onChange(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
            </div>

            <div className="form-group">
              <label>GPS Latitude</label>
              <input type="number" step="0.000001" placeholder="Click map below" value={formData.gpsLatitude} onChange={e => onChange(f => ({ ...f, gpsLatitude: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>GPS Longitude</label>
              <input type="number" step="0.000001" placeholder="Click map below" value={formData.gpsLongitude} onChange={e => onChange(f => ({ ...f, gpsLongitude: e.target.value }))} />
            </div>

            <div className="form-group si-06af062a">
              <label>📍 Set Location on Map</label>
              <div className="si-acec1d66">
                <MapView
                  height={200}
                  markers={formData.gpsLatitude && formData.gpsLongitude ? [{
                    id: 'ent-form-loc',
                    lat: +formData.gpsLatitude,
                    lng: +formData.gpsLongitude,
                    color: '#3b82f6',
                    pulse: true,
                    popup: <div><strong>{formData.name || 'Enterprise'}</strong></div>,
                  }] : []}
                  onClick={(lat, lng) => onChange(f => ({ ...f, gpsLatitude: lat.toFixed(6), gpsLongitude: lng.toFixed(6) }))}
                  center={formData.gpsLatitude && formData.gpsLongitude ? [+formData.gpsLatitude, +formData.gpsLongitude] : undefined}
                  zoom={formData.gpsLatitude ? 13 : undefined}
                />
              </div>
            </div>
          </div>

          <div className="si-9a4d96fa">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">{editingEnterprise ? 'Update' : 'Create'} Enterprise</button>
          </div>
        </form>
      </div>
    </>
  )
}
