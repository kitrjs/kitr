import { createApp } from '@kitr/core'
import { createDevtoolsHub } from '@kitr/devtools'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { panels } from '../src/devtools'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

function setup() {
  const app = createApp({ providers: [] })
  app.container.value('devtools', createDevtoolsHub())
  return app
}

describe('storage devtools panel', () => {
  it('badges the key count and clears when empty', () => {
    const panel = panels()[0]
    expect(panel?.group).toBe('data')
    expect(panel?.badge?.(setup())).toBeNull()
    localStorage.setItem('a', '1')
    sessionStorage.setItem('b', '2')
    expect(panel?.badge?.(setup())).toEqual({ value: 2, tone: 'muted' })
  })

  it('saves and removes a key', () => {
    localStorage.setItem('theme', '"dark"')
    const app = setup()
    render(<div>{panels()[0]?.render(app)}</div>)
    fireEvent.click(screen.getByText('theme'))
    const area = screen.getByLabelText('Value of theme') as HTMLTextAreaElement
    expect(area.value).toBe('"dark"')

    fireEvent.change(area, { target: { value: '"light"' } })
    fireEvent.click(screen.getByText('Save'))
    expect(localStorage.getItem('theme')).toBe('"light"')

    fireEvent.click(screen.getByText('Remove'))
    expect(localStorage.getItem('theme')).toBeNull()
    expect(screen.queryByText('theme')).toBeNull()
  })

  it('clears local storage from the panel action', async () => {
    localStorage.setItem('x', '1')
    const app = setup()
    await act(async () => {
      await panels()[0]
        ?.actions?.find((a) => a.id === 'clear-local')
        ?.run(app)
    })
    expect(localStorage.length).toBe(0)
  })
})
