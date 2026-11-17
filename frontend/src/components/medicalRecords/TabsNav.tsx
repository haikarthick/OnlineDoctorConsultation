import React from 'react'
import type { Tab } from './medicalRecordsShared'

export interface TabItem { key: Tab; icon: string; label: string; count?: number }

const TabsNav: React.FC<{ tabs: TabItem[]; activeTab: Tab; setActiveTab: (t: Tab) => void }> = ({ tabs, activeTab, setActiveTab }) => (
  <div className="med-tabs">
    {tabs.map(tab => (
      <button
        key={tab.key}
        className={`med-tab${activeTab === tab.key ? ' med-tab--active' : ''}`}
        onClick={() => setActiveTab(tab.key)}
      >
        <span className="med-tab__icon">{tab.icon}</span>
        <span className="med-tab__label">{tab.label}</span>
        {tab.count !== undefined && tab.count > 0 && (
          <span className="med-tab__badge">{tab.count}</span>
        )}
      </button>
    ))}
  </div>
)

export default TabsNav
