import React from 'react'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../../context/MasterDataContext'

/** What a consultation knows about the group it is for (GET /consultations/:id). */
export interface ConsultationGroup {
  groupId: string
  groupName?: string | null
  groupType?: string | null
  groupSpecies?: string | null
  groupManagementMode?: string | null
  groupHeadCount?: number | null
  groupEnterpriseId?: string | null
}

/** Reads the group fields off a consultation, or null when the appointment is not about a group. */
export function groupFromConsultation(c: Record<string, any> | null | undefined): ConsultationGroup | null {
  if (!c || !c.groupId) return null
  return {
    groupId: c.groupId, groupName: c.groupName, groupType: c.groupType, groupSpecies: c.groupSpecies,
    groupManagementMode: c.groupManagementMode, groupHeadCount: c.groupHeadCount, groupEnterpriseId: c.groupEnterpriseId,
  }
}

/**
 * The group at a glance for the vet: one component for every screen that shows a herd or flock a vet is working on
 * (the counterpart of SubjectSummary, which is for one animal). A group is ONE patient - one record, one prescription -
 * so the head count is shown plainly: it is the number the treatment will be recorded against.
 */
export const GroupSummary: React.FC<{ group: ConsultationGroup | null | undefined }> = ({ group }) => {
  const { t } = useTranslation()
  const { speciesLabel, speciesIcon, groupTypeLabel } = useMasterData()
  if (!group) return null
  const species = group.groupSpecies ? speciesLabel(group.groupSpecies, t) : ''
  const type = group.groupType ? groupTypeLabel(group.groupSpecies, group.groupType, t) : ''
  return (
    <section className="group-summary" aria-label={t('consultationRoom.group.title')}>
      <div className="group-summary-head">
        <span className="group-summary-icon" aria-hidden="true">{group.groupSpecies ? speciesIcon(group.groupSpecies) : '👥'}</span>
        <div className="group-summary-title">
          <strong className="group-summary-name">{group.groupName || t('consultationRoom.group.unnamed')}</strong>
          <span className="group-summary-sub">{[species, type].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      {typeof group.groupHeadCount === 'number' && (
        <p className="group-summary-count">{t('consultationRoom.group.headCount', { count: group.groupHeadCount })}</p>
      )}
      <p className="group-summary-note">{t('consultationRoom.group.oneRecord')}</p>
    </section>
  )
}
