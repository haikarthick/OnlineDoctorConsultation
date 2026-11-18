import React, { useState } from 'react'
import type { TFunction } from 'i18next'
import { cldCardImageProps, cldDetailImageProps, videoPosterUrl } from '../../utils/media'

/** An uploaded file (or a direct video link) can play inline; anything else is opened in a new tab. */
export function isPlayableVideo(url: string): boolean {
  return String(url).startsWith('/uploads/') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)
}

type Slide = { kind: 'video'; url: string } | { kind: 'image'; url: string }

/**
 * The listing's media in one swipeable place, VIDEO FIRST: a buyer decides from the video or the photos
 * before they read anything else. Shared by the signed-in and public listing pages so they cannot drift.
 */
export const ListingGallery: React.FC<{ title: string; images: string[]; videoUrl?: string | null; t: TFunction }> = ({ title, images, videoUrl, t }) => {
  const slides: Slide[] = [
    ...(videoUrl ? [{ kind: 'video', url: videoUrl } as Slide] : []),
    ...images.map(url => ({ kind: 'image', url } as Slide)),
  ]
  const [active, setActive] = useState(0)
  if (slides.length === 0) return null
  const current = slides[Math.min(active, slides.length - 1)]
  const go = (delta: number) => setActive(i => (i + delta + slides.length) % slides.length)

  return (
    <div className="mp-detail-gallery">
      <div className="mp-detail-gallery-main">
        {current.kind === 'video' ? (
          isPlayableVideo(current.url)
            ? <video key={current.url} controls playsInline preload="metadata" poster={videoPosterUrl(current.url)} src={current.url} className="mp-detail-video-el" aria-label={t('marketplace.gallery.video')} />
            : <a href={current.url} target="_blank" rel="noopener noreferrer" className="module-btn">▶ {t('marketplace.detail.watchVideo')}</a>
        ) : (
          <img {...cldDetailImageProps(current.url)} alt={`${title} - ${t('marketplace.gallery.photo')}`} />
        )}
        {slides.length > 1 && (
          <>
            <button type="button" className="mp-gallery-nav prev" onClick={() => go(-1)} aria-label={t('marketplace.gallery.previous')}>‹</button>
            <button type="button" className="mp-gallery-nav next" onClick={() => go(1)} aria-label={t('marketplace.gallery.next')}>›</button>
            <span className="mp-gallery-count" aria-live="polite">{Math.min(active, slides.length - 1) + 1} / {slides.length}</span>
          </>
        )}
      </div>
      {slides.length > 1 && (
        <div className="mp-detail-gallery-thumbs">
          {slides.map((s, i) => (
            <button key={`${s.kind}-${i}`} type="button" className={`mp-detail-thumb ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}
              aria-label={s.kind === 'video' ? t('marketplace.gallery.video') : `${t('marketplace.gallery.photo')} ${i + (videoUrl ? 0 : 1)}`}>
              {s.kind === 'video'
                ? (videoPosterUrl(s.url, 200) ? <img src={videoPosterUrl(s.url, 200)} alt="" loading="lazy" /> : <span className="mp-thumb-video-fallback" aria-hidden="true">🎥</span>)
                : <img {...cldCardImageProps(s.url)} alt="" loading="lazy" />}
              {s.kind === 'video' && <span className="mp-thumb-play" aria-hidden="true">▶</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
