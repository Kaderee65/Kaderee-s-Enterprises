const TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Phone photos are often 4–8 MB straight off the camera. Shrink them in the
 * browser to something the shop can serve quickly, so uploads stay small.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!TYPES.includes(file.type)) throw new Error('Use a JPG, PNG or WebP photo.')

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const max = 1400
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return file
  // White behind the photo so transparent PNGs do not turn black in a JPEG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!blob) return file
  if (blob.size >= file.size && file.size <= 900_000) return file
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
}
