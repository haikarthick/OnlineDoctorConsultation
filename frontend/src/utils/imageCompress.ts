/**
 * Shrink a photo on the phone BEFORE uploading it.
 *
 * Phone cameras produce 3-12 MB photos; on a rural connection that is a slow or failed upload, and the
 * server used to reject anything over 5 MB outright. A listing photo only needs ~1600 px on its longest
 * side, which is a few hundred KB. Failure is never fatal: if the browser cannot decode or re-encode the
 * file we hand back the original and let the server's own limit decide.
 */

export const LISTING_PHOTO_MAX_SIDE = 1600
export const LISTING_PHOTO_QUALITY = 0.82

/** Largest size that keeps the aspect ratio and fits inside max x max. Never enlarges. Pure, so unit-tested. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 }
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

const SKIP_TYPES = ['image/gif', 'image/svg+xml']

export async function compressImage(file: File, maxSide = LISTING_PHOTO_MAX_SIDE, quality = LISTING_PHOTO_QUALITY): Promise<File> {
  if (SKIP_TYPES.includes(file.type) || typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file
  try {
    // imageOrientation 'from-image' applies the EXIF rotation, so a portrait photo is not saved sideways
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide)
    if (!width || !height) { bitmap.close?.(); return file }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    // Keep the original when re-encoding did not help (already small)
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
