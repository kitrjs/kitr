import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

// A DOM stand-in for the canvas: happy-dom has no WebGL and gives the canvas no size, so
// React Three Fiber would never render the scene's children here.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, frameloop }: { children: ReactNode; frameloop: string }) => (
    <div data-testid="canvas" data-frameloop={frameloop}>
      {children}
    </div>
  ),
  useThree: () => () => {},
}))
vi.mock('@react-three/drei', () => ({ PerformanceMonitor: () => null }))

const { Scene, resetWebGLCheck } = await import('../src')

const realGetContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = ((kind: string) =>
  kind.startsWith('webgl')
    ? ({ getParameter: () => 0, getExtension: () => null } as never)
    : null) as never
resetWebGLCheck()

afterEach(() => {
  vi.restoreAllMocks()
})

describe('<Scene> with WebGL', () => {
  it('renders the canvas with the frame loop it resolved', () => {
    render(
      <Scene>
        <p>Acme headset</p>
      </Scene>,
    )
    expect(screen.getByTestId('canvas').getAttribute('data-frameloop')).toBeTruthy()
    expect(screen.getByText('Acme headset')).toBeTruthy()
  })

  it('shows the fallback and reports the error when the scene throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    function Headset(): never {
      throw new Error('Could not load /models/headset.glb: 404')
    }
    render(
      <Scene fallback={<p>3D preview unavailable</p>} onError={onError}>
        <Headset />
      </Scene>,
    )
    expect(screen.getByText('3D preview unavailable')).toBeTruthy()
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('headset.glb') }),
    )
  })

  it('logs the error when there is no onError', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Headset(): never {
      throw new Error('WebGL context lost')
    }
    render(
      <Scene fallback={<p>3D preview unavailable</p>}>
        <Headset />
      </Scene>,
    )
    expect(log.mock.calls.some((args) => String(args[0]).includes('[@kitr/3d]'))).toBe(true)
  })

  it('shows `loading` while a child suspends', () => {
    const pending = new Promise(() => {})
    function Headset(): never {
      throw pending
    }
    render(
      <Scene loading={<p>Loading headset</p>}>
        <Headset />
      </Scene>,
    )
    expect(screen.getByText('Loading headset')).toBeTruthy()
  })
})

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext
  resetWebGLCheck()
})
