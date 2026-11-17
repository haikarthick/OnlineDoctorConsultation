import React from 'react'
import type { TFunction } from 'i18next'

export interface PatientTransfersPanelProps {
  transfers: any[]
  speciesLabel: (species: string | undefined, t: TFunction) => string
  onComplete: (transfer: any) => void
  t: TFunction
}

const PatientTransfersPanel: React.FC<PatientTransfersPanelProps> = ({ transfers, speciesLabel, onComplete, t }) => {
  return (
    <div className="module-card hn-transfers-card">
      <div className="card-header">
        <h3>🔄 {t('hospitalNetworks.transfers.title')}</h3>
      </div>
      <div className="card-body">
        {transfers.length === 0 ? (
          <p className="hn-panel-empty">{t('hospitalNetworks.transfers.noTransfers')}</p>
        ) : (
          <div className="data-table-container">
            <table className="module-table">
              <thead>
                <tr>
                  <th>{t('hospitalNetworks.transfers.patient')}</th>
                  <th>{t('hospitalNetworks.transfers.from')}</th>
                  <th>{t('hospitalNetworks.transfers.to')}</th>
                  <th>{t('hospitalNetworks.transfers.reason')}</th>
                  <th>{t('hospitalNetworks.transfers.status')}</th>
                  <th>{t('hospitalNetworks.transfers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t_item: any) => (
                  <tr key={t_item.id}>
                    <td>{t_item.animalName} ({speciesLabel(t_item.animalSpecies, t)})</td>
                    <td>{t_item.fromHospitalName}</td>
                    <td>{t_item.toHospitalName}</td>
                    <td>{t_item.reason}</td>
                    <td>
                      <span className={`module-badge ${t_item.status === 'completed' ? 'badge-success' : 'badge-pending'}`}>
                        {t_item.status}
                      </span>
                    </td>
                    <td>
                      {t_item.status === 'accepted' && (
                        <button className="module-btn small" onClick={() => onComplete(t_item)}>
                          ✅ {t('hospitalNetworks.transfers.complete')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default PatientTransfersPanel
