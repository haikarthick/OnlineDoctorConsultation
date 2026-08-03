import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import type { VetHospital, HospitalDepartment, HospitalDoctor, HospitalService, HospitalDocument } from '../types'
import { DOC_LABELS } from '../types'
import './ModulePage.css'
import './VetHospitals.css'
import { useSettings } from '../context/SettingsContext'
import { useTranslation } from 'react-i18next'

type Tab = 'overview' | 'departments' | 'doctors' | 'services'

const HOSPITAL_TYPE_LABELS: Record<string, string> = {
  clinic:           'General Practice',
  emergency_center: 'Emergency & Trauma',
  specialty:        'Specialty',
  multi_specialty:  'Multi-Specialty',
  teaching:         'Teaching Hospital',
  research:         'Research Centre',
  mobile_vet:       'Mobile Unit',
  other:            'Other / Shelter Clinic',
}

const StarRating: React.FC<{ value: number }> = ({ value }) => (
  <span className="star-row">
    {[1,2,3,4,5].map(i => <span key={i} className={i <= Math.round(value) ? 'star filled' : 'star'}>★</span>)}
    <span className="star-num">({value.toFixed(1)})</span>
  </span>
)

const VetHospitalProfile: React.FC = () => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()

  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [hospital, setHospital] = useState<VetHospital | null>(null)
  const [departments, setDepartments] = useState<HospitalDepartment[]>([])
  const [doctors, setDoctors] = useState<HospitalDoctor[]>([])
  const [services, setServices] = useState<HospitalService[]>([])
  const [documents, setDocuments] = useState<HospitalDocument[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('')

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const [h, depts, docs, svcs, hdocs] = await Promise.all([
          vetHospitalApi.getHospital(id),
          vetHospitalApi.listDepartments(id),
          vetHospitalApi.listDoctors(id),
          vetHospitalApi.listServices(id),
          vetHospitalApi.listDocuments(id).catch(() => []),
        ])
        setHospital(h); setDepartments(depts); setDoctors(docs); setServices(svcs)
        setDocuments(hdocs)
      } catch { navigate('/vet-hospitals', { replace: true }) }
      finally { setLoading(false) }
    }
    load()
  }, [id, navigate])

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!hospital) return null

  const isOwner = user && (doctors.find(d => d.doctorId === user.id)?.hospitalRole === 'owner')
  const isAdmin = user?.role === 'admin'
  const canManage = isOwner || isAdmin

  const filteredDoctors = deptFilter
    ? doctors.filter(d => d.departmentId === deptFilter)
    : doctors

  const servicesByCategory = services.reduce<Record<string, HospitalService[]>>((acc, svc) => {
    const cat = svc.category || 'General';
    (acc[cat] = acc[cat] || []).push(svc)
    return acc
  }, {})

  return (
    <div className="module-page">
      {/* Breadcrumb */}
      <div className="si-388fca1e">
        <Link to="/vet-hospitals" className="si-c6f6f2cf">Vet Hospitals</Link>
        {' › '}<span>{hospital.name}</span>
      </div>

      {/* Hero */}
      <div className="vh-hero">
        <div className="vh-hero-cover" style={hospital.coverImageUrl ? { backgroundImage: `url(${hospital.coverImageUrl})`, backgroundSize: 'cover' } : {}} />
        <div className="vh-hero-logo-row">
          {hospital.logoUrl
            ? <img src={hospital.logoUrl} alt={hospital.name} className="vh-hero-logo" />
            : <div className="vh-hero-logo si-1f8b6373">🏥</div>}
          <div className="vh-hero-info">
            <div className="si-5fff49c6">
              <h1 className="si-bdeee872">{hospital.name}</h1>
              {hospital.isVerified && <span className="badge badge-verified">✓ Verified</span>}
              {hospital.hasEmergency && <span className="badge badge-emergency">⚡ Emergency</span>}
              {hospital.is24Hours && <span className="badge badge-24h">24/7</span>}
            </div>
            <div className="vh-hero-meta si-0c8f2772">
              <span>{HOSPITAL_TYPE_LABELS[hospital.hospitalType] || hospital.hospitalType}</span>
              {hospital.city && <span>📍 {hospital.city}{hospital.state ? `, ${hospital.state}` : ''}</span>}
              {hospital.rating > 0 && <StarRating value={hospital.rating} />}
            </div>
          </div>
        </div>
        <div className="vh-hero-actions">
          <button className="btn-primary si-f3347717" onClick={() => navigate(`/vet-hospitals/${id}/book`)}>📅 {t('common.submit')}</button>
          {hospital.phone && <a href={`tel:${hospital.phone}`} className="btn-secondary si-5e3b8f7d">📞 Call</a>}
          {hospital.email && <a href={`mailto:${hospital.email}`} className="btn-secondary si-5e3b8f7d">✉ Email</a>}
          {canManage && <button className="btn-secondary" onClick={() => navigate(`/vet-hospitals/manage`)}>⚙ Manage</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="vh-profile-tabs">
        {(['overview','departments','doctors','services'] as Tab[]).map(t => (
          <button key={t} className={`vh-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'overview' ? '📋 Overview' : t === 'departments' ? '🏢 Departments' : t === 'doctors' ? '👨‍⚕️ Doctors' : '💊 Services'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {hospital.description && (
            <div className="card si-78c26469">
              <h3 className="si-33c1a83e">About</h3>
              <p className="si-744cc668">{hospital.description}</p>
            </div>
          )}
          <div className="si-2c1b7c31">
            {[
              { label: 'Total Doctors', value: (hospital as any).totalDoctors ?? doctors.length, icon: '👨‍⚕️' },
              { label: 'Departments', value: departments.length, icon: '🏢' },
              { label: 'Services', value: services.length, icon: '💊' },
              { label: 'Reviews', value: hospital.totalReviews, icon: '💬' },
            ].map(s => (
              <div key={s.label} className="vh-stat-card">
                <div className="si-25a9f042">{s.icon}</div>
                <div className="vh-stat-value">{s.value}</div>
                <div className="vh-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          {hospital.facilities && hospital.facilities.length > 0 && (
            <div className="card si-78c26469">
              <h3 className="si-33c1a83e">Facilities</h3>
              <div className="hcard-chips">
                {hospital.facilities.map(f => <span key={f} className="chip">{f}</span>)}
              </div>
            </div>
          )}
          {hospital.specializations && hospital.specializations.length > 0 && (
            <div className="card si-78c26469">
              <h3 className="si-33c1a83e">Specializations</h3>
              <div className="hcard-chips">
                {hospital.specializations.map(s => <span key={s} className="chip">{s}</span>)}
              </div>
            </div>
          )}
          {/* Contact Info */}
          <div className="card si-78c26469">
            <h3 className="si-33c1a83e">Contact & Hours</h3>
            <div className="si-12a8fecb">
              {hospital.phone && <div>📞 {hospital.phone}</div>}
              {(hospital as any).emergencyPhone && <div>🚨 {(hospital as any).emergencyPhone}</div>}
              {hospital.email && <div>✉ {hospital.email}</div>}
              {hospital.website && <div>🌐 <a href={hospital.website} rel="noopener noreferrer">{hospital.website}</a></div>}
              {hospital.address && <div>📍 {hospital.address}{hospital.city ? `, ${hospital.city}` : ''}</div>}
              {hospital.establishedYear && <div>🏛 Est. {hospital.establishedYear}</div>}
            </div>
          </div>

          {/* Trust & Verification section - always visible to public */}
          <div className="card trust-section">
            <div className="trust-header">
              <h3 className="si-44087c4b">🛡 Trust & Verification</h3>
              {hospital.isVerified
                ? <span className="trust-verified-badge">✓ VetCare Verified</span>
                : <span className="trust-pending-badge">⏳ Verification Pending</span>}
            </div>
            {hospital.isVerified ? (
              <>
                <p className="trust-desc">
                  This hospital has been independently verified by VetCare. All compliance documents
                  have been reviewed and approved by our team - so you can be confident this is a
                  legitimate, licensed facility.
                </p>
                <div className="trust-docs-grid">
                  {documents.filter(d => d.status === 'approved').map(d => (
                    <div key={d.docType} className="trust-doc-chip">
                      <span>✓</span>
                      <span>{DOC_LABELS[d.docType]} Verified</span>
                    </div>
                  ))}
                </div>
                <div className="trust-footer">
                  Last verified by VetCare admin team
                </div>
              </>
            ) : (
              <p className="trust-desc pending">
                This hospital's compliance documents are currently being reviewed by the VetCare team.
                Verification is typically completed within 2-3 business days.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div>
          <h3>Departments ({departments.length})</h3>
          {departments.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">🏢</div><p>No departments listed yet</p></div>
            : <div className="vh-dept-grid">
                {departments.map(dept => (
                  <div key={dept.id} className="vh-dept-card">
                    <div className="vh-dept-name">{dept.name}</div>
                    {dept.code && <div className="si-3b29138a">Code: {dept.code}</div>}
                    {dept.description && <div className="si-ed473f7c">{dept.description}</div>}
                    {dept.specializations && dept.specializations.length > 0 && (
                      <div className="hcard-chips">
                        {dept.specializations.map(s => <span key={s} className="chip">{s}</span>)}
                      </div>
                    )}
                    <div className="si-d8a56e10">
                      {doctors.filter(d => d.departmentId === dept.id).length} doctors
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}

      {/* Doctors Tab */}
      {activeTab === 'doctors' && (
        <div>
          <div className="si-a7521a1e">
            <h3 className="si-44087c4b">Doctors ({doctors.length})</h3>
            {departments.length > 0 && (
              <select className="vh-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>
          {filteredDoctors.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">👨‍⚕️</div><p>No doctors in this selection</p></div>
            : <div className="vh-doctor-grid">
                {filteredDoctors.map(doc => (
                  <div key={doc.id} className="vh-doctor-card">
                    <div className="vh-doctor-name">{doc.doctorName || `Doctor ${doc.doctorId.slice(0,6)}`}</div>
                    <div className="vh-doctor-role">{doc.hospitalRole?.replace(/_/g, ' ')}</div>
                    {doc.title && <div className="si-de1781c0">{doc.title}</div>}
                    {doc.departmentId && <div className="vh-doctor-dept">{departments.find(d => d.id === doc.departmentId)?.name}</div>}
                    {doc.employmentType && <div className="si-bea662e8">{doc.employmentType.replace(/_/g,'  ')}</div>}
                    {doc.consultationFee && <div className="si-e4b7e858">{formatCurrency(doc.consultationFee)}</div>}
                    {doc.isAcceptingPatients !== undefined && (
                      <div style={{ fontSize: '.78rem', color: doc.isAcceptingPatients ? '#059669' : '#dc2626' }}>
                        {doc.isAcceptingPatients ? '✓ Accepting patients' : '✗ Not accepting'}
                      </div>
                    )}
                  </div>
                ))}
              </div>}
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div>
          <h3>Services ({services.length})</h3>
          {services.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">💊</div><p>No services listed yet</p></div>
            : Object.entries(servicesByCategory).map(([cat, svcs]) => (
                <div key={cat} className="si-1e52b2bd">
                  <h4 className="si-abefaece">{cat}</h4>
                  <div className="vh-services-grid">
                    {svcs.map(svc => (
                      <div key={svc.id} className="vh-service-card">
                        <div className="vh-service-cat">{svc.category}</div>
                        <div className="vh-service-name">{svc.serviceName}</div>
                        {svc.description && <div className="si-6ca2ab31">{svc.description}</div>}
                        {(svc.priceMin || svc.priceMax) && (
                          <div className="vh-service-price">
                            {svc.priceMin && svc.priceMax && svc.priceMin !== svc.priceMax
                              ? `${formatCurrency(svc.priceMin)} - ${formatCurrency(svc.priceMax)}`
                              : `${formatCurrency(svc.priceMin || svc.priceMax || 0)}`}
                          </div>
                        )}
                        {svc.durationMinutes && <div className="vh-service-duration">⏱ {svc.durationMinutes} min</div>}
                        {svc.requiresAppointment && <div className="si-8401e4d8">📅 By appointment</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}

export default VetHospitalProfile
