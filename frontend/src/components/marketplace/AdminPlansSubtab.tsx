import React from 'react'
import type { TFunction } from 'i18next'

export const AdminPlansSubtab: React.FC<{
  monetizationPlans: any[]; formatCurrency: (n: number) => string;
  onTogglePlanActive: (plan: any) => void; onEditPlan: (plan: any) => void; onDeletePlan: (id: string) => void;
  editingPlan: any; planForm: Record<string, any>; onPlanFormChange: (updater: (f: Record<string, any>) => Record<string, any>) => void;
  onSavePlan: () => void; onCancelEdit: () => void; t: TFunction;
}> = ({ monetizationPlans, formatCurrency, onTogglePlanActive, onEditPlan, onDeletePlan, editingPlan, planForm, onPlanFormChange, onSavePlan, onCancelEdit, t }) => (
  <div>
    <div className="mp-section">
      <h3 className="mp-section-title">{t('marketplace.monetization.managePlans')}</h3>
      <div className="mp-plans-grid">
        {monetizationPlans.map(p => (
          <div key={p.id} className={`mp-plan-card ${p.is_active ? 'active' : 'inactive'}`}>
            <div className="mp-plan-header">
              <h4>{p.name}</h4>
              <span className={`module-badge ${p.is_active ? 'success' : ''}`}>
                {p.is_active ? t('marketplace.monetization.active') : t('marketplace.monetization.inactive')}
              </span>
            </div>
            <p className="mp-plan-desc">{p.description}</p>
            <div className="mp-plan-price">
              {p.price > 0 ? formatCurrency(p.price) : t('marketplace.monetization.free')}
              {p.duration_days > 0 && <span className="mp-plan-duration">/ {p.duration_days} {t('marketplace.monetization.days')}</span>}
            </div>
            <div className="mp-plan-features">
              <div className="mp-plan-feature">📋 {p.max_listings === -1 ? t('marketplace.monetization.unlimited') : p.max_listings || 0} {t('marketplace.monetization.listings')}</div>
              <div className="mp-plan-feature">🚀 {p.max_boosts_per_month || 0} {t('marketplace.monetization.boostsMonth')}</div>
              {p.priority_support && <div className="mp-plan-feature">🛡️ {t('marketplace.monetization.prioritySupport')}</div>}
              {p.analytics_access && <div className="mp-plan-feature">📊 {t('marketplace.monetization.analyticsAccess')}</div>}
            </div>
            <div className="mp-plan-actions">
              <button className="module-btn small" onClick={() => onTogglePlanActive(p)}>
                {p.is_active ? '⏸️' : '▶️'}
              </button>
              <button className="module-btn small" onClick={() => onEditPlan(p)}>✏️</button>
              <button className="module-btn small" onClick={() => onDeletePlan(p.id)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
    {/* Plan Form */}
    <div className="mp-section">
      <h3 className="mp-section-title">{editingPlan ? t('marketplace.monetization.editPlan') : t('marketplace.monetization.createPlan')}</h3>
      <div className="module-form">
        <div className="module-form-row">
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.monetization.planName')}</label>
            <input className="module-input" value={planForm.name} onChange={e => onPlanFormChange(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.monetization.planPrice')}</label>
            <input className="module-input" type="number" value={planForm.price} onChange={e => onPlanFormChange(f => ({ ...f, price: e.target.value }))} />
          </div>
        </div>
        <div className="module-form-row-3">
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.monetization.durationDays')}</label>
            <input className="module-input" type="number" value={planForm.durationDays} onChange={e => onPlanFormChange(f => ({ ...f, durationDays: e.target.value }))} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.monetization.maxListings')}</label>
            <input className="module-input" type="number" value={planForm.maxListings} onChange={e => onPlanFormChange(f => ({ ...f, maxListings: e.target.value }))} placeholder="-1 = unlimited" />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.monetization.boostsMonth')}</label>
            <input className="module-input" type="number" value={planForm.maxBoostsPerMonth} onChange={e => onPlanFormChange(f => ({ ...f, maxBoostsPerMonth: e.target.value }))} />
          </div>
        </div>
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.monetization.planDescription')}</label>
          <textarea className="module-input" rows={2} value={planForm.description} onChange={e => onPlanFormChange(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="mp-plan-form-actions">
          <button className="module-btn primary" onClick={onSavePlan}>{editingPlan ? t('marketplace.monetization.updatePlan') : t('marketplace.monetization.createPlan')}</button>
          {editingPlan && <button className="module-btn" onClick={onCancelEdit}>{t('marketplace.monetization.cancel')}</button>}
        </div>
      </div>
    </div>
  </div>
)
