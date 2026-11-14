import React from 'react'
import type { TFunction } from 'i18next'

export interface ReferralsTableProps {
  referralDirection: 'incoming' | 'outgoing' | 'all'
  onChangeDirection: (dir: 'incoming' | 'outgoing' | 'all') => void
  referralsLoading: boolean
  referrals: any[]
  speciesLabel: (species: string | undefined, t: TFunction) => string
  onAccept: (referral: any) => void
  onReject: (referral: any) => void
  t: TFunction
}

const ReferralsTable: React.FC<ReferralsTableProps> = ({
  referralDirection, onChangeDirection, referralsLoading, referrals, speciesLabel, onAccept, onReject, t,
}) => {
  return (
    <>
      {/* Direction sub-tabs */}
      <div className="module-tabs si-478be2e9">
        {(['incoming', 'outgoing', 'all'] as const).map(dir => (
          <button
            key={dir}
            className={`module-tab${referralDirection === dir ? ' active' : ''}`}
            onClick={() => onChangeDirection(dir)}
          >
            {dir === 'incoming' ? `📥 ${t('networkReferrals.incoming')}` :
             dir === 'outgoing' ? `📤 ${t('networkReferrals.outgoing')}` :
             `📋 ${t('networkReferrals.all')}`}
          </button>
        ))}
      </div>

      {/* Table or empty state */}
      {referralsLoading ? (
        <div className="si-78446846">⏳ {t('common.loading')}</div>
      ) : referrals.length === 0 ? (
        <div className="module-card si-86638a30">
          <div className="si-353e617d">🔄</div>
          <p className="si-651ede6d">
            {referralDirection === 'incoming' ? t('networkReferrals.noIncoming') :
             referralDirection === 'outgoing' ? t('networkReferrals.noOutgoing') :
             t('networkReferrals.noReferrals')}
          </p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="module-table">
            <thead>
              <tr>
                <th>{t('networkReferrals.animal')}</th>
                <th>{t('networkReferrals.fromHospital')}</th>
                <th>{t('networkReferrals.toHospitalLabel')}</th>
                <th>{t('networkReferrals.reason')}</th>
                <th>{t('common.status')}</th>
                <th>{t('networkReferrals.date')}</th>
                <th>{t('networkReferrals.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map(ref => (
                <tr key={ref.id}>
                  <td>
                    <strong>{ref.animalName}</strong><br />
                    <span className="si-655cd763">{speciesLabel(ref.animalSpecies, t)}</span>
                  </td>
                  <td>
                    {ref.fromHospitalName}<br />
                    <span className="si-655cd763">{ref.fromVetName}</span>
                  </td>
                  <td>
                    {ref.toHospitalName}<br />
                    <span className="si-655cd763">{ref.toVetName || '-'}</span>
                  </td>
                  <td className="si-d83d7d70">{ref.reason}</td>
                  <td>
                    <span className={`module-badge ${
                      ref.status === 'accepted' ? 'badge-success' :
                      ref.status === 'rejected' ? 'badge-error' :
                      ref.status === 'completed' ? 'badge-success' : 'badge-pending'
                    }`}>
                      {String(t(`networkReferrals.status.${ref.status}` as any, ref.status))}
                    </span>
                  </td>
                  <td className="si-0a803082">{new Date(ref.created_at || ref.createdAt).toLocaleDateString()}</td>
                  <td>
                    {ref.status === 'pending' && referralDirection !== 'outgoing' && (
                      <div className="si-9f20fe5e">
                        <button
                          className="module-btn small si-e44bed18"
                          onClick={() => onAccept(ref)}
                        >
                          ✓ {t('networkReferrals.accept')}
                        </button>
                        <button
                          className="module-btn small si-b150e41a"
                          onClick={() => onReject(ref)}
                        >
                          ✗ {t('networkReferrals.reject')}
                        </button>
                      </div>
                    )}
                    {ref.consultationId && (
                      <button
                        className="module-btn small si-f48bb60f"
                        onClick={() => window.open(`/consultation/${ref.consultationId}`, '_blank')}
                      >
                        🔗 {t('networkReferrals.viewConsultation')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default ReferralsTable
