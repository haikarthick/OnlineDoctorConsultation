import React from 'react'

// ─── Auction Countdown Timer ───
export const AuctionCountdown: React.FC<{ endTime: string; t: (key: string) => string }> = ({ endTime, t }) => {
  const [remaining, setRemaining] = React.useState('')
  React.useEffect(() => {
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now()
      if (diff <= 0) { setRemaining(t('marketplace.detail.auctionEnded')); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endTime])
  const isUrgent = new Date(endTime).getTime() - Date.now() < 3600000
  return <span className={`mp-countdown ${isUrgent ? 'urgent' : ''}`}>{remaining}</span>
}
