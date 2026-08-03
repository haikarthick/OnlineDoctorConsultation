/**
 * Cloudinary responsive-delivery helpers for marketplace listing media.
 *
 * Listing images/videos are uploaded already optimized (auto format/quality,
 * capped at 1600px - see backend/src/utils/storage.ts CloudinaryStorage), but
 * a 1600px image is still overkill for a small grid-card thumbnail on a phone.
 * These helpers add an on-the-fly transformation on top of the stored asset -
 * no extra upload, just a differently-sized derivative served from the same
 * Cloudinary URL, which is what makes "one photo, many device sizes" cheap.
 *
 * URLs that aren't from Cloudinary (legacy /uploads/ paths from before this
 * driver existed) pass through unchanged - this must never throw on those.
 */

const CLOUDINARY_UPLOAD_MARKER = '/upload/'

export function isCloudinaryUrl(url?: string | null): boolean {
  return !!url && url.includes('res.cloudinary.com') && url.includes(CLOUDINARY_UPLOAD_MARKER)
}

/** Inserts a resize/format/quality transformation into a Cloudinary URL. No-op for non-Cloudinary URLs. */
export function cldUrl(url: string | undefined | null, width?: number): string {
  if (!url) return ''
  if (!isCloudinaryUrl(url)) return url
  const transforms = ['f_auto', 'q_auto']
  if (width) transforms.push(`w_${width}`, 'c_limit')
  const insertAt = url.indexOf(CLOUDINARY_UPLOAD_MARKER) + CLOUDINARY_UPLOAD_MARKER.length
  return url.slice(0, insertAt) + transforms.join(',') + '/' + url.slice(insertAt)
}

/** src/srcSet/sizes trio for a responsive <img>, sized for a grid-card thumbnail context. */
export function cldCardImageProps(url: string | undefined | null) {
  if (!url || !isCloudinaryUrl(url)) return { src: url || '' }
  return {
    src: cldUrl(url, 400),
    srcSet: [300, 400, 600, 800].map(w => `${cldUrl(url, w)} ${w}w`).join(', '),
    sizes: '(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 260px',
  }
}

/** src/srcSet/sizes trio for a responsive <img>, sized for the full listing-detail view. */
export function cldDetailImageProps(url: string | undefined | null) {
  if (!url || !isCloudinaryUrl(url)) return { src: url || '' }
  return {
    src: cldUrl(url, 1200),
    srcSet: [600, 900, 1200, 1600].map(w => `${cldUrl(url, w)} ${w}w`).join(', '),
    sizes: '(max-width: 768px) 100vw, 700px',
  }
}
