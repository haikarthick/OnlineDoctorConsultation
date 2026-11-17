import React from 'react'
import type { TFunction } from 'i18next'

interface ImportResults { created: number; failed: number; errors: string[] }

interface Props {
  onClose: () => void
  t: TFunction
  csvInputRef: React.RefObject<HTMLInputElement>
  handleCSVFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  downloadTemplate: () => void
  importError: string
  importPreview: any[]
  setImportPreview: (rows: any[]) => void
  importResults: ImportResults | null
  importLoading: boolean
  handleBulkImport: () => void
  speciesLabel: (species: string | undefined, t: TFunction) => string
}

const BulkImportModal: React.FC<Props> = ({
  onClose, t, csvInputRef, handleCSVFile, downloadTemplate, importError, importPreview,
  setImportPreview, importResults, importLoading, handleBulkImport, speciesLabel
}) => (
  <div className="edit-form-overlay" onClick={onClose}>
    <div className="edit-form-panel edit-form-modal si-be8d250d" onClick={e => e.stopPropagation()}>
      <button className="edit-form-close" onClick={onClose} aria-label="Close">✕</button>
      <h2>📥 {t('animals.bulkImport')}</h2>
      <p className="si-31e8dd17">{t('animals.csvHeaders')}</p>

      {importError && (
        <div className="si-c4c55552">{importError}</div>
      )}

      {!importResults && (
        <>
          <input ref={csvInputRef} type="file" accept=".csv" className="si-d6a2f871" onChange={handleCSVFile} />
          <div className="si-6e782388">
            <button className="btn-primary" onClick={() => csvInputRef.current?.click()}>
              📂 {t('animals.importCSV')}
            </button>
            <button className="btn-small" onClick={downloadTemplate}>⬇️ {t('animals.downloadTemplate')}</button>
          </div>
          <p className="si-c3b93ebb">{t('animals.maxAnimals')}</p>
        </>
      )}

      {importPreview.length > 0 && !importResults && (
        <>
          <h4 className="si-24d15068">{t('animals.importPreview')} ({importPreview.length} {t('animals.animalsCount')})</h4>
          <div className="data-table-container si-b7791771">
            <table className="module-table">
              <thead>
                <tr>
                  <th>{t('animals.registerModal.name')}</th>
                  <th>{t('animals.registerModal.species')}</th>
                  <th>{t('animals.registerModal.breed')}</th>
                  <th>{t('animals.registerModal.gender')}</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    <td>{row.name}</td>
                    <td>{speciesLabel(row.species, t)}</td>
                    <td>{row.breed || '-'}</td>
                    <td>{row.gender || '-'}</td>
                  </tr>
                ))}
                {importPreview.length > 20 && (
                  <tr><td colSpan={4} className="si-ce2b8b2e">…and {importPreview.length - 20} more</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="si-f5f9f5f6">
            <button className="btn-small" onClick={() => setImportPreview([])}>✕ Clear</button>
            <button className="btn-primary" onClick={handleBulkImport} disabled={importLoading}>
              {importLoading ? '⏳ Importing...' : `✅ Import ${importPreview.length} animals`}
            </button>
          </div>
        </>
      )}

      {importResults && (
        <div>
          <h4 className="si-5aae4571">{t('animals.importResults')}</h4>
          <div className="si-10e693aa">
            <div className="si-e3ece768">
              <div className="si-676727df">{importResults.created}</div>
              <div className="si-698e648e">{t('animals.animalsCreated')}</div>
            </div>
            <div className={`an-import-stat-box ${importResults.failed > 0 ? 'has-failures' : ''}`}>
              <div className={`an-import-stat-value ${importResults.failed > 0 ? 'has-failures' : ''}`}>{importResults.failed}</div>
              <div className="si-3ee35c05">{t('animals.animalsFailed')}</div>
            </div>
          </div>
          {importResults.errors.length > 0 && (
            <div className="si-54785ed0">
              <strong>{t('animals.importErrors')}:</strong>
              {importResults.errors.map((e, i) => <div key={i} className="si-011cf8c3">• {e}</div>)}
            </div>
          )}
          <div className="si-3f63b982">
            <button className="btn-primary" onClick={onClose}>✓ Done</button>
          </div>
        </div>
      )}
    </div>
  </div>
)

export default BulkImportModal
