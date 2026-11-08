import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* ------------------------------------------------------------------ a fake `electron` module */

const sent: Array<[string, ...unknown[]]> = []
const win = {
  isDestroyed: () => false,
  isMinimized: vi.fn(() => true),
  restore: vi.fn(),
  show: vi.fn(),
  focus: vi.fn(),
  webContents: { send: (...args: [string, ...unknown[]]) => sent.push(args) },
}
const notifications: FakeNotification[] = []
class FakeNotification {
  static supported = true
  static isSupported = () => FakeNotification.supported
  handlers = new Map<string, () => void>()
  closed = false
  shown = false
  constructor(public options: Record<string, unknown>) {
    notifications.push(this)
  }
  on(event: string, handler: () => void) {
    this.handlers.set(event, handler)
  }
  show() {
    this.shown = true
  }
  close() {
    this.closed = true
    this.handlers.get('close')?.()
  }
}

const vault = {
  available: true,
  backend: 'gnome_libsecret',
  isEncryptionAvailable: () => vault.available,
  getSelectedStorageBackend: () => vault.backend,
  encryptString: (text: string) => Buffer.from(`enc:${text}`),
  decryptString: (data: Buffer) => {
    const text = data.toString()
    if (!text.startsWith('enc:')) throw new Error('bad ciphertext')
    return text.slice(4)
  },
}
const dialog = {
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
}
const shell = { openExternal: vi.fn(async () => {}), openPath: vi.fn(async () => '') }
const clipboard = {
  text: '',
  readText: () => clipboard.text,
  writeText: (t: string) => (clipboard.text = t),
}
const touchId = { can: true, promptTouchID: vi.fn(async () => {}) }
const systemPreferences = {
  canPromptTouchID: () => touchId.can,
  promptTouchID: touchId.promptTouchID,
}
const net = { isOnline: vi.fn(() => true) }
const themeListeners = new Set<() => void>()
const nativeTheme = {
  shouldUseDarkColors: true,
  on: (_: string, l: () => void) => themeListeners.add(l),
  removeListener: (_: string, l: () => void) => themeListeners.delete(l),
}
const powerListeners = new Map<string, () => void>()
const powerMonitor = {
  on: (event: string, l: () => void) => powerListeners.set(event, l),
  removeListener: (event: string) => powerListeners.delete(event),
  isOnBatteryPower: () => true,
}
const autoUpdater = {
  autoDownload: true,
  handlers: new Map<string, (...args: any[]) => void>(),
  on(event: string, handler: (...args: any[]) => void) {
    this.handlers.set(event, handler)
  },
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(async () => {}),
  quitAndInstall: vi.fn(),
}

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [win] },
  Notification: FakeNotification,
  safeStorage: vault,
  dialog,
  shell,
  clipboard,
  systemPreferences,
  net,
  nativeTheme,
  powerMonitor,
}))
vi.mock('electron-updater', () => ({ autoUpdater }))

const { handleKitrDevices, handleKitrIpc, EXTERNAL_PROTOCOLS } = await import('../src/main')

/* ------------------------------------------------------------------ harness */

let dir: string
let handlers: Map<string, (event: unknown, ...args: any[]) => unknown>
let dispose: () => void
const app = { setBadgeCount: vi.fn(), getVersion: () => '1.4.0', quit: vi.fn(), getPath: () => dir }

const extra: Array<() => void> = []
type Handlers = Map<string, (event: unknown, ...args: any[]) => unknown>
/** A second handler set, as a new app run would make; disposed after the test. */
function another(kind: 'devices' | 'ipc' = 'devices', options: Record<string, unknown> = {}) {
  const map: Handlers = new Map()
  const ipcMain = {
    handle: (c: string, h: never) => void map.set(c, h),
    removeHandler: (c: string) => void map.delete(c),
  } as never
  const off =
    kind === 'ipc'
      ? handleKitrIpc(ipcMain, app as never, options)
      : handleKitrDevices(ipcMain, app as never, options)
  extra.push(off)
  return { map, off }
}

const call = (channel: string, ...args: unknown[]) => {
  const h = handlers.get(channel)
  if (!h) throw new Error(`No handler for ${channel}`)
  return Promise.resolve(h({}, ...args))
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'kitr-desktop-'))
  handlers = new Map()
  sent.length = 0
  notifications.length = 0
  vault.available = true
  vault.backend = 'gnome_libsecret'
  FakeNotification.supported = true
  dispose = handleKitrDevices(
    {
      handle: (channel: string, h: never) => void handlers.set(channel, h),
      removeHandler: (channel: string) => void handlers.delete(channel),
    } as never,
    app as never,
  )
  // The power and theme listeners register once electron resolves.
  await vi.waitFor(() => expect(powerListeners.size).toBe(4))
})

afterEach(async () => {
  dispose()
  for (const off of extra.splice(0)) off()
  vi.useRealTimers()
  vi.clearAllMocks()
  await rm(dir, { recursive: true, force: true })
})

/* ------------------------------------------------------------------ tests */

describe('secure storage handlers', () => {
  it('keeps only ciphertext on disk and reads it back', async () => {
    await call('kitr:secure:set', 'token', 'hunter2')
    const file = await readFile(join(dir, 'kitr-secure-storage.json'), 'utf8')
    expect(file).not.toContain('hunter2')
    expect(JSON.parse(file).token).toBe(Buffer.from('enc:hunter2').toString('base64'))
    expect(await call('kitr:secure:get', 'token')).toBe('hunter2')
    expect(await call('kitr:secure:keys')).toEqual(['token'])
    await call('kitr:secure:remove', 'token')
    expect(await call('kitr:secure:get', 'token')).toBeNull()
    expect(await call('kitr:secure:keys')).toEqual([])
  })

  it('reloads the file a previous run wrote', async () => {
    await writeFile(
      join(dir, 'kitr-secure-storage.json'),
      JSON.stringify({ old: Buffer.from('enc:from last time').toString('base64') }),
    )
    // A fresh handler set has no cache.
    const second = another().map
    expect(await second.get('kitr:secure:get')!({}, 'old')).toBe('from last time')
  })

  it('answers null for a value that no longer decrypts (another user or machine)', async () => {
    await writeFile(
      join(dir, 'kitr-secure-storage.json'),
      JSON.stringify({ stale: Buffer.from('garbage').toString('base64') }),
    )
    const second = another().map
    expect(await second.get('kitr:secure:get')!({}, 'stale')).toBeNull()
  })

  it('refuses to store when the OS has no vault', async () => {
    vault.available = false
    await expect(call('kitr:secure:set', 'k', 'v')).rejects.toThrow(/no secret vault/)
  })

  it('refuses the Linux basic_text fallback, which is not a vault', async () => {
    vault.backend = 'basic_text'
    await expect(call('kitr:secure:set', 'k', 'v')).rejects.toThrow(/no secret vault/)
  })
})

describe('notification handlers', () => {
  it('permission is granted on desktop, unsupported without a notification service', async () => {
    expect(await call('kitr:notify:permission')).toBe('granted')
    FakeNotification.supported = false
    expect(await call('kitr:notify:permission')).toBe('unsupported')
  })

  it('shows a notification and forwards click and close to the windows', async () => {
    await call('kitr:notify:show', {
      id: 'n1',
      title: 'Hi',
      body: 'There',
      silent: true,
      url: '/x',
      data: { a: 1 },
    })
    const [n] = notifications
    expect(n!.options).toEqual({ title: 'Hi', body: 'There', silent: true })
    expect(n!.shown).toBe(true)
    n!.handlers.get('click')!()
    await vi.waitFor(() =>
      expect(sent).toContainEqual(['kitr:notify:click', { id: 'n1', url: '/x', data: { a: 1 } }]),
    )
    expect(win.restore).toHaveBeenCalled()
    expect(win.focus).toHaveBeenCalled()
    n!.close()
    await vi.waitFor(() => expect(sent).toContainEqual(['kitr:notify:close', { id: 'n1' }]))
  })

  it('replaces a notification shown with the same id, and shows nothing where unsupported', async () => {
    await call('kitr:notify:show', { id: 'same', title: 'One' })
    await call('kitr:notify:show', { id: 'same', title: 'Two' })
    expect(notifications[0]!.closed).toBe(true)
    expect(notifications).toHaveLength(2)
    FakeNotification.supported = false
    await call('kitr:notify:show', { id: 'other', title: 'Three' })
    expect(notifications).toHaveLength(2)
  })

  it('schedules in main, lists the pending ids, shows at the time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    await call('kitr:notify:schedule', { id: 'later', title: 'Later', at: Date.now() + 5000 })
    expect(await call('kitr:notify:pending')).toEqual(['later'])
    await vi.advanceTimersByTimeAsync(4000)
    expect(notifications).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1500)
    expect(notifications).toHaveLength(1)
    expect(await call('kitr:notify:pending')).toEqual([])
  })

  it('waits in steps for a time past the setTimeout limit', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    const month = 30 * 24 * 3600 * 1000
    await call('kitr:notify:schedule', { id: 'far', title: 'Far', at: Date.now() + month })
    await vi.advanceTimersByTimeAsync(2 ** 31 - 1)
    expect(notifications).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(month)
    expect(notifications).toHaveLength(1)
  })

  it('cancels one and cancels all', async () => {
    vi.useFakeTimers()
    await call('kitr:notify:schedule', { id: 'a', title: 'A', at: Date.now() + 1000 })
    await call('kitr:notify:schedule', { id: 'b', title: 'B', at: Date.now() + 1000 })
    await call('kitr:notify:show', { id: 'shown', title: 'S' })
    await call('kitr:notify:cancel', 'a')
    expect(await call('kitr:notify:pending')).toEqual(['b'])
    await call('kitr:notify:cancel', 'shown')
    expect(notifications[0]!.closed).toBe(true)
    await call('kitr:notify:show', { id: 'again', title: 'S2' })
    await call('kitr:notify:cancel-all')
    expect(await call('kitr:notify:pending')).toEqual([])
    expect(notifications[1]!.closed).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(notifications).toHaveLength(2)
  })

  it('sets the badge to a non-negative whole number', async () => {
    await call('kitr:notify:badge', 3.7)
    await call('kitr:notify:badge', -2)
    expect(app.setBadgeCount.mock.calls).toEqual([[3], [0]])
  })
})

describe('file handlers', () => {
  it('reads, stats and writes only paths a dialog returned', async () => {
    const file = join(dir, 'notes.md')
    await writeFile(file, '# Notes')
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [file] })
    const [entry] = (await call('kitr:files:open', {
      title: 'Open',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })) as Array<{ path: string; name: string; size: number }>
    expect(entry).toMatchObject({ path: file, name: 'notes.md', size: 7, isDirectory: false })
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({
      title: 'Open',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      properties: ['openFile'],
    })
    expect(Buffer.from((await call('kitr:files:read', file)) as Uint8Array).toString()).toBe(
      '# Notes',
    )
    await call('kitr:files:write', file, new TextEncoder().encode('changed'))
    expect(await readFile(file, 'utf8')).toBe('changed')
    expect(await call('kitr:files:stat', file)).toMatchObject({ size: 7 })
  })

  it('refuses every other path, including traversal out of a picked folder', async () => {
    const outside = join(dir, 'secret.txt')
    await writeFile(outside, 'secret')
    await expect(call('kitr:files:read', outside)).rejects.toThrow(/not chosen in a dialog/)
    await expect(call('kitr:files:write', outside, new Uint8Array())).rejects.toThrow(/not chosen/)
    await expect(call('kitr:files:stat', outside)).rejects.toThrow(/not chosen/)
    await expect(call('kitr:files:list', dir)).rejects.toThrow(/not chosen/)
    await expect(call('kitr:files:reveal', outside)).rejects.toThrow(/not chosen/)

    const picked = join(dir, 'docs')
    await writeFile(join(dir, 'also-secret.txt'), 'x')
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [picked] })
    await call('kitr:files:open', { directory: true }).catch(() => {})
    await expect(call('kitr:files:read', join(picked, '..', 'also-secret.txt'))).rejects.toThrow(
      /not chosen/,
    )
  })

  it('lists a picked folder and reads files inside it', async () => {
    await writeFile(join(dir, 'a.txt'), 'A')
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [dir] })
    const [folder] = (await call('kitr:files:open', { directory: true, multiple: true })) as Array<{
      isDirectory: boolean
    }>
    expect(folder!.isDirectory).toBe(true)
    expect(dialog.showOpenDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ properties: ['openDirectory', 'multiSelections'] }),
    )
    const names = ((await call('kitr:files:list', dir)) as Array<{ name: string }>).map(
      (e) => e.name,
    )
    expect(names).toContain('a.txt')
    expect(
      Buffer.from((await call('kitr:files:read', join(dir, 'a.txt'))) as Uint8Array).toString(),
    ).toBe('A')
  })

  it('answers [] when the open dialog is cancelled', async () => {
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await call('kitr:files:open', {})).toEqual([])
  })

  it('grants the path of a save dialog, and nothing when it is cancelled', async () => {
    const target = join(dir, 'out.txt')
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: target })
    expect(await call('kitr:files:choose-save', { name: 'out.txt', title: 'Save' })).toBe(target)
    expect(dialog.showSaveDialog).toHaveBeenCalledWith({
      title: 'Save',
      defaultPath: 'out.txt',
      filters: undefined,
    })
    await call('kitr:files:write', target, new TextEncoder().encode('saved'))
    expect(await readFile(target, 'utf8')).toBe('saved')
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    expect(await call('kitr:files:choose-save', { name: 'x' })).toBeNull()
  })

  it('opens a granted path with the default app, and reports a failure', async () => {
    const target = join(dir, 'doc.pdf')
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: target })
    await call('kitr:files:choose-save', { name: 'doc.pdf' })
    await call('kitr:files:reveal', target)
    expect(shell.openPath).toHaveBeenCalledWith(target)
    shell.openPath.mockResolvedValueOnce('no app' as never)
    await expect(call('kitr:files:reveal', target)).rejects.toThrow('no app')
  })
})

describe('updater handlers', () => {
  it('checks, maps the update info and turns autoDownload off', async () => {
    autoUpdater.checkForUpdates.mockResolvedValueOnce({
      isUpdateAvailable: true,
      updateInfo: {
        version: '2.0.0',
        releaseNotes: [{ note: 'Faster' }, { note: null }, { note: 'Smaller' }],
        releaseDate: '2030-01-01',
        files: [{ size: 1024 }],
      },
    })
    expect(await call('kitr:updater:check')).toEqual({
      version: '2.0.0',
      notes: 'Faster\n\nSmaller',
      date: '2030-01-01',
      size: 1024,
    })
    expect(autoUpdater.autoDownload).toBe(false)
  })

  it('maps string notes, and answers null when current or in development', async () => {
    autoUpdater.checkForUpdates.mockResolvedValueOnce({
      isUpdateAvailable: true,
      updateInfo: { version: '2.1.0', releaseNotes: 'Plain' },
    })
    expect(await call('kitr:updater:check')).toMatchObject({ version: '2.1.0', notes: 'Plain' })
    autoUpdater.checkForUpdates.mockResolvedValueOnce({
      isUpdateAvailable: false,
      updateInfo: { version: '1.0.0' },
    })
    expect(await call('kitr:updater:check')).toBeNull()
    autoUpdater.checkForUpdates.mockResolvedValueOnce(null)
    expect(await call('kitr:updater:check')).toBeNull()
  })

  it('downloads, installs and forwards progress and availability to the windows', async () => {
    autoUpdater.checkForUpdates.mockResolvedValueOnce(null)
    await call('kitr:updater:check')
    await call('kitr:updater:download')
    await call('kitr:updater:install')
    expect(autoUpdater.downloadUpdate).toHaveBeenCalled()
    expect(autoUpdater.quitAndInstall).toHaveBeenCalled()
    autoUpdater.handlers.get('download-progress')!({ percent: 50 })
    autoUpdater.handlers.get('update-available')!({ version: '3.0.0' })
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[0]).toEqual(['kitr:updater:progress', 0.5])
    expect(sent[1]![0]).toBe('kitr:updater:available')
    expect(sent[1]![1]).toMatchObject({ version: '3.0.0' })
  })
})

describe('native handlers', () => {
  it('reads and writes the clipboard', async () => {
    await call('kitr:native:clipboard-write', 'hello')
    expect(await call('kitr:native:clipboard-read')).toBe('hello')
  })

  it('prompts Touch ID on macOS and answers false elsewhere', async () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
    try {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      expect(await call('kitr:native:biometrics-available')).toBe(true)
      expect(await call('kitr:native:biometrics-prompt', 'unlock')).toBe(true)
      expect(touchId.promptTouchID).toHaveBeenCalledWith('unlock')
      await call('kitr:native:biometrics-prompt')
      expect(touchId.promptTouchID).toHaveBeenLastCalledWith('confirm it is you')
      touchId.promptTouchID.mockRejectedValueOnce(new Error('cancelled'))
      expect(await call('kitr:native:biometrics-prompt', 'x')).toBe(false)
      touchId.can = false
      expect(await call('kitr:native:biometrics-available')).toBe(false)
      expect(await call('kitr:native:biometrics-prompt', 'x')).toBe(false)
      touchId.can = true
      Object.defineProperty(process, 'platform', { value: 'linux' })
      expect(await call('kitr:native:biometrics-available')).toBe(false)
    } finally {
      Object.defineProperty(process, 'platform', platform)
    }
  })

  it('reports platform, version, online status, theme and battery', async () => {
    expect(await call('kitr:native:info')).toEqual({
      platform: process.platform,
      version: '1.4.0',
      online: true,
      dark: true,
    })
    net.isOnline.mockReturnValueOnce(false)
    expect(await call('kitr:native:online')).toBe(false)
    expect(await call('kitr:native:on-battery')).toBe(true)
  })

  it('broadcasts power and theme changes to the windows', async () => {
    for (const event of ['suspend', 'resume', 'on-battery', 'on-ac']) powerListeners.get(event)!()
    for (const l of themeListeners) l()
    await vi.waitFor(() => expect(sent).toHaveLength(5))
    expect(sent.slice(0, 4).map((s) => s[1])).toEqual(['suspend', 'resume', 'battery', 'ac'])
    expect(sent[4]).toEqual(['kitr:native:theme', true])
  })
})

describe('handleKitrIpc', () => {
  it('opens only http, https, mailto and tel links', async () => {
    const { map: all, off } = another('ipc')
    expect(EXTERNAL_PROTOCOLS).toContain('https:')
    await all.get('kitr:shell:open')!({}, 'https://acme.com')
    expect(shell.openExternal).toHaveBeenCalledWith('https://acme.com')
    await expect(all.get('kitr:shell:open')!({}, 'file:///etc/passwd')).rejects.toThrow(
      /not allowed/,
    )
    await expect(all.get('kitr:shell:open')!({}, 'javascript:alert(1)')).rejects.toThrow(
      /not allowed/,
    )
    await expect(all.get('kitr:shell:open')!({}, 'nope')).rejects.toThrow(/not a URL/)
    expect(shell.openExternal).toHaveBeenCalledTimes(1)
    expect(all.has('kitr:secure:get')).toBe(true)
    off()
    expect(all.has('kitr:secure:get')).toBe(false)
  })

  it('takes the protocols and files from the options', async () => {
    const { map: all } = another('ipc', {
      externalProtocols: ['acme:'],
      secureFile: join(dir, 'vault.json'),
      storageFile: join(dir, 's.json'),
    })
    await all.get('kitr:shell:open')!({}, 'acme://open')
    expect(shell.openExternal).toHaveBeenCalledWith('acme://open')
    await all.get('kitr:secure:set')!({}, 'k', 'v')
    expect(JSON.parse(await readFile(join(dir, 'vault.json'), 'utf8'))).toHaveProperty('k')
    await all.get('kitr:storage:set')!({}, 'a', 'b')
    expect(await all.get('kitr:storage:load')!({})).toEqual({ a: 'b' })
    await all.get('kitr:storage:remove')!({}, 'a')
    expect(await all.get('kitr:storage:load')!({})).toEqual({})
    expect(all.get('kitr:app:version')!({})).toBe('1.4.0')
    all.get('kitr:app:quit')!({})
    expect(app.quit).toHaveBeenCalled()
  })

  it('removes its handlers, timers and listeners when disposed', async () => {
    vi.useFakeTimers()
    await call('kitr:notify:schedule', { id: 'x', title: 'X', at: Date.now() + 1000 })
    dispose()
    expect(handlers.size).toBe(0)
    expect(powerListeners.size).toBe(0)
    expect(themeListeners.size).toBe(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(notifications).toHaveLength(0)
    dispose = () => {}
  })
})
