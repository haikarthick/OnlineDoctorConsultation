import type { TFunction } from 'i18next'

interface ReferralsListProps {
  referrals: any[]
  t: TFunction
  speciesLabel: (species: string, t: TFunction) => string
  onReferralAction: (id: string, status: string) => void
}

export default function ReferralsList({ referrals, t, speciesLabel, onReferralAction }: ReferralsListProps) {
  return (
    <div className="si-977f8af1">
      {referrals.length === 0 && <p className="si-d91f9779">{t('hospitalWorkflow.noReferrals')}</p>}
      {referrals.map(r => (
        <div key={r.id} className={`hw-referral-card pri-${r.priority}`}>
          <div className="si-588e32ac">
            <div className="si-aa342140">
              <div className="si-b2cfcbec">From Dr. {r.from_vet_first} {r.from_vet_last} → Dr. {r.to_vet_first} {r.to_vet_last}</div>
              <div className="si-7eadb7a8">{r.reason}</div>
              {r.specialty_needed && <div className="si-029cdd46">{t('hospitalWorkflow.specialty')}: {r.specialty_needed}</div>}
              {r.animal_name && <div className="si-db3602ae">{t('hospitalWorkflow.patient')}: {r.animal_name} ({speciesLabel(r.animal_species, t)})</div>}
            </div>
            <span className={`hw-referral-status-badge status-${r.status}`}>{r.status}</span>
            {r.status === 'pending' && (
              <div className="si-9f48dfc6">
                <button onClick={() => onReferralAction(r.id, 'accepted')} className="si-d903510c">{t('hospitalWorkflow.accept')}</button>
                <button onClick={() => onReferralAction(r.id, 'declined')} className="si-ad808723">{t('hospitalWorkflow.decline')}</button>
              </div>
            )}
            {r.status === 'accepted' && (
              <button onClick={() => onReferralAction(r.id, 'completed')} className="si-6a421f43">{t('hospitalWorkflow.complete')}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
