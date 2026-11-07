import { afterEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn(async (cmd: string, args?: unknown) => ({ cmd, args }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

const { commandMutation, commandQuery, defineCommands, emitTauri, isTauri } = await import(
  '../src/tauri'
)

afterEach(() => {
  delete (globalThis as any).window
})

type Commands = { greet: (args: { name: string }) => string; ping: () => number }

describe('defineCommands', () => {
  it('invokes Rust commands by name', async () => {
    const commands = defineCommands<Commands>()
    expect(await commands.greet({ name: 'kitr' })).toEqual({ cmd: 'greet', args: { name: 'kitr' } })
  })

  it('can be awaited and serialised without invoking commands', async () => {
    const commands = defineCommands<Commands>()
    invoke.mockClear()
    const same = await (async () => commands)()
    expect(same).toBe(commands)
    expect(JSON.stringify({ commands })).toBe('{"commands":{}}')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('builds query and mutation contracts', async () => {
    const commands = defineCommands<Commands>()
    const q = commandQuery(commands.greet, 'greet')
    expect(q.key({ name: 'a' })).toEqual(['tauri', 'greet', { name: 'a' }])
    expect(q.source).toBe('tauri')
    expect(await q.fetch({ name: 'a' }, {})).toMatchObject({ cmd: 'greet' })
    const m = commandMutation(commands.greet, { effects: { invalidate: [['x']] } })
    expect(m.effects).toEqual({ invalidate: [['x']] })
    expect(await m.mutate({ name: 'b' })).toMatchObject({ args: { name: 'b' } })
  })
})

describe('environment', () => {
  it('detects the Tauri webview and no-ops events in a browser', async () => {
    expect(isTauri()).toBe(false)
    await expect(emitTauri('x', 1)).resolves.toBeUndefined()
    ;(globalThis as any).window = { __TAURI_INTERNALS__: {} }
    expect(isTauri()).toBe(true)
  })
})
