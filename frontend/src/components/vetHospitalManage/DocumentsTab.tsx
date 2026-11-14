import React from 'react'
import type { HospitalDocument } from '../../types'
import { DOC_LABELS, REQUIRED_DOC_TYPES, EXPIRY_DOC_TYPES } from '../../types'
import type { DocType } from '../../types/hospital'

interface Props {
  userRole: string | undefined
  documents: HospitalDocument[]
  docUploading: Record<string, boolean>
  docError: Record<string, string>
  expiryDates: Record<string, string>
  fileInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  onExpiryChange: (docType: DocType, value: string) => void
  onFileSelected: (docType: DocType, file: File) => Promise<void>
  onViewDoc: (url: string, name: string) => void
  onSetReviewForm: (docId: string, status: 'approved' | 'rejected') => void
}

const DocumentsTab: React.FC<Props> = ({ userRole, documents, docUploading, docError, expiryDates, fileInputRefs, onExpiryChange, onFileSelected, onViewDoc, onSetReviewForm }) => (
  <div className="doc-tab-root">
    <div className="doc-tab-header">
      <div>
        <h3 className="si-44087c4b">Compliance Documents</h3>
        <p className="si-47869ba9">
          Upload all required documents. Hospitals are only activated after admin verification.
        </p>
      </div>
      <div className="doc-progress-pill">
        {documents.filter(d => d.status === 'approved').length} / {REQUIRED_DOC_TYPES.length} approved
      </div>
    </div>

    <div className="doc-cards-grid">
      {REQUIRED_DOC_TYPES.map(dt => {
        const existing = documents.find(d => d.docType === dt)
        const needsExpiry = EXPIRY_DOC_TYPES.includes(dt)
        const isUploading = docUploading[dt] || false
        const errMsg = docError[dt] || ''

        return (
          <div key={dt} className={`doc-card${existing ? ` doc-status-${existing.status}` : ' doc-status-missing'}`}>
            <div className="doc-card-top">
              <div>
                <div className="doc-type-label">{DOC_LABELS[dt]}</div>
                {needsExpiry && <div className="doc-expiry-hint">Expiry date required</div>}
              </div>
              <span className={`doc-status-badge ${existing ? existing.status : 'missing'}`}>
                {existing ? (
                  existing.status === 'pending_review' ? '⏳ Pending Review'
                  : existing.status === 'approved' ? '✓ Approved'
                  : '✗ Rejected'
                ) : '⬆ Not Uploaded'}
              </span>
            </div>

            {existing && (
              <div className="doc-file-info">
                <span className="doc-file-icon">📄</span>
                <span className="doc-file-name">{existing.fileName}</span>
                {existing.expiryDate && (
                  <span className={`doc-expiry-tag ${new Date(existing.expiryDate) < new Date() ? 'expired' : ''}`}>
                    Exp: {new Date(existing.expiryDate).toLocaleDateString('en-IN')}
                  </span>
                )}
                <button
                  type="button"
                  className="doc-view-link si-4fac113b"
                  onClick={() => onViewDoc(existing.fileUrl, existing.fileName)}
                >View</button>
              </div>
            )}

            {existing?.rejectionReason && (
              <div className="doc-rejection-reason">
                <strong>Rejection reason:</strong> {existing.rejectionReason}
              </div>
            )}

            {existing?.reviewerName && existing.status !== 'pending_review' && (
              <div className="doc-reviewer">
                {existing.status === 'approved' ? '✓' : '✗'} Reviewed by {existing.reviewerName}
              </div>
            )}

            {/* Upload / Re-upload (owner or vet) */}
            {userRole !== 'admin' && existing?.status !== 'approved' && (
              <div className="doc-upload-area">
                {needsExpiry && (
                  <div className="form-group si-882b1663">
                    <label className="si-168b6e99">Expiry Date</label>
                    <input
                      type="date"
                      className="doc-expiry-input"
                      value={expiryDates[dt] || ''}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => onExpiryChange(dt, e.target.value)}
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  ref={el => { fileInputRefs.current[dt] = el }}
                  className="si-d6a2f871"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    await onFileSelected(dt, file)
                    if (fileInputRefs.current[dt]) fileInputRefs.current[dt]!.value = ''
                  }}
                />
                <button
                  className="btn-upload-doc"
                  disabled={isUploading}
                  onClick={() => fileInputRefs.current[dt]?.click()}
                >
                  {isUploading ? 'Uploading…' : existing ? 'Re-upload' : 'Upload Document'}
                </button>
                {errMsg && <div className="doc-err-msg">{errMsg}</div>}
              </div>
            )}

            {/* Admin review buttons */}
            {userRole === 'admin' && existing && existing.status === 'pending_review' && (
              <div className="doc-admin-review">
                <button
                  className="btn-approve-doc"
                  onClick={() => onSetReviewForm(existing.id, 'approved')}
                >
                  ✓ Approve
                </button>
                <button
                  className="btn-reject-doc"
                  onClick={() => onSetReviewForm(existing.id, 'rejected')}
                >
                  ✗ Reject
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>

    {/* Admin pending review summary */}
    {userRole === 'admin' && (
      <div className="doc-admin-summary card">
        <h4 className="si-33c1a83e">Admin Actions</h4>
        <p className="si-936796c2">
          Review each document above. When all 7 documents are approved, the hospital will be automatically activated.
        </p>
        <div className="doc-admin-counts">
          <span className="dac-item approved">{documents.filter(d => d.status === 'approved').length} Approved</span>
          <span className="dac-item pending">{documents.filter(d => d.status === 'pending_review').length} Pending</span>
          <span className="dac-item rejected">{documents.filter(d => d.status === 'rejected').length} Rejected</span>
          <span className="dac-item missing">{REQUIRED_DOC_TYPES.length - documents.length} Not Uploaded</span>
        </div>
      </div>
    )}
  </div>
)

export default DocumentsTab
