import React from 'react'

/**
 * WayToVetLogo
 * ---------------------------------------------------------------------------
 * Brand mark for "waytovet" - a veterinary telemedicine platform.
 *
 * Concept: "way to vet" = a PATH leading to CARE.
 *   - The four upper toe pads are laid out like stepping stones along a route.
 *   - A curved path (the "way") rises through the paw toward the main pad,
 *     which doubles as a location pin / medical shield landing point.
 *   - Reads as a paw print at a glance (instantly "veterinary"), but carries
 *     the journey theme the brand name implies.
 *
 * Colour is pulled straight from the existing UI palette so the mark sits
 * natively in the layout on every surface:
 *   - Primary gradient  #667eea -> #764ba2   (site brand gradient)
 *   - Deep accent       #4f46e5 / #6366f1     (indigo CTA)
 *
 * Rendering modes keep it legible wherever it lands:
 *   variant="full"  -> gradient badge + "waytovet" wordmark (nav bars, panels)
 *   variant="mark"  -> gradient badge only            (collapsed rail, favicon, hero)
 *
 * Props:
 *   size     - pixel size of the square badge/mark (default 32). The wordmark
 *              scales relative to it, so one prop drives every breakpoint.
 *   variant  - 'full' | 'mark'
 *   onDark   - true when placed on a dark surface (nav/hero/login panel):
 *              the wordmark renders white; otherwise it uses the brand ink.
 *   title    - accessible label; defaults to "waytovet".
 *   className / style - passthrough for layout tweaks.
 *
 * Everything is pure SVG (no external assets), so it is resolution-independent
 * across mobile, tablet and widescreen, and inherits no raster blur.
 */
export interface WayToVetLogoProps {
  size?: number
  variant?: 'full' | 'mark'
  onDark?: boolean
  title?: string
  className?: string
  style?: React.CSSProperties
}

export const WayToVetLogo: React.FC<WayToVetLogoProps> = ({
  size = 32,
  variant = 'full',
  onDark = false,
  title = 'waytovet',
  className,
  style,
}) => {
  // Unique gradient ids so multiple instances on one page never collide.
  const uid = React.useId().replace(/:/g, '')
  const bgId = `wtv-bg-${uid}`
  const padId = `wtv-pad-${uid}`
  const pathId = `wtv-path-${uid}`

  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        {/* Rounded-square brand badge in the site's primary gradient */}
        <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
        {/* Main pad: a lighter gradient so it lifts off the badge */}
        <linearGradient id={padId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5e9ff" />
        </linearGradient>
        {/* The "way" - a luminous path stroke */}
        <linearGradient id={pathId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fcd34d" />
        </linearGradient>
      </defs>

      {/* Badge */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${bgId})`} />

      {/* Four toe pads, arranged like stepping stones down the route */}
      <g fill={`url(#${padId})`}>
        <ellipse cx="20" cy="22" rx="5.4" ry="6.4" transform="rotate(-18 20 22)" />
        <ellipse cx="30" cy="17.5" rx="5" ry="6.2" transform="rotate(-4 30 17.5)" />
        <ellipse cx="41" cy="18.5" rx="5" ry="6.2" transform="rotate(8 41 18.5)" />
        <ellipse cx="49.5" cy="25" rx="5.2" ry="6.2" transform="rotate(22 49.5 25)" />
      </g>

      {/* Main pad - broad landing point, reads as the journey's destination */}
      <path
        d="M32 30c7.4 0 13 5.4 13 12.2 0 6.6-5.6 10.8-13 10.8s-13-4.2-13-10.8C19 35.4 24.6 30 32 30z"
        fill={`url(#${padId})`}
      />

      {/* The "way" - a curving path that climbs through the paw to the pad */}
      <path
        d="M22 51c3.5-3 4.2-8 7.2-10.4 2.6-2.1 5.6-1.6 7.8.4"
        fill="none"
        stroke={`url(#${pathId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="0.5 4.6"
        opacity="0.95"
      />
      {/* Destination dot where the path meets the pad */}
      <circle cx="38" cy="41" r="3.1" fill="#fbbf24" />
      <circle cx="38" cy="41" r="1.3" fill="#7c3aed" />
    </svg>
  )

  if (variant === 'mark') {
    return (
      <span className={className} style={{ display: 'inline-flex', ...style }}>
        {mark}
      </span>
    )
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28, ...style }}
    >
      {mark}
      <span
        style={{
          fontSize: size * 0.62,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: onDark ? '#ffffff' : '#1f2540',
          whiteSpace: 'nowrap',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        }}
      >
        way<span style={{ color: onDark ? '#c4b5fd' : '#667eea' }}>to</span>vet
      </span>
    </span>
  )
}

export default WayToVetLogo
