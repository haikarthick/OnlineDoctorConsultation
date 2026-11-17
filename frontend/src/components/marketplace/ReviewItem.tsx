import React from 'react'

// ─── Review Item ───
export const ReviewItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="mp-review-item"><span className="mp-review-label">{label}</span><span className="mp-review-value">{value || '-'}</span></div>
)
