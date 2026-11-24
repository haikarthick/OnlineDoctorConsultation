import React from 'react'
import { useTranslation } from 'react-i18next'
import { SubjectSummary } from '../shared/SubjectSummary'
import { RecentFarmRecords } from '../farmRecords/RecentFarmRecords'
import { GroupSummary, type ConsultationGroup } from '../shared/GroupSummary'

interface PrescribePanelProps {
  conId: string
  /** The consultation's animal, as returned by GET /animals/:id. */
  animalInfo?: any
  /** The consultation's group, when the appointment is about a whole group. */
  groupInfo?: ConsultationGroup | null
  onNavigate: (path: string) => void
}

const PrescribePanel: React.FC<PrescribePanelProps> = ({ conId, animalInfo, groupInfo, onNavigate }) => {
  const { t } = useTranslation()

  return (
    <div className="si-c710217c">
      {animalInfo && <SubjectSummary animal={animalInfo} emphasis />}
      {animalInfo && <RecentFarmRecords animalId={animalInfo.id} />}
      {!animalInfo && groupInfo && (
        <>
          <GroupSummary group={groupInfo} />
          <RecentFarmRecords groupId={groupInfo.groupId} />
        </>
      )}
      <p className="si-09dee8a9">
        {t('consultationRoom.quickPrescribeAccess')}
      </p>
      <button className="btn btn-primary"
        onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
        💊 {t('consultationRoom.openPrescriptionWriter')}
      </button>
    </div>
  )
}

export default PrescribePanel
