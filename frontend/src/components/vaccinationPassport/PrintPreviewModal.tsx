interface PrintPreviewModalProps {
  printHtml: string | null
  onClose: () => void
  t: (k: string, opts?: any) => string
}

export function PrintPreviewModal({ printHtml, onClose, t }: PrintPreviewModalProps) {
  if (!printHtml) return null
  return (
    <div className="vp-print-overlay" onClick={onClose}>
      <div className="vp-print-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vp-print-modal-header">
          <span>{t('vaccinationPassport.passportPreview')}</span>
          <div className="vp-print-modal-actions">
            <button
              className="module-btn primary small"
              onClick={() => {
                const iframe = document.getElementById('vp-print-iframe') as HTMLIFrameElement
                if (iframe?.contentWindow) {
                  iframe.contentWindow.focus()
                  iframe.contentWindow.print()
                }
              }}
            >
              🖨️ {t('vaccinationPassport.printSavePdf')}
            </button>
            <button className="module-btn small" onClick={onClose}>✕</button>
          </div>
        </div>
        <iframe
          id="vp-print-iframe"
          className="vp-print-iframe"
          srcDoc={printHtml}
          title="Vaccination Passport"
        />
      </div>
    </div>
  )
}
