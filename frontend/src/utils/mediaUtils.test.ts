import { describe, it, expect } from 'vitest'
import { fitWithin } from './imageCompress'
import { videoPosterUrl, cldUrl } from './media'

describe('fitWithin', () => {
  it('keeps a small photo as it is and never enlarges', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
  it('scales a landscape phone photo to 1600 on the long side, keeping the ratio', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
  })
  it('scales a portrait photo on its height', () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })
  it('returns zero for an unreadable size so the caller keeps the original file', () => {
    expect(fitWithin(0, 100, 1600)).toEqual({ width: 0, height: 0 })
    expect(fitWithin(NaN, 100, 1600)).toEqual({ width: 0, height: 0 })
  })
})

describe('videoPosterUrl', () => {
  const vid = 'https://res.cloudinary.com/demo/video/upload/v123/abc.mp4'
  it('builds a still-frame jpg from a Cloudinary video', () => {
    expect(videoPosterUrl(vid, 400)).toBe('https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto,w_400,c_limit/v123/abc.jpg')
  })
  it('gives nothing for a local upload, an image or an empty value (the caller then shows no poster)', () => {
    expect(videoPosterUrl('/uploads/x.mp4')).toBeUndefined()
    expect(videoPosterUrl('https://res.cloudinary.com/demo/image/upload/v1/a.jpg')).toBeUndefined()
    expect(videoPosterUrl(undefined)).toBeUndefined()
  })
  it('leaves image helpers untouched', () => {
    expect(cldUrl('/uploads/a.jpg', 300)).toBe('/uploads/a.jpg')
  })
})
