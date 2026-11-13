import React from 'react'
import { TFunction } from 'i18next'
import { certTypeLabel } from './certificateWriterShared'

interface Animal { id: string; name: string; species: string; breed?: string; uniqueId?: string }
interface Owner { id: string; name: string; email: string }
interface Group { id: string; name: string }

interface Step3ReviewProps {
  t: TFunction
  certType: string
  selectedGroupId: string
  selectedGroup: Group | null
  animals: Animal[]
  selectedAnimalId: string
  selectedOwnerId: string
  selectedOwner: Owner | null
  examinationDate: string
  validUntil: string
  formatDate: (d: string) => string
  handlePreview: () => void
  submitting: boolean
  setStep: (s: number) => void
  handleSaveDraft: () => void
  handleIssue: () => void
  isHerd: boolean
  isGroupCapable: boolean
}

const Step3Review: React.FC<Step3ReviewProps> = ({
  t, certType, selectedGroupId, selectedGroup, animals, selectedAnimalId, selectedOwnerId, selectedOwner,
  examinationDate, validUntil, formatDate, handlePreview, submitting, setStep,
  handleSaveDraft, handleIssue, isHerd, isGroupCapable,
}) => (
  <div className="module-card cw-card">
    <h3 className="cw-step-title">3. {t('certificateWriter.step3')}</h3>

    {/* Review summary */}
    <div className="cw-review-summary">
      <div className="cw-review-grid">
        <div>
          <div className="cw-review-label">{t('certificateWriter.reviewCertType')}</div>
          <div className="cw-review-value">{certTypeLabel(t, certType)}</div>
        </div>
        <div>
          <div className="cw-review-label">{selectedGroupId ? t('certificateWriter.reviewGroup') : t('certificateWriter.reviewAnimal')}</div>
          <div className="cw-review-value">{selectedGroupId ? (selectedGroup?.name || selectedGroupId) : (animals.find(a => a.id === selectedAnimalId)?.name || '-')}</div>
        </div>
        <div>
          <div className="cw-review-label">{t('certificateWriter.reviewOwner')}</div>
          <div className="cw-review-value">{selectedOwner?.name || '-'}</div>
        </div>
        <div>
          <div className="cw-review-label">{t('certificateWriter.reviewExamDate')}</div>
          <div className="cw-review-value">{examinationDate ? formatDate(examinationDate) : '-'}</div>
        </div>
        <div>
          <div className="cw-review-label">{t('certificateWriter.reviewValidUntil')}</div>
          <div className="cw-review-value">{validUntil ? formatDate(validUntil) : t('certificateWriter.reviewNoExpiry')}</div>
        </div>
      </div>
    </div>

    <div className="cw-preview-bar">
      <button className="module-btn" onClick={handlePreview}>
        👁 {t('certificateWriter.preview')}
      </button>
    </div>

    <div className="cw-warning-note">
      <strong>⚠ {t('certificateWriter.issueNotePrefix')}:</strong>{' '}
      {t('certificateWriter.issueNoteText')}
    </div>

    <div className="cw-actions">
      <button className="module-btn" onClick={() => setStep(2)} disabled={submitting}>
        ← {t('certificateWriter.back')}
      </button>
      <div className="cw-actions-right">
        <button className="module-btn" onClick={handleSaveDraft} disabled={submitting}>
          {submitting ? t('common.saving') : `💾 ${t('certificateWriter.saveDraft')}`}
        </button>
        <button
          className="module-btn primary"
          onClick={handleIssue}
          disabled={submitting || !certType || (!isHerd && !isGroupCapable && !selectedAnimalId) || (isGroupCapable && !selectedAnimalId && !selectedGroupId) || !selectedOwnerId}
        >
          {submitting ? t('common.saving') : `✅ ${t('certificateWriter.issueNow')}`}
        </button>
      </div>
    </div>
  </div>
)

export default Step3Review
