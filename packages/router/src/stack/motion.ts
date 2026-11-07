import type { Presentation } from './engine'

/**
 * The look of a transition: iOS slides the new page in from the right with the page beneath
 * drifting left, Android fades it in while it rises a little, the web and desktops cross-fade.
 * Covers and sheets rise from the bottom everywhere. Every animation runs through the Web
 * Animations API; where it is missing (an old WebView, happy-dom) the transition settles at once.
 */
export type MotionStyle = 'ios' | 'android' | 'plain' | 'none'

/** The keyframes of one presentation in one style: for the arriving page, the leaving page and the page beneath. */
export interface MotionStep {
  /** Keyframes for the page coming to the front. */
  enter: Keyframe[]
  /** Keyframes for the page leaving the front (the reverse of `enter` when omitted). */
  exit?: Keyframe[]
  /** Keyframes for the page beneath while another arrives over it. Reversed when that page leaves. */
  under?: Keyframe[]
  /** Whether the page beneath is dimmed by a scrim. */
  scrim: boolean
  duration: number
  easing: string
}

const ease = {
  ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
  android: 'cubic-bezier(0.2, 0, 0, 1)',
  plain: 'cubic-bezier(0.4, 0, 0.2, 1)',
}

/** The motion for a presentation in a style. `none` keeps the page but skips the animation. */
export function motionFor(presentation: Presentation, style: MotionStyle): MotionStep {
  if (style === 'none')
    return { enter: [], scrim: presentation === 'sheet', duration: 0, easing: 'linear' }
  if (presentation === 'cover' || presentation === 'sheet') {
    return {
      enter: [{ transform: 'translate3d(0, 100%, 0)' }, { transform: 'translate3d(0, 0, 0)' }],
      under:
        presentation === 'cover' && style === 'ios'
          ? [
              { transform: 'translate3d(0, 0, 0) scale(1)', borderRadius: '0px' },
              { transform: 'translate3d(0, 12px, 0) scale(0.94)', borderRadius: '12px' },
            ]
          : undefined,
      scrim: true,
      duration: style === 'android' ? 300 : 420,
      easing: ease[style],
    }
  }
  if (style === 'ios')
    return {
      enter: [
        { transform: 'translate3d(100%, 0, 0)', boxShadow: '0 0 0 rgba(0,0,0,0)' },
        { transform: 'translate3d(0, 0, 0)', boxShadow: '-8px 0 24px rgba(0,0,0,0.12)' },
      ],
      under: [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-30%, 0, 0)' }],
      scrim: false,
      duration: presentation === 'fullscreen' ? 300 : 420,
      easing: ease.ios,
    }
  if (style === 'android')
    return {
      enter: [
        { opacity: 0, transform: 'translate3d(0, 24px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ],
      under: [{ opacity: 1 }, { opacity: 0.6 }],
      scrim: false,
      duration: 260,
      easing: ease.android,
    }
  return {
    enter: [
      { opacity: 0, transform: 'translate3d(16px, 0, 0)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0)' },
    ],
    scrim: false,
    duration: 180,
    easing: ease.plain,
  }
}

/** The style for the device: iOS and Android from the user agent, everything else `plain`. Reduced motion → `none`. */
export function detectMotionStyle(win: Window | undefined = globalThis.window): MotionStyle {
  if (!win) return 'plain'
  if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'none'
  const ua = win.navigator?.userAgent ?? ''
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && win.navigator.maxTouchPoints > 1))
    return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'plain'
}

/** Duration and easing for `animate()`, with `reverse` for a leaving page and `from` to continue a gesture. */
export interface AnimateOptions {
  duration: number
  easing: string
  /** Play the keyframes backwards (a leaving page). */
  reverse?: boolean
  /** Start part-way (a gesture already dragged the page this far), 0..1. */
  from?: number
}

/** Animate an element and resolve when done. Resolves at once without the Web Animations API or with no keyframes. */
export function animate(
  element: Element | null | undefined,
  keyframes: Keyframe[],
  options: AnimateOptions,
): Promise<void> {
  if (!element || !keyframes.length || options.duration <= 0) return Promise.resolve()
  const el = element as HTMLElement & { animate?: Element['animate'] }
  if (typeof el.animate !== 'function') return Promise.resolve()
  const frames = options.reverse ? [...keyframes].reverse() : keyframes
  const remaining = options.from ? Math.max(0, 1 - options.from) : 1
  const animation = el.animate(frames, {
    duration: options.duration * remaining,
    easing: options.easing,
    fill: 'both',
  })
  if (options.from && animation.effect) {
    // Jump to the gesture's progress so the page continues from where the finger left it.
    animation.currentTime = options.duration * options.from * remaining
  }
  return new Promise((resolve) => {
    const done = () => {
      try {
        animation.commitStyles?.()
      } catch {}
      animation.cancel()
      resolve()
    }
    animation.onfinish = done
    animation.oncancel = () => resolve()
    if (typeof animation.finished?.then === 'function')
      animation.finished.then(done, () => resolve())
  })
}

/** Clear the inline transform/opacity a finished animation or gesture left behind. */
export function clearMotion(element: Element | null | undefined) {
  const el = element as HTMLElement | null | undefined
  if (!el) return
  el.style.transform = ''
  el.style.opacity = ''
  el.style.boxShadow = ''
  el.style.borderRadius = ''
  el.style.transition = ''
}
