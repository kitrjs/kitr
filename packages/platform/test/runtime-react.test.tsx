import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createPlatform, type PlatformDriver } from '../src'
import { useRuntime } from '../src/react'

function Show() {
  return <p data-testid="runtime">{useRuntime()}</p>
}

describe('useRuntime', () => {
  it('detects the runtime when the platform provider is not registered', async () => {
    const app = createApp({ environment: 'test' })
    await app.boot()
    render(
      <KitrProvider app={app}>
        <Show />
      </KitrProvider>,
    )
    expect(screen.getByTestId('runtime').textContent).toBe('web')
  })

  it("answers the registered platform's runtime", async () => {
    const app = createApp({ environment: 'test' })
    const driver: PlatformDriver = {
      type: 'mobile',
      native: true,
      runtime: 'capacitor',
      os: () => 'ios',
    }
    app.drivers.register('platform', driver)
    app.container.singleton('platform', () => createPlatform(app))
    await app.boot()
    render(
      <KitrProvider app={app}>
        <Show />
      </KitrProvider>,
    )
    expect(screen.getByTestId('runtime').textContent).toBe('capacitor')
  })
})
