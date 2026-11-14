import React from 'react'
import type { TFunction } from 'i18next'
import type { HospitalDepartment, HospitalDoctor } from '../../types'

interface Props {
  t: TFunction
  doctors: HospitalDoctor[]
  departments: HospitalDepartment[]
  invites: any[]
  linkCopied: string
  onInviteNew: () => void
  onAddExisting: () => void
  onRevokeInvite: (inviteId: string) => void
  onCopyInviteLink: (url: string, id: string) => void
  onEditDoctor: (doc: HospitalDoctor) => void
  onRemoveDoctor: (doc: HospitalDoctor) => void
}

const DoctorsTab: React.FC<Props> = ({ t, doctors, departments, invites, linkCopied, onInviteNew, onAddExisting, onRevokeInvite, onCopyInviteLink, onEditDoctor, onRemoveDoctor }) => {
  const pendingInvites = invites.filter(i => i.status === 'pending')
  return (
    <div>
      <div className="si-3a656330">
        <h3 className="si-44087c4b">{t('vetHospitalManage.doctors.staff')} ({doctors.length})</h3>
        <div className="si-52c0cb1e">
          <button className="btn-secondary" onClick={onInviteNew}>✉ {t('vetHospitalManage.doctors.inviteNew')}</button>
          <button className="btn-primary" onClick={onAddExisting}>+ {t('vetHospitalManage.doctors.addExisting')}</button>
        </div>
      </div>

      {pendingInvites.length > 0 && (
        <div className="si-e4efb72b">
          <div className="si-a32532b1">📨 Pending Invitations ({pendingInvites.length})</div>
          {pendingInvites.map(inv => (
            <div key={inv.id} className="si-633e4b1e">
              <span className="si-6acd75e8">
                <strong>{inv.first_name || ''} {inv.last_name || ''}</strong> · {inv.email} · <span className="si-ecf1d5e5">{(inv.hospital_role || 'staff').replace(/_/g, ' ')}</span>
              </span>
              <span className="si-908660d1">Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
              {inv.inviteUrl && <button type="button" className="btn-secondary si-a792b2c1" onClick={() => onCopyInviteLink(inv.inviteUrl, inv.id)}>{linkCopied === inv.id ? '✓ Copied' : '📋 Copy Link'}</button>}
              <button className="btn-danger si-fb053872" onClick={() => onRevokeInvite(inv.id)}>{t('vetHospitalManage.invite.revoke')}</button>
            </div>
          ))}
        </div>
      )}
      {doctors.length === 0
        ? <div className="empty-state"><div className="empty-state-icon">👨‍⚕️</div><p>{t('vetHospitalManage.doctors.emptyState')}</p></div>
        : <div className="vh-doctor-grid">
            {doctors.map(doc => (
              <div key={doc.id} className="vh-doctor-card">
                <div className="vh-doctor-name">{doc.doctorName || `Doctor ${doc.doctorId.slice(0,6)}`}</div>
                <div className="vh-doctor-role">{doc.hospitalRole?.replace(/_/g,' ')}</div>
                {doc.title && <div className="si-de1781c0">{doc.title}</div>}
                {doc.departmentId && <div className="vh-doctor-dept">{departments.find(d => d.id === doc.departmentId)?.name || 'Dept'}</div>}
                <div className="si-12530887">
                  <span className={`vh-accepting-text${doc.isAcceptingPatients ? ' is-accepting' : ' is-not-accepting'}`}>
                    {doc.isAcceptingPatients ? `● ${t('vetHospitalManage.doctors.accepting')}` : `● ${t('vetHospitalManage.doctors.notAccepting')}`}
                  </span>
                </div>
                <div className="vh-doctor-actions">
                  <button className="btn-secondary si-aa7179fc" onClick={() => onEditDoctor(doc)}>{t('common.edit')}</button>
                  <button className="btn-danger si-aa7179fc" onClick={() => onRemoveDoctor(doc)}>{t('common.remove')}</button>
                </div>
              </div>
            ))}
          </div>}
    </div>
  )
}

export default DoctorsTab
