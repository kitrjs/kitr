import { describe, expect, it } from 'vitest'
import { definePlatform } from '../src/platform'
import { schemaFrom } from '../src/schema'

describe('definePlatform: without', () => {
  // A strict schema: an unknown key is an error, so `without` must never reach it.
  const strict = schemaFrom<unknown, { port: number }>((value) => {
    const v = value as Record<string, unknown>
    const extra = Object.keys(v).filter((k) => k !== 'port')
    if (extra.length) return { issues: [{ message: `unknown ${extra.join(', ')}` }] }
    return { port: typeof v.port === 'number' ? v.port : 3000 }
  })
  const kiosk = definePlatform(
    {
      type: 'kiosk',
      options: strict,
      describe: { port: { description: 'Port', type: 'number', default: 3000 } },
    },
    (options) => ({ agents: `port ${options.port}` }),
  )

  it('takes `without` out before the package schema validates the rest', () => {
    const p = kiosk({ port: 4000, without: ['analytics', 'consent'] })
    expect(p.options).toEqual({ port: 4000 })
    expect(p.input).toEqual({ port: 4000 })
    expect(p.without).toEqual(['analytics', 'consent'])
    expect(p.agents).toBe('port 4000')
  })

  it('defaults to an empty list', () => {
    expect(kiosk().without).toEqual([])
    expect(kiosk({ port: 1 }).without).toEqual([])
  })

  it('keeps `without` through with(), and lets with() replace it', () => {
    const p = kiosk({ without: ['analytics'] })
    expect(p.with({ port: 5000 }).without).toEqual(['analytics'])
    expect(p.with({ port: 5000 }).options.port).toBe(5000)
    expect(p.with({ without: ['consent'] }).without).toEqual(['consent'])
    expect(p.with({ without: undefined }).without).toEqual([])
  })

  it('throws a clear error when `without` is not a list of names', () => {
    expect(() => kiosk({ without: 'analytics' as never })).toThrow(
      /kiosk platform:[\s\S]*without: expected a list of package names/,
    )
    expect(() => kiosk({ without: [1] as never })).toThrow(/without: expected a list/)
    expect(() => kiosk({ without: [''] })).toThrow(/without: expected a list/)
  })

  it('lists `without` in describe for every platform, next to its own options', () => {
    const describeTable = kiosk().definition.describe!
    expect(Object.keys(describeTable)).toEqual(['port', 'without'])
    expect(describeTable.without).toEqual({
      description: "Packages left out of this platform's build (their provider and config file)",
      type: 'list',
      default: [],
    })
    const bare = definePlatform({ type: 'bare' }, () => ({}))
    expect(bare().definition.describe?.without?.type).toBe('list')
  })
})
