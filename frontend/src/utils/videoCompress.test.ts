import { describe, it, expect } from 'vitest'
import { fitVideoSize, pickVideoMime, shouldCompressVideo, canCompressVideo, compressVideo, VIDEO_SKIP_BELOW_BYTES } from './videoCompress'

describe('fitVideoSize', () => {
  it('scales 1080p landscape down to 720p with even dimensions', () => {
    expect(fitVideoSize(1920, 1080)).toEqual({ width: 1280, height: 720 })
  })
  it('scales a vertical phone video by its height, keeping the ratio', () => {
    expect(fitVideoSize(1080, 1920)).toEqual({ width: 406, height: 720 })
  })
  it('never enlarges a small video', () => {
    expect(fitVideoSize(640, 360)).toEqual({ width: 640, height: 360 })
  })
  it('returns zero for an unreadable size so the caller keeps the original file', () => {
    expect(fitVideoSize(0, 720)).toEqual({ width: 0, height: 0 })
    expect(fitVideoSize(NaN, 720)).toEqual({ width: 0, height: 0 })
  })
  it('always returns even numbers (encoders reject odd sizes)', () => {
    const { width, height } = fitVideoSize(1001, 563)
    expect(width % 2).toBe(0)
    expect(height % 2).toBe(0)
  })
})

describe('pickVideoMime', () => {
  it('prefers mp4 (plays on every phone) when the browser can record it', () => {
    expect(pickVideoMime(() => true)).toMatch(/^video\/mp4/)
  })
  it('falls back to webm when mp4 cannot be recorded', () => {
    expect(pickVideoMime(m => m.startsWith('video/webm'))).toMatch(/^video\/webm/)
  })
  it('gives nothing when the browser can record neither (the original is then uploaded)', () => {
    expect(pickVideoMime(() => false)).toBeNull()
  })
})

describe('shouldCompressVideo', () => {
  it('leaves a small, already-720p clip alone', () => {
    expect(shouldCompressVideo(VIDEO_SKIP_BELOW_BYTES - 1, 720)).toBe(false)
  })
  it('shrinks a big file, or a taller-than-720p one even if small', () => {
    expect(shouldCompressVideo(VIDEO_SKIP_BELOW_BYTES + 1, 720)).toBe(true)
    expect(shouldCompressVideo(5 * 1024 * 1024, 1080)).toBe(true)
  })
})

describe('where the browser cannot re-record (jsdom has no MediaRecorder)', () => {
  it('says so, and hands back the very same file rather than failing', async () => {
    expect(canCompressVideo()).toBe(false)
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
    expect(await compressVideo(file)).toBe(file)
  })
})
