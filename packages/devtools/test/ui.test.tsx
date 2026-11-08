import type { DevtoolsEntry } from '@kitr/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Chip, JsonView, LogList, Masked, preview, styles, tones } from '../src/ui'

const entry = (over: Record<string, unknown>): DevtoolsEntry =>
  ({ id: 1, channel: 'http', time: 1000, level: 'info', label: 'GET /x', ...over }) as DevtoolsEntry

describe('ui kit', () => {
  it('JsonView expands a collapsed node', () => {
    render(<JsonView value={{ a: { b: 1 } }} />)
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.queryByText('b')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /\{1\}/ })[1] as HTMLElement)
    expect(screen.getByText('b')).toBeTruthy()
  })

  it('LogList shows a preview and expands on click', () => {
    render(<LogList entries={[entry({ data: { ok: true } })]} />)
    expect(screen.getByText('{"ok":true}')).toBeTruthy()
    fireEvent.click(screen.getByText('GET /x'))
    expect(screen.queryByText('{"ok":true}')).toBeNull()
    expect(screen.getByText('ok')).toBeTruthy()
  })

  it('LogList renders marks as dividers and counts as xN', () => {
    const { container } = render(
      <LogList
        entries={[entry({ id: 1, kind: 'mark', label: 'Reload' }), entry({ id: 2, count: 3 })]}
      />,
    )
    expect(container.querySelector('.kitr-dt-mark')?.textContent).toBe('Reload')
    expect(screen.getByText('×3')).toBeTruthy()
  })

  it('LogList shows relative deltas and a clickable channel', () => {
    const onChannel = vi.fn()
    render(
      <LogList
        relative
        onChannel={onChannel}
        entries={[entry({ id: 1 }), entry({ id: 2, time: 1300 })]}
      />,
    )
    expect(screen.getByText('+0.3s')).toBeTruthy()
    fireEvent.click(screen.getAllByText('http')[0] as HTMLElement)
    expect(onChannel).toHaveBeenCalledWith('http')
  })

  it('Chip toggles', () => {
    function Demo() {
      const [on, setOn] = useState(false)
      return (
        <Chip on={on} count={2} onClick={() => setOn(!on)}>
          err
        </Chip>
      )
    }
    render(<Demo />)
    const chip = screen.getByRole('button', { name: /err/ })
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(chip.className).toContain('kitr-dt-chip-on')
  })

  it('Masked reveals its value', () => {
    render(<Masked value="secret" />)
    expect(screen.queryByText('secret')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal value' }))
    expect(screen.getByText('secret')).toBeTruthy()
  })

  it('preview truncates and tones/styles are exported', () => {
    expect(preview({ a: 1 })).toBe('{"a":1}')
    expect(preview('x'.repeat(100))).toHaveLength(81)
    expect(preview('x'.repeat(100), 10).endsWith('…')).toBe(true)
    expect(tones).toHaveLength(5)
    expect(styles).toContain('.kitr-dt-chip')
  })
})
