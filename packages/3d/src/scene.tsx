import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, type CanvasProps, useThree } from '@react-three/fiber'
import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePrefersReducedMotion } from './reduced-motion'
import { isWebGLAvailable } from './webgl'

/** How a scene treats the visitor's "reduce motion" setting. */
export type SceneReducedMotion = 'user' | 'always' | 'never'

/** Props of `<Scene>`: React Three Fiber's `<Canvas>` props, plus how the scene behaves around the page. */
export interface SceneProps
  extends Omit<CanvasProps, 'frameloop' | 'fallback' | 'dpr' | 'children' | 'onError'> {
  children?: ReactNode
  /**
   * Shown instead of the scene when it cannot run: no WebGL, or an error while loading or
   * drawing (a missing model, a lost GPU). An image of the scene is the usual choice. Default: nothing.
   */
  fallback?: ReactNode
  /** 3D content shown while models and textures load, such as drei's `<Html>` with a spinner. Default: nothing. */
  loading?: ReactNode
  /** `'always'` draws every frame (default); `'demand'` draws only when something changes. */
  frameloop?: 'always' | 'demand'
  /** Stop drawing while the scene is scrolled out of view or the tab or app is in the background. Default `true`. */
  pauseWhenHidden?: boolean
  /**
   * With `'user'` (the default), visitors who ask for less motion get a still scene: it draws on
   * demand, so `useFrame` animations stop while controls and state changes still redraw it.
   */
  reducedMotion?: SceneReducedMotion
  /** Pixel ratio, or the `[min, max]` range it stays within. Default `[1, 2]`. */
  dpr?: number | [number, number]
  /** Lower the pixel ratio when frames drop and raise it again when they recover. Default `true`. */
  adaptive?: boolean
  /** Called when the scene fails and the fallback is shown. */
  onError?: (error: Error) => void
  /** Class of the element around the canvas. The canvas fills it, so size the scene here. */
  className?: string
  /** Style of the element around the canvas. */
  style?: CSSProperties
}

/** The frame loop a scene should run, from what it was asked for and what the page knows. */
export function resolveFrameloop(state: {
  frameloop: 'always' | 'demand'
  paused: boolean
  reducedMotion: boolean
}): 'always' | 'demand' | 'never' {
  if (state.paused) return 'never'
  if (state.reducedMotion) return 'demand'
  return state.frameloop
}

/**
 * A React Three Fiber `<Canvas>` that behaves well on a real page: it renders only in the
 * browser (nothing during SSR), shows `fallback` when WebGL is missing or the scene throws,
 * stops drawing while off screen or in the background, keeps still for visitors who ask for
 * less motion, and trades resolution for frame rate on slow devices.
 */
export function Scene({
  children,
  fallback = null,
  loading = null,
  frameloop = 'always',
  pauseWhenHidden = true,
  reducedMotion = 'user',
  dpr = [1, 2],
  adaptive = true,
  onError,
  className,
  style,
  ...canvas
}: SceneProps) {
  const box = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const [pageVisible, setPageVisible] = useState(true)
  const prefersReduced = usePrefersReducedMotion()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!pauseWhenHidden || !mounted) return
    const onVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    let observer: IntersectionObserver | undefined
    if (box.current && typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(
        (entries) => {
          const last = entries[entries.length - 1]
          if (last) setOnScreen(last.isIntersecting)
        },
        { rootMargin: '100px' },
      )
      observer.observe(box.current)
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      setOnScreen(true)
      setPageVisible(true)
    }
  }, [pauseWhenHidden, mounted])

  const loop = resolveFrameloop({
    frameloop,
    paused: pauseWhenHidden && (!onScreen || !pageVisible),
    reducedMotion: reducedMotion === 'always' || (reducedMotion === 'user' && prefersReduced),
  })
  const [min, max] = typeof dpr === 'number' ? [dpr, dpr] : dpr

  let body: ReactNode = null
  if (mounted) {
    body = isWebGLAvailable() ? (
      <SceneBoundary fallback={fallback} onError={onError}>
        <Canvas frameloop={loop} dpr={dpr} {...canvas}>
          {adaptive && min !== max ? <AdaptiveResolution min={min} max={max} /> : null}
          <Suspense fallback={loading}>{children}</Suspense>
        </Canvas>
      </SceneBoundary>
    ) : (
      fallback
    )
  }

  return (
    <div
      ref={box}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
      data-kitr-scene={mounted ? loop : 'server'}
    >
      {body}
    </div>
  )
}

/** Steps the pixel ratio between `min` and `max` in quarters as drei's PerformanceMonitor sees frames drop or recover. */
function AdaptiveResolution({ min, max }: { min: number; max: number }) {
  const setDpr = useThree((s) => s.setDpr)
  return (
    <PerformanceMonitor
      onChange={({ factor }) => setDpr(Math.round((min + (max - min) * factor) * 4) / 4)}
    />
  )
}

interface BoundaryProps {
  fallback: ReactNode
  onError?: (error: Error) => void
  children: ReactNode
}

/** Catches errors from inside the canvas (React Three Fiber rethrows them here) and shows the fallback. */
class SceneBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.props.onError) this.props.onError(error)
    else
      console.error(
        '[kitr/3d] The scene failed and its fallback is shown.',
        error,
        info.componentStack,
      )
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
