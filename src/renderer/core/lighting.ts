// Average brightness (0..255) of RGBA pixels, using the usual weights of the eye for each color.
export function meanLuminance(pixels: ArrayLike<number>): number {
  const count = Math.floor(pixels.length / 4)
  if (count === 0) return 0

  let total = 0
  for (let i = 0; i < count * 4; i += 4) {
    total += 0.299 * (pixels[i] ?? 0) + 0.587 * (pixels[i + 1] ?? 0) + 0.114 * (pixels[i + 2] ?? 0)
  }
  return total / count
}

const SAMPLE_SIZE = { width: 32, height: 18 }

// Measures the brightness of the current video picture on a tiny copy of it, which is cheap.
// The picture never leaves this function: only the number does.
export function sampleLuminance(video: HTMLVideoElement): number | null {
  if (!video.videoWidth) return null

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE.width
  canvas.height = SAMPLE_SIZE.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, SAMPLE_SIZE.width, SAMPLE_SIZE.height)
  return meanLuminance(ctx.getImageData(0, 0, SAMPLE_SIZE.width, SAMPLE_SIZE.height).data)
}
