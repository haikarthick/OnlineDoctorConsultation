import React from 'react'
import { TFunction } from 'i18next'

interface Props {
  t: TFunction
  isVet: boolean
  isAdmin: boolean
  certsLoading: boolean
  certificates: any[]
  formatDate: (d: string) => string
}

const CertificatesTab: React.FC<Props> = ({ t, isVet, isAdmin, certsLoading, certificates, formatDate }) => (
  <div>
    {certsLoading ? (
      <div className="si-86638a30"><div className="loading-spinner si-8d6ac58b" /></div>
    ) : certificates.length === 0 ? (
      <div className="si-b409cd9b">
        <div className="si-fc4388e2">📜</div>
        <p>{t('certificates.noCertificates')}</p>
        {(isVet || isAdmin) && (
          <button className="module-btn primary" onClick={() => window.location.href = '/doctor/certificates/new'}>
            + {t('certificates.issue')}
          </button>
        )}
      </div>
    ) : (
      <div>
        {(isVet || isAdmin) && (
          <div className="si-bab8e8bc">
            <button className="module-btn primary" onClick={() => window.location.href = '/doctor/certificates/new'}>
              + {t('certificates.issue')}
            </button>
          </div>
        )}
        <div className="data-table-container">
          <table className="module-table">
            <thead>
              <tr>
                <th>{t('certificates.certificateNumber')}</th>
                <th>{t('certificates.type')}</th>
                <th>{t('certificates.issuedOn')}</th>
                <th>{t('certificates.validUntil')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert: any) => (
                <tr key={cert.id}>
                  <td className="si-19925664">{cert.certificateNumber || cert.certificate_number}</td>
                  <td>{cert.certificateType || cert.certificate_type}</td>
                  <td>{formatDate(cert.issuedDate || cert.issued_date || cert.createdAt || cert.created_at)}</td>
                  <td>{cert.validUntil || cert.valid_until ? formatDate(cert.validUntil || cert.valid_until) : '-'}</td>
                  <td><span className={`module-badge badge-${cert.status}`}>{cert.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
)

export default CertificatesTab
