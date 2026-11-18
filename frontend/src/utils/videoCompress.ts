/**
 * Shrink a phone video BEFORE uploading it.
 *
 * A one-minute phone video is often 60-150 MB, which is a slow or failed upload on rural data and was above
 * the server's limit. We re-record it in the browser at 720p and a modest bitrate (about 10-15 MB a minute).
 * This plays the video once in real time, so a 60 s clip takes about 60 s - progress is reported so the person
 * sees it working. If the browser cannot do it, or anything goes wrong, the original file is returned and the
 * normal size limit decides - compressing must never be the reason an upload fails.
 */

export const VIDEO_TARGET_HEIGHT = 720
export const VIDEO_BITS_PER_SECOND = 1_500_000
export const AUDIO_BITS_PER_SECOND = 96_000
/** Below this a clip is already small enough to send as it is. */
export const VIDEO_SKIP_BELOW_BYTES = 12 * 1024 * 1024
/** Originals up to this are accepted when the phone can shrink them (the shrunk file must still fit the server cap). */
export const VIDEO_MAX_ORIGINAL_MB = 250

/** Even width/height no taller than maxHeight, same aspect ratio, never enlarged. Pure. */
export function fitVideoSize(width: number, height: number, maxHeight = VIDEO_TARGET_HEIGHT): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 }
  const scale = Math.min(1, maxHeight / height)
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
  return { width: even(width * scale), height: even(height * scale) }
}

/** The first container/codec the browser can record, mp4 first (plays everywhere, incl. iPhones), else webm. Pure given the probe. */
export function pickVideoMime(isSupported: (mime: string) => boolean): string | null {
  const candidates = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find(isSupported) || null
}

export function shouldCompressVideo(sizeBytes: number, height?: number): boolean {
  return sizeBytes > VIDEO_SKIP_BELOW_BYTES || (height !== undefined && height > VIDEO_TARGET_HEIGHT)
}

/** True when this browser can re-record a video (canvas capture + MediaRecorder + WebAudio). */
export function canCompressVideo(): boolean {
  try {
    return typeof document !== 'undefined' && typeof MediaRecorder !== 'undefined'
      && typeof (HTMLCanvasElement.prototype as any).captureStream === 'function'
      && (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined')
      && !!pickVideoMime(m => MediaRecorder.isTypeSupported(m))
  } catch { return false }
}

export async function compressVideo(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  if (!canCompressVideo()) return file
  const mime = pickVideoMime(m => MediaRecorder.isTypeSupported(m))
  if (!mime) return file

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.playsInline = true
  video.src = url
  let audioCtx: AudioContext | null = null
  let raf = 0
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('unreadable video'))
    })
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0) return file
    if (!shouldCompressVideo(file.size, video.videoHeight)) return file

    const { width, height } = fitVideoSize(video.videoWidth, video.videoHeight)
    if (!width || !height) return file
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return file

    // Sound goes to the recorder only, never to the speakers: the person is not made to listen to it again.
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    audioCtx = new Ctx() as AudioContext
    const audioDest = audioCtx.createMediaStreamDestination()
    audioCtx.createMediaElementSource(video).connect(audioDest)

    const stream = new MediaStream([...(canvas as any).captureStream(30).getVideoTracks(), ...audioDest.stream.getAudioTracks()])
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITS_PER_SECOND, audioBitsPerSecond: AUDIO_BITS_PER_SECOND })
    recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data) }

    const finished = new Promise<boolean>(resolve => {
      recorder.onstop = () => resolve(true)
      recorder.onerror = () => resolve(false)
      // Safety net: never hang the upload on a browser that stalls (background tab, odd codec)
      setTimeout(() => resolve(false), duration * 1000 * 2 + 15000)
    })
    const draw = () => {
      ctx2d.drawImage(video, 0, 0, width, height)
      onProgress?.(Math.min(1, video.currentTime / duration))
      raf = requestAnimationFrame(draw)
    }
    video.onended = () => { try { recorder.state !== 'inactive' && recorder.stop() } catch { /* already stopped */ } }

    recorder.start(1000)
    await audioCtx.resume().catch(() => undefined)
    await video.play()
    draw()
    const ok = await finished
    if (!ok || chunks.length === 0) return file

    const blob = new Blob(chunks, { type: mime.split(';')[0] })
    // Keep the original when shrinking did not help
    if (blob.size >= file.size) return file
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
    onProgress?.(1)
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type, lastModified: Date.now() })
  } catch {
    return file
  } finally {
    cancelAnimationFrame(raf)
    try { video.pause() } catch { /* nothing playing */ }
    audioCtx?.close().catch(() => undefined)
    URL.revokeObjectURL(url)
  }
}
