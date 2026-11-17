import React from 'react'
import type { TFunction } from 'i18next'
import { AdminSubTab } from './marketplaceShared'
import { AdminListingsSubtab } from './AdminListingsSubtab'
import { AdminReportsSubtab } from './AdminReportsSubtab'
import { AdminSettingsSubtab } from './AdminSettingsSubtab'
import { AdminPlansSubtab } from './AdminPlansSubtab'
import { AdminRevenueSubtab } from './AdminRevenueSubtab'

export const AdminPanel: React.FC<{
  adminSubTab: AdminSubTab; onSubTabChange: (st: AdminSubTab) => void;
  listingsProps: React.ComponentProps<typeof AdminListingsSubtab>;
  reportsProps: React.ComponentProps<typeof AdminReportsSubtab>;
  settingsProps: React.ComponentProps<typeof AdminSettingsSubtab>;
  plansProps: React.ComponentProps<typeof AdminPlansSubtab>;
  revenueProps: React.ComponentProps<typeof AdminRevenueSubtab>;
  t: TFunction;
}> = ({ adminSubTab, onSubTabChange, listingsProps, reportsProps, settingsProps, plansProps, revenueProps, t }) => (
  <div>
    {/* Admin Sub-tabs */}
    <div className="mp-admin-subtabs">
      {(['listings', 'reports', 'settings', 'plans', 'revenue'] as const).map(st => (
        <button key={st} className={`mp-admin-subtab ${adminSubTab === st ? 'active' : ''}`}
          onClick={() => onSubTabChange(st)}>
          {st === 'listings' && '📋'} {st === 'reports' && '🚩'} {st === 'settings' && '⚙️'} {st === 'plans' && '💎'} {st === 'revenue' && '📊'}
          {' '}{t(`marketplace.monetization.subtabs.${st}`)}
        </button>
      ))}
    </div>

    {adminSubTab === 'listings' && <AdminListingsSubtab {...listingsProps} />}
    {adminSubTab === 'reports' && <AdminReportsSubtab {...reportsProps} />}
    {adminSubTab === 'settings' && <AdminSettingsSubtab {...settingsProps} />}
    {adminSubTab === 'plans' && <AdminPlansSubtab {...plansProps} />}
    {adminSubTab === 'revenue' && <AdminRevenueSubtab {...revenueProps} />}
  </div>
)
