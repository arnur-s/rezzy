// Phone cameras store photos in a fixed sensor orientation and record the
// display rotation in an EXIF `Orientation` tag. Browsers honor that tag, but
// some downstream consumers (e.g. WhatsApp) strip it on re-encode and render
// the raw, un-rotated pixels — the photo appears rotated 90°/180°.
//
// `normalizeImageOrientation` bakes the EXIF rotation into the actual pixels and
// drops the metadata by decoding with orientation applied and redrawing to a
// canvas. The result renders consistently everywhere, independent of EXIF.

// EXIF orientation is primarily a JPEG camera-photo concern. Restricting the
// canvas path to JPEG also avoids flattening animated PNG/WebP files or losing
// their transparency.
const NORMALIZABLE_IMAGE_TYPE = 'image/jpeg'
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] as const
const JPEG_HEADER_SIZE = 256 * 1024

// Canvas re-encode target. PNG is lossless; everything else keeps JPEG at a
// high quality to avoid a second visible generation loss.
const JPEG_QUALITY = 0.92

function canNormalize(file: File): boolean {
  return (
    file.type === NORMALIZABLE_IMAGE_TYPE &&
    typeof createImageBitmap === 'function' &&
    typeof document !== 'undefined'
  )
}

function readExifOrientation(view: DataView, tiffOffset: number): number | null {
  if (tiffOffset + 8 > view.byteLength) return null

  const byteOrder = view.getUint16(tiffOffset, false)
  const littleEndian = byteOrder === 0x4949
  if (!littleEndian && byteOrder !== 0x4d4d) return null
  if (view.getUint16(tiffOffset + 2, littleEndian) !== 42) return null

  const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian)
  const ifdStart = tiffOffset + ifdOffset
  if (ifdStart + 2 > view.byteLength) return null

  const entryCount = view.getUint16(ifdStart, littleEndian)
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdStart + 2 + index * 12
    if (entryOffset + 12 > view.byteLength) return null
    if (view.getUint16(entryOffset, littleEndian) !== 0x0112) continue
    if (
      view.getUint16(entryOffset + 2, littleEndian) !== 3 ||
      view.getUint32(entryOffset + 4, littleEndian) < 1
    ) {
      return null
    }

    const orientation = view.getUint16(entryOffset + 8, littleEndian)
    return orientation >= 1 && orientation <= 8 ? orientation : null
  }

  return null
}

/** Reads the EXIF orientation from the leading JPEG metadata segments. */
export async function getJpegExifOrientation(
  file: File,
): Promise<number | null> {
  if (file.type !== NORMALIZABLE_IMAGE_TYPE) return null

  const buffer = await file.slice(0, JPEG_HEADER_SIZE).arrayBuffer()
  const view = new DataView(buffer)
  if (
    view.byteLength < 4 ||
    view.getUint8(0) !== 0xff ||
    view.getUint8(1) !== 0xd8
  ) {
    return null
  }

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null

    const marker = view.getUint8(offset + 1)
    if (marker === 0xda || marker === 0xd9) return null

    const segmentLength = view.getUint16(offset + 2, false)
    if (segmentLength < 2) return null

    const segmentEnd = offset + 2 + segmentLength
    if (segmentEnd > view.byteLength) return null

    if (marker === 0xe1 && segmentLength >= 8) {
      const exifOffset = offset + 4
      const isExif = EXIF_HEADER.every(
        (value, index) => view.getUint8(exifOffset + index) === value,
      )
      if (isExif) {
        return readExifOrientation(view, exifOffset + EXIF_HEADER.length)
      }
    }

    offset = segmentEnd
  }

  return null
}

/**
 * Returns a new File with EXIF orientation applied to the pixels and metadata
 * stripped. On any failure (unsupported type, decode error, no canvas context)
 * the original file is returned unchanged so sending never breaks.
 */
export async function normalizeImageOrientation(file: File): Promise<File> {
  if (!canNormalize(file)) return file

  let orientation: number | null
  try {
    orientation = await getJpegExifOrientation(file)
  } catch {
    return file
  }
  if (orientation === null || orientation === 1) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0)

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, JPEG_QUALITY)
    })
    if (!blob) return file

    return new File([blob], file.name, {
      type: outputType,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    bitmap.close()
  }
}
