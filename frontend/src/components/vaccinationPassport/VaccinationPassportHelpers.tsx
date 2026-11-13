// ─── Status badge helper ─────────────────────────────────────
export function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    administered: 'badge-success',
    pending: 'badge-pending',
    overdue: 'badge-error',
    skipped: 'badge-pending',
    waived: 'badge-pending',
  }
  return <span className={`module-badge ${map[status] || 'badge-pending'}`}>{t(`vaccinationPassport.status.${status}`)}</span>
}

// ─── Compliance meter ─────────────────────────────────────────
export function ComplianceMeter({ percent }: { percent: number }) {
  const tier = percent >= 80 ? 'tier-high' : percent >= 50 ? 'tier-medium' : 'tier-low'
  return (
    <div className="vp-compliance-meter">
      {/* eslint-disable-next-line react/forbid-dom-props -- percent is a continuous computed value, not a finite enum; color tier is handled by the className */}
      <div className={`vp-compliance-bar ${tier}`} style={{ ['--fill' as string]: `${percent}%` }} />
      <span className={`vp-compliance-label ${tier}`}>{percent}%</span>
    </div>
  )
}
