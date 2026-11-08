import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIpcClient, IPC_BRIDGE_KEY, isElectron } from '../src/client'
import { handleIpc } from '../src/main'
import { allowChannels, exposeIpc, KITR_CHANNELS } from '../src/preload'

type Ipc = {
  'app.version': () => string
  'files.read': (path: string) => Promise<string>
}
type Push = { 'app.focus': (focused: boolean) => void }

/** A fake ipcMain/ipcRenderer pair so the three sides can be exercised in one process. */
function fakeElectron() {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  const listeners = new Map<string, Set<(event: unknown, ...args: unknown[]) => void>>()
  const ipcMain = {
    handle: (channel: string, h: (event: unknown, ...args: unknown[]) => unknown) =>
      void handlers.set(channel, h),
    removeHandler: (channel: string) => void handlers.delete(channel),
  }
  const ipcRenderer = {
    invoke: async (channel: string, ...args: unknown[]) => {
      const h = handlers.get(channel)
      if (!h) throw new Error(`No handler for ${channel}`)
      return h({}, ...args)
    },
    on: (channel: string, l: (event: unknown, ...args: unknown[]) => void) => {
      listeners.set(channel, (listeners.get(channel) ?? new Set()).add(l))
    },
    removeListener: (channel: string, l: (event: unknown, ...args: unknown[]) => void) => {
      listeners.get(channel)?.delete(l)
    },
    send: vi.fn(),
  }
  const contextBridge = {
    exposeInMainWorld: (key: string, value: unknown) => {
      ;(globalThis as any)[key] = value
    },
  }
  const push = (channel: string, ...args: unknown[]) => {
    for (const l of listeners.get(channel) ?? []) l({}, ...args)
  }
  return { ipcMain, ipcRenderer, contextBridge, push }
}

afterEach(() => {
  delete (globalThis as any)[IPC_BRIDGE_KEY]
})

describe('electron ipc', () => {
  it('rejects outside Electron so the web build keeps running', async () => {
    const ipc = createIpcClient<Ipc>()
    expect(ipc.available).toBe(false)
    expect(isElectron()).toBe(false)
    await expect(ipc.invoke('app.version')).rejects.toThrow(/not available/)
    expect(ipc.on('app.focus' as never, () => {})).toBeTypeOf('function')
  })

  // The generated preload exposes only the allowlisted channels.
  it('allowChannels lets through the declared channels and kitr:*, nothing else', () => {
    const allow = allowChannels({ 'app.version': true, 'app.focus': true })
    expect(allow('app.version')).toBe(true)
    expect(allow('app.focus')).toBe(true)
    expect(allow('kitr:storage:load')).toBe(true)
    expect(allow('fs.readFile')).toBe(false)
    expect(allowChannels(['a'])('b')).toBe(false)
  })

  it('lets through the device channels and refuses a kitr: name it does not know', () => {
    const allow = allowChannels([])
    for (const channel of [
      'kitr:secure:get',
      'kitr:notify:show',
      'kitr:notify:click',
      'kitr:files:read',
      'kitr:updater:progress',
      'kitr:native:power',
      'kitr:shell:open',
    ])
      expect(allow(channel), channel).toBe(true)
    expect(allow('kitr:secure:dump')).toBe(false)
    expect(allow('kitr:files:read-anything')).toBe(false)
    expect(KITR_CHANNELS.size).toBeGreaterThan(30)
  })

  it('round-trips typed commands and events through preload', async () => {
    const e = fakeElectron()
    const dispose = handleIpc<Ipc>(e.ipcMain as any, {
      'app.version': () => '1.2.3',
      'files.read': async (_event, path) => `contents of ${path}`,
    })
    exposeIpc(e.contextBridge as any, e.ipcRenderer as any, { allow: (c) => c !== 'secret' })
    const ipc = createIpcClient<Ipc, Push>()
    expect(ipc.available).toBe(true)
    expect(isElectron()).toBe(true)
    expect(await ipc.invoke('app.version')).toBe('1.2.3')
    expect(await ipc.invoke('files.read', '/tmp/a')).toBe('contents of /tmp/a')
    await expect((ipc as any).invoke('secret')).rejects.toThrow(/not allowed/)
    const seen: boolean[] = []
    const off = ipc.on('app.focus', (focused) => seen.push(focused))
    e.push('app.focus', true)
    off()
    e.push('app.focus', false)
    expect(seen).toEqual([true])
    dispose()
    await expect(ipc.invoke('app.version')).rejects.toThrow(/No handler/)
  })
})
