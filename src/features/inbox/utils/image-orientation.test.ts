import { describe, expect, it } from 'vitest'
import { getJpegExifOrientation } from './image-orientation'

function makeExifJpeg(orientation: number): File {
  const bytes = new Uint8Array([
    0xff,
    0xd8, // JPEG SOI
    0xff,
    0xe1, // APP1
    0x00,
    0x22, // Segment length: 34 bytes including these two length bytes
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // Exif\0\0
    0x49,
    0x49, // Little-endian TIFF
    0x2a,
    0x00,
    0x08,
    0x00,
    0x00,
    0x00, // First IFD offset
    0x01,
    0x00, // One IFD entry
    0x12,
    0x01, // Orientation tag
    0x03,
    0x00, // SHORT
    0x01,
    0x00,
    0x00,
    0x00, // One value
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // Next IFD offset
    0xff,
    0xd9, // JPEG EOI
  ])
  return new File([bytes], 'photo.jpg', { type: 'image/jpeg' })
}

describe('getJpegExifOrientation', () => {
  it('reads a non-default EXIF orientation', async () => {
    await expect(getJpegExifOrientation(makeExifJpeg(6))).resolves.toBe(6)
  })

  it('returns null for non-JPEG files', async () => {
    const file = new File(['image'], 'image.webp', { type: 'image/webp' })

    await expect(getJpegExifOrientation(file)).resolves.toBeNull()
  })

  it('rejects invalid orientation values', async () => {
    await expect(getJpegExifOrientation(makeExifJpeg(9))).resolves.toBeNull()
  })
})
