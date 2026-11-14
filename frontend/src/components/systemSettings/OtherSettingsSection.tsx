import React from 'react'
import { useTranslation } from 'react-i18next'
import { SystemSetting } from '../../types'

interface Props {
  loading: boolean
  filteredSettings: SystemSetting[]
  searchQuery: string
  setSearchQuery: (q: string) => void
  groupedSettings: Record<string, SystemSetting[]>
  editingKey: string | null
  setEditingKey: (k: string | null) => void
  editValue: string
  setEditValue: (v: string) => void
  saving: boolean
  onSave: (key: string) => void
  onShowAdd: () => void
}

const OtherSettingsSection: React.FC<Props> = ({
  loading, filteredSettings, searchQuery, setSearchQuery, groupedSettings,
  editingKey, setEditingKey, editValue, setEditValue, saving, onSave, onShowAdd,
}) => {
  const { t } = useTranslation()
  return (
    <div id="settings-section-other">
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : filteredSettings.length === 0 && !searchQuery ? (
        <div className="card si-478be2e9">
          <div className="card-body si-86638a30">
            <div className="si-0067e898">⚙️</div>
            <h3 className="si-ff45b6e8">{t('systemSettings.noAdditional')}</h3>
            <p className="si-23033f05">{t('systemSettings.noAdditionalDesc')}</p>
            <button className="btn btn-primary si-66faea9d" onClick={onShowAdd}>+ {t('systemSettings.addCustomSetting')}</button>
          </div>
        </div>
      ) : filteredSettings.length === 0 && searchQuery ? (
        <div className="card si-478be2e9">
          <div className="card-body si-86638a30">
            <div className="si-0067e898">🔍</div>
            <h3 className="si-ff45b6e8">{t('systemSettings.noMatch', { query: searchQuery })}</h3>
            <p className="si-23033f05">{t('systemSettings.noMatchDesc')}</p>
            <button className="btn btn-outline si-66faea9d" onClick={() => setSearchQuery('')}>{t('systemSettings.clearSearch')}</button>
          </div>
        </div>
      ) : (
        Object.entries(groupedSettings).map(([category, items]) => (
          <div key={category} className="card si-7e63ec4f">
            <div className="card-header">
              <h2 className="si-196afefa">⚙️ {category}</h2>
              <span className="si-5e2bdda7">{items.length} setting{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-body si-159de68c">
              {items.map(setting => (
                <div key={setting.key} className="si-aa3ba45f">
                  <div className="si-0f14bb0a">
                    <div className="si-bab2d193">
                      <code className="si-273df55c">
                        {setting.key}
                      </code>
                    </div>
                    {setting.description && (
                      <p className="si-ada3b9d6">{setting.description}</p>
                    )}
                  </div>
                  <div className="si-2889f74b">
                    {editingKey === setting.key ? (
                      <>
                        <input
                          className="form-input ss-field ss-edit-inline"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') onSave(setting.key); if (e.key === 'Escape') setEditingKey(null) }}
                        />
                        <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => onSave(setting.key)}>
                          {saving ? '...' : '✓'}
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => setEditingKey(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <span className="si-5dfcfb05">
                          {setting.value}
                        </span>
                        <button className="btn btn-sm btn-outline"
                          onClick={() => { setEditingKey(setting.key); setEditValue(setting.value) }}>
                          ✏️ Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default OtherSettingsSection
