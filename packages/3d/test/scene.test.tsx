import ReactThreeTestRenderer from '@react-three/test-renderer'
import { act, render, renderHook, screen } from '@testing-library/react'
import { useRef } from 'react'
import { renderToString } from 'react-dom/server'
import type { Mesh } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetWebGLCheck, Scene, toHexColor, useFrame, useThemeColor } from '../src'
import { resolveFrameloop } from '../src/scene'

const realGetContext = HTMLCanvasElement.prototype.getContext

function fakeWebGL(available: boolean) {
  resetWebGLCheck()
  HTMLCanvasElement.prototype.getContext = ((kind: string) => {
    if (!available || !kind.startsWith('webgl')) return null
    return { getParameter: () => 0, getExtension: () => null } as never
  }) as never
}

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

let intersect: (visible: boolean) => void = () => {}
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        intersect = (visible) => cb([{ isIntersecting: visible }])
      }
      observe() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext
  resetWebGLCheck()
  vi.unstubAllGlobals()
})

describe('resolveFrameloop', () => {
  it('pauses, then keeps still for reduced motion, then runs as asked', () => {
    expect(resolveFrameloop({ frameloop: 'always', paused: true, reducedMotion: true })).toBe(
      'never',
    )
    expect(resolveFrameloop({ frameloop: 'always', paused: false, reducedMotion: true })).toBe(
      'demand',
    )
    expect(resolveFrameloop({ frameloop: 'always', paused: false, reducedMotion: false })).toBe(
      'always',
    )
    expect(resolveFrameloop({ frameloop: 'demand', paused: false, reducedMotion: false })).toBe(
      'demand',
    )
  })
})

describe('<Scene>', () => {
  it('renders an empty box during SSR, so server and client markup match', () => {
    const html = renderToString(
      <Scene className="hero" fallback={<img alt="Acme headset" src="/headset.png" />}>
        <mesh />
      </Scene>,
    )
    expect(html).toContain('data-kitr-scene="server"')
    expect(html).toContain('class="hero"')
    expect(html).not.toContain('<canvas')
    expect(html).not.toContain('<img')
  })

  it('shows the fallback when the browser has no WebGL', () => {
    fakeWebGL(false)
    render(
      <Scene fallback={<img alt="Acme headset" src="/headset.png" />}>
        <mesh />
      </Scene>,
    )
    expect(screen.getByAltText('Acme headset')).toBeTruthy()
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('stops drawing while off screen and starts again when scrolled back', () => {
    fakeWebGL(false)
    mockReducedMotion(false)
    render(<Scene className="hero" />)
    const box = document.querySelector('.hero')!
    expect(box.getAttribute('data-kitr-scene')).toBe('always')
    act(() => intersect(false))
    expect(box.getAttribute('data-kitr-scene')).toBe('never')
    act(() => intersect(true))
    expect(box.getAttribute('data-kitr-scene')).toBe('always')
  })

  it('stops drawing while the tab or app is in the background', () => {
    fakeWebGL(false)
    mockReducedMotion(false)
    render(<Scene className="hero" />)
    const box = document.querySelector('.hero')!
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(box.getAttribute('data-kitr-scene')).toBe('never')
    state.mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(box.getAttribute('data-kitr-scene')).toBe('always')
  })

  it('keeps running off screen with pauseWhenHidden={false}', () => {
    fakeWebGL(false)
    mockReducedMotion(false)
    render(<Scene className="hero" pauseWhenHidden={false} />)
    act(() => intersect(false))
    expect(document.querySelector('.hero')!.getAttribute('data-kitr-scene')).toBe('always')
  })

  it('draws on demand only for visitors who ask for less motion', () => {
    fakeWebGL(false)
    mockReducedMotion(true)
    render(<Scene className="hero" />)
    expect(document.querySelector('.hero')!.getAttribute('data-kitr-scene')).toBe('demand')
  })

  it('ignores the setting with reducedMotion="never"', () => {
    fakeWebGL(false)
    mockReducedMotion(true)
    render(<Scene className="hero" reducedMotion="never" />)
    expect(document.querySelector('.hero')!.getAttribute('data-kitr-scene')).toBe('always')
  })
})

describe('<Scene> in a plain test DOM', () => {
  it('shows the fallback, since happy-dom has no WebGL', async () => {
    resetWebGLCheck()
    render(<Scene fallback={<img alt="The Acme headset" src="/images/headset.jpg" />} />)
    expect(await screen.findByAltText('The Acme headset')).toBeTruthy()
  })
})

describe('useThemeColor', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-theme')
  })

  it('reads a CSS variable and follows theme changes', async () => {
    document.documentElement.style.setProperty('--kitr-color-primary', '#0EA5E9')
    const { result } = renderHook(() => useThemeColor('--kitr-color-primary'))
    expect(result.current).toBe('#0ea5e9')
    await act(async () => {
      document.documentElement.style.setProperty('--kitr-color-primary', '#F97316')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await vi.waitFor(() => expect(result.current).toBe('#f97316'))
  })

  it('returns the fallback when the variable is not set', () => {
    const { result } = renderHook(() => useThemeColor('--acme-brand', '#112233'))
    expect(result.current).toBe('#112233')
  })

  it('leaves hex colours as they are', () => {
    expect(toHexColor(' #ABCDEF ')).toBe('#abcdef')
  })
})

describe('scene components under @react-three/test-renderer', () => {
  it('advances frames without a GPU', async () => {
    function Turntable() {
      const ref = useRef<Mesh>(null)
      useFrame((_, delta) => {
        if (ref.current) ref.current.rotation.y += delta
      })
      return (
        <mesh ref={ref}>
          <boxGeometry />
          <meshStandardMaterial color="#0ea5e9" />
        </mesh>
      )
    }
    const renderer = await ReactThreeTestRenderer.create(<Turntable />)
    const mesh = renderer.scene.children[0]!
    expect(mesh.instance.rotation.y).toBe(0)
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(2, 0.5))
    expect(mesh.instance.rotation.y).toBeCloseTo(1)
    expect(mesh.allChildren.map((child) => child.type)).toEqual([
      'BoxGeometry',
      'MeshStandardMaterial',
    ])
    await renderer.unmount()
  })
})
