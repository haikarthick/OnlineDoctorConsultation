import React from 'react'

interface Props {
  docViewModal: { url: string; name: string } | null
  onClose: () => void
}

const DocViewerModal: React.FC<Props> = ({ docViewModal, onClose }) => {
  if (!docViewModal) return null
  return (
    <div className="si-9c6164ca" onClick={onClose}>
      <div className="si-56d8d394" onClick={e => e.stopPropagation()}>
        <div className="si-95e025b0">
          <h3 className="si-36330245">📄 {docViewModal.name}</h3>
          <button onClick={onClose} className="si-06279df8">✕</button>
        </div>
        <div className="si-c9793de6">
          {/\.(jpe?g|png|gif|webp|svg)$/i.test(docViewModal.name)
            ? <img src={docViewModal.url} alt={docViewModal.name} className="si-e8617b4e" />
            : <iframe src={docViewModal.url} title={docViewModal.name} className="si-066874ad" />
          }
        </div>
      </div>
    </div>
  )
}

export default DocViewerModal
