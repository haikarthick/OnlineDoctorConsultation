// Media limits - mirror backend caps (uploadImage/uploadVideo in
// backend/src/middleware/upload.ts, MAX_VIDEO_DURATION_SECONDS in
// FileController.ts). Checked client-side first so a farmer on a slow
// mobile connection gets instant feedback instead of uploading a file
// that the backend will just reject.
export const MAX_LISTING_IMAGES = 4
export const MAX_IMAGE_SIZE_MB = 5
export const MAX_VIDEO_SIZE_MB = 100
export const MAX_VIDEO_DURATION_SECONDS = 60

/** Reads a video file's duration client-side via an offscreen <video> element. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const objectUrl = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read video metadata'))
    }
    video.src = objectUrl
  })
}

export type TabKey = 'dashboard' | 'browse' | 'sell' | 'auctions' | 'orders' | 'messages' | 'favorites' | 'saved' | 'prices' | 'admin'

export type AdminSubTab = 'listings' | 'reports' | 'settings' | 'plans' | 'revenue'
