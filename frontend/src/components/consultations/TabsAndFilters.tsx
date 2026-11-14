import type { TFunction } from 'i18next'

interface Props {
  t: TFunction
  activeTab: 'bookings' | 'consultations'
  onTabSwitch: (tab: 'bookings' | 'consultations') => void
  activeCount: number
  historyCount: number
  currentFilterStatuses: string[]
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  onRefresh: () => void
}

const TabsAndFilters = ({
  t, activeTab, onTabSwitch, activeCount, historyCount,
  currentFilterStatuses, statusFilter, onStatusFilterChange, onRefresh,
}: Props) => (
  <>
    {/* Tabs */}
    <div className="si-49b00590">
      {[{ key: 'bookings' as const, label: t('consultations.tabs.appointments'), count: activeCount },
        { key: 'consultations' as const, label: t('consultations.tabs.history'), count: historyCount }
      ].map(tab => (
        <button key={tab.key} type="button" onClick={() => onTabSwitch(tab.key)}
          className={`consult-tab-btn${activeTab === tab.key ? ' is-active' : ''}`}>
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>

    {/* Filters */}
    <div className="si-ad0381af">
      <span className="si-c3b93ebb">{t('consultations.filterLabel')}:</span>
      {['', ...currentFilterStatuses].map(s => (
        <button key={s} type="button" onClick={() => onStatusFilterChange(s)}
          className={`consult-filter-chip${statusFilter === s ? ' is-active' : ''}`}>
          {s ? t(`consultations.statuses.${s}`, s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : t('consultations.filterAll')}
        </button>
      ))}
      <button type="button" onClick={onRefresh} className="si-a5c246fd">{t('common.refresh')}</button>
    </div>
  </>
)

export default TabsAndFilters
