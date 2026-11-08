import { createApp } from '@kitr/core'
import { createDevtoolsHub } from '@kitr/devtools'
import * as ui from '@kitr/devtools/ui'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { panels } from '../src/devtools'

afterEach(cleanup)

function setup() {
  const app = createApp({ environment: 'test' })
  const hub = createDevtoolsHub()
  app.container.value('devtools', hub)
  return { app, hub, panel: panels(ui)[0]! }
}

describe('errors panel', () => {
  it('shows an empty state and no badge without errors', () => {
    const { app, panel } = setup()
    render(panel.render(app) as any)
    expect(screen.getByText('No errors')).toBeTruthy()
    expect(panel.badge?.(app)).toBeNull()
  })

  it('lists a logged error with its source, stack toggle and recent breadcrumbs', () => {
    const { app, hub, panel } = setup()
    hub.log('breadcrumbs', 'clicked save')
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at a (a.ts:1:1)\n    at b (b.ts:2:2)'
    hub.log('errors', 'Error: boom', { error, source: 'boundary' }, 'error')
    render(panel.render(app) as any)
    expect(screen.getByText('Error: boom')).toBeTruthy()
    expect(screen.getByText('boundary')).toBeTruthy()
    expect(screen.getAllByText('clicked save').length).toBeGreaterThan(0)
    expect(document.querySelector('.kitr-dt-pre')?.textContent).not.toContain('b.ts')
    fireEvent.click(screen.getByText('more'))
    expect(document.querySelector('.kitr-dt-pre')?.textContent).toContain('b.ts')
    expect(panel.badge?.(app)).toEqual({ value: 1, tone: 'error' })
  })
})
