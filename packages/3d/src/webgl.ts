let cached: boolean | undefined

/**
 * Can this browser draw WebGL? False on the server, in old or locked-down browsers, on machines
 * with blocklisted GPU drivers and in test DOMs. Checked once, then cached.
 */
export function isWebGLAvailable(): boolean {
  if (cached !== undefined) return cached
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    cached = !!gl && typeof (gl as WebGLRenderingContext).getParameter === 'function'
    ;(gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}

/** Forget the cached answer of `isWebGLAvailable()`. For tests that stub `getContext`. */
export function resetWebGLCheck(): void {
  cached = undefined
}
