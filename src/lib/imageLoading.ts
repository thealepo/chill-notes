export type ImageLoadStatus = 'loaded' | 'error' | 'timeout'

type LoadableImage = Pick<
  HTMLImageElement,
  'complete' | 'naturalWidth' | 'addEventListener' | 'removeEventListener'
>

/**
 * Waits for an image without hanging when it has already failed or never emits
 * a terminal event. The second completeness check closes the race between the
 * initial check and listener registration.
 */
export function waitForImageLoad(image: LoadableImage, timeoutMs = 5_000): Promise<ImageLoadStatus> {
  if (image.complete) return Promise.resolve(image.naturalWidth > 0 ? 'loaded' : 'error')

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const finish = (status: ImageLoadStatus) => {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      resolve(status)
    }
    const handleLoad = () => finish(image.naturalWidth > 0 ? 'loaded' : 'error')
    const handleError = () => finish('error')

    image.addEventListener('load', handleLoad, { once: true })
    image.addEventListener('error', handleError, { once: true })

    if (image.complete) {
      finish(image.naturalWidth > 0 ? 'loaded' : 'error')
      return
    }

    timeoutId = setTimeout(() => finish('timeout'), Math.max(0, timeoutMs))
  })
}
