import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '../src'

afterEach(() => vi.restoreAllMocks())

// In the browser `process` is undefined; the logger must still detect the browser and print
// no ANSI escape codes.
describe('logger in the browser', () => {
  it('writes the message and fields to the matching console method, without ANSI', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = createLogger({ name: 'app' })
    log.info('signed in', { userId: 'u1' })
    log.error(new Error('boom'))
    expect(info).toHaveBeenCalledWith('[app] signed in', { userId: 'u1' })
    expect(String(info.mock.calls[0]![0])).not.toContain('\x1b')
    expect(error.mock.calls[0]![0]).toBe('[app] boom')
    expect(error.mock.calls[0]![1]).toMatchObject({ err: { message: 'boom' } })
  })

  it('still honours an explicit format', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {})
    createLogger({ format: 'json' }).info('x')
    expect(JSON.parse(String(out.mock.calls[0]![0]))).toMatchObject({ msg: 'x', level: 'info' })
  })
})
