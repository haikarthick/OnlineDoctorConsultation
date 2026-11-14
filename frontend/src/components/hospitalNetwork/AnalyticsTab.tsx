import React from 'react'
import type { TFunction } from 'i18next'

export interface AnalyticsTabProps {
  analyticsLoading: boolean
  analyticsError: string
  analyticsData: Record<string, any> | null
  t: TFunction
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ analyticsLoading, analyticsError, analyticsData, t }) => {
  return (
    <div className="hn-tab-content">
      <div className="hn-audit-header">
        <h2 className="hn-audit-section-title">📊 {t('networkAnalytics.title')}</h2>
      </div>
      {analyticsLoading && <div className="hn-loading">⏳ {t('common.loading')}</div>}
      {analyticsError && <div className="module-alert error">{analyticsError}</div>}
      {!analyticsLoading && !analyticsError && analyticsData && (
        <>
          <div className="hn-analytics-grid">
            <div className="hn-stat-card hn-stat-blue">
              <div className="hn-stat-value">{analyticsData.totalMembers ?? 0}</div>
              <div className="hn-stat-label">👤 {t('networkAnalytics.totalMembers')}</div>
            </div>
            <div className="hn-stat-card hn-stat-green">
              <div className="hn-stat-value">{analyticsData.totalHospitals ?? 0}</div>
              <div className="hn-stat-label">🏥 {t('networkAnalytics.totalHospitals')}</div>
            </div>
            <div className="hn-stat-card hn-stat-teal">
              <div className="hn-stat-value">{analyticsData.totalPatients ?? 0}</div>
              <div className="hn-stat-label">🐾 {t('networkAnalytics.activePatients')}</div>
            </div>
            <div className="hn-stat-card hn-stat-orange">
              <div className="hn-stat-value">{analyticsData.activeConsultations ?? 0}</div>
              <div className="hn-stat-label">🩺 {t('networkAnalytics.consultations30d')}</div>
            </div>
            <div className="hn-stat-card hn-stat-purple">
              <div className="hn-stat-value">{analyticsData.referrals30d ?? 0}</div>
              <div className="hn-stat-label">🔄 {t('networkAnalytics.referrals30d')}</div>
            </div>
            <div className="hn-stat-card hn-stat-red">
              <div className="hn-stat-value">{analyticsData.auditEvents7d ?? 0}</div>
              <div className="hn-stat-label">🛡️ {t('networkAnalytics.auditEvents7d')}</div>
            </div>
          </div>

          {/* Enrollment Trend */}
          {Array.isArray(analyticsData.enrollmentTrend) && analyticsData.enrollmentTrend.length > 0 && (
            <div className="module-card si-b4c2d096">
              <div className="hn-panel-header">
                <h3>{t('networkAnalytics.enrollmentTrend')}</h3>
                <span className="si-48a0b045">{t('networkAnalytics.lastNMonths', { n: 6 })}</span>
              </div>
              <div className="card-body">
                {[...analyticsData.enrollmentTrend].reverse().map((item: any, i: number) => {
                  const month = item.month ? new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '-'
                  const count = parseInt(item.count ?? 0)
                  const max = Math.max(...analyticsData.enrollmentTrend.map((r: any) => parseInt(r.count ?? 0)), 1)
                  return (
                    <div key={i} className="hn-trend-row">
                      <span className="hn-trend-month">{month}</span>
                      <div className="hn-trend-bar-wrap">
                        {/* eslint-disable-next-line react/forbid-dom-props */}
                        <div className="hn-trend-bar" style={{ ['--fill' as string]: `${(count / max) * 100}%` }} />
                      </div>
                      <span className="hn-trend-count">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
      {!analyticsLoading && !analyticsError && !analyticsData && (
        <div className="hn-empty-state">
          <div className="hn-empty-icon">📊</div>
          <div className="hn-empty-title">{t('networkAnalytics.noData')}</div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsTab
