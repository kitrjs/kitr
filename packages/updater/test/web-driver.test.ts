import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServiceWorkerUpdaterDriver } from '../src/drivers/web'

type Handler = () => void

function fakeWorker() {
  const handlers = new Map<string, Handler>()
  return {
    state: 'installing',
    postMessage: vi.fn(),
    addEventListener: (name: string, h: Handler) => handlers.set(name, h),
    fire: (name: string) => handlers.get(name)?.(),
  }
}

function fakeRegistration(waiting: unknown = null) {
  const handlers = new Map<string, Handler>()
  const reg = {
    waiting,
    installing: null as ReturnType<typeof fakeWorker> | null,
    update: vi.fn(async () => {}),
    addEventListener: (name: string, h: Handler) => handlers.set(name, h),
    fire: (name: string) => handlers.get(name)?.(),
  }
  return reg
}

function stubServiceWorker(
  reg: ReturnType<typeof fakeRegistration> | undefined,
  controller: unknown = {},
) {
  const listeners = new Map<string, Handler>()
  const api = {
    controller,
    getRegistration: vi.fn(async () => reg),
    addEventListener: (name: string, h: Handler) => listeners.set(name, h),
    fire: (name: string) => listeners.get(name)?.(),
  }
  vi.stubGlobal('navigator', { serviceWorker: api })
  return api
}

afterEach(() => vi.unstubAllGlobals())

describe('service worker updater driver', () => {
  it('reports nothing without service worker support or a registration', async () => {
    vi.stubGlobal('navigator', {})
    const bare = createServiceWorkerUpdaterDriver({ version: '1.0.0' })
    expect(bare.name).toBe('service-worker')
    expect(await bare.check()).toBeNull()
    await expect(bare.apply()).resolves.toBeUndefined()
    expect(await bare.currentVersion()).toBe('1.0.0')

    stubServiceWorker(undefined)
    expect(await createServiceWorkerUpdaterDriver().check()).toBeNull()
    expect(await createServiceWorkerUpdaterDriver().currentVersion()).toBe('0.0.0')
  })

  it('check updates the registration and reports a waiting worker', async () => {
    const reg = fakeRegistration(fakeWorker())
    stubServiceWorker(reg)
    expect(await createServiceWorkerUpdaterDriver({ version: '2.0.0' }).check()).toEqual({
      version: '2.0.0+',
    })
    expect(reg.update).toHaveBeenCalled()
    expect(await createServiceWorkerUpdaterDriver().check()).toEqual({ version: 'new' })
    stubServiceWorker(fakeRegistration(null))
    expect(await createServiceWorkerUpdaterDriver().check()).toBeNull()
  })

  it('announces a waiting worker and a newly installed one to listeners', async () => {
    const reg = fakeRegistration(fakeWorker())
    stubServiceWorker(reg)
    const driver = createServiceWorkerUpdaterDriver({ version: '3.0.0' })
    const seen: string[] = []
    const off = driver.onAvailable((info) => seen.push(info.version))
    await vi.waitFor(() => expect(seen).toEqual(['3.0.0+']))

    const installing = fakeWorker()
    reg.installing = installing
    reg.fire('updatefound')
    installing.state = 'installed'
    installing.fire('statechange')
    expect(seen).toEqual(['3.0.0+', '3.0.0+'])
    off()
    installing.fire('statechange')
    expect(seen).toHaveLength(2)
  })

  it('apply tells the waiting worker to skip waiting, then reloads', async () => {
    const worker = fakeWorker()
    const api = stubServiceWorker(fakeRegistration(worker))
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    const driver = createServiceWorkerUpdaterDriver()
    const done = driver.apply()
    await vi.waitFor(() =>
      expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }),
    )
    api.fire('controllerchange')
    await done
    expect(reload).toHaveBeenCalled()

    stubServiceWorker(fakeRegistration(null))
    await createServiceWorkerUpdaterDriver().apply()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
