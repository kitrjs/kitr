import { createApp } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUpdater, selectDriver } from '../src'
import { createCapacitorDriver } from '../src/drivers/capacitor'

const mocks = vi.hoisted(() => {
  let platform = 'android'
  let onState: (state: unknown) => void = () => {}
  return {
    setPlatform: (p: string) => {
      platform = p
    },
    getPlatform: () => platform,
    emit: (state: unknown) => onState(state),
    setOnState: (fn: (state: unknown) => void) => {
      onState = fn
    },
    remove: vi.fn(async () => {}),
    update: {
      getAppUpdateInfo: vi.fn(),
      openAppStore: vi.fn(),
      performImmediateUpdate: vi.fn(),
      startFlexibleUpdate: vi.fn(),
      completeFlexibleUpdate: vi.fn(),
      addListener: vi.fn(),
    },
  }
})

vi.mock('@capawesome/capacitor-app-update', () => ({
  AppUpdate: mocks.update,
  AppUpdateAvailability: { UNKNOWN: 0, UPDATE_NOT_AVAILABLE: 1, UPDATE_AVAILABLE: 2 },
  FlexibleUpdateInstallStatus: { DOWNLOADING: 2, DOWNLOADED: 11, FAILED: 5, CANCELED: 6 },
  AppUpdateResultCode: { OK: 0, CANCELED: 1, FAILED: 2 },
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mocks.getPlatform() } }))

const available = {
  currentVersionName: '1.0.0',
  currentVersionCode: '10',
  availableVersionName: '1.1.0',
  availableVersionCode: '11',
  availableVersionReleaseDate: '2030-01-01',
  updateAvailability: 2,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.setPlatform('android')
  mocks.update.addListener.mockImplementation(async (_event: string, fn: (s: unknown) => void) => {
    mocks.setOnState(fn)
    return { remove: mocks.remove }
  })
})

describe('capacitor updater check', () => {
  it('reports the store version when one is available', async () => {
    mocks.update.getAppUpdateInfo.mockResolvedValue(available)
    expect(await createCapacitorDriver().check()).toEqual({
      version: '1.1.0',
      date: '2030-01-01',
    })
  })

  it('falls back to the version code, then to "new"', async () => {
    const driver = createCapacitorDriver()
    mocks.update.getAppUpdateInfo.mockResolvedValueOnce({
      ...available,
      availableVersionName: undefined,
    })
    expect((await driver.check())?.version).toBe('11')
    mocks.update.getAppUpdateInfo.mockResolvedValueOnce({
      ...available,
      availableVersionName: undefined,
      availableVersionCode: undefined,
    })
    expect((await driver.check())?.version).toBe('new')
  })

  it.each([0, 1, 3])('reports null for availability %s', async (updateAvailability) => {
    mocks.update.getAppUpdateInfo.mockResolvedValue({ ...available, updateAvailability })
    expect(await createCapacitorDriver().check()).toBeNull()
  })

  it('reports the running version', async () => {
    mocks.update.getAppUpdateInfo.mockResolvedValue(available)
    expect(await createCapacitorDriver().currentVersion?.()).toBe('1.0.0')
  })
})

describe('capacitor updater apply on iOS', () => {
  it('opens the App Store page', async () => {
    mocks.setPlatform('ios')
    await createCapacitorDriver().apply()
    expect(mocks.update.openAppStore).toHaveBeenCalledTimes(1)
    expect(mocks.update.getAppUpdateInfo).not.toHaveBeenCalled()
  })
})

describe('capacitor updater apply on Android', () => {
  it('runs the immediate flow for a high-priority update', async () => {
    mocks.update.getAppUpdateInfo.mockResolvedValue({
      ...available,
      updatePriority: 5,
      immediateUpdateAllowed: true,
      flexibleUpdateAllowed: true,
    })
    await createCapacitorDriver().apply()
    expect(mocks.update.performImmediateUpdate).toHaveBeenCalled()
    expect(mocks.update.startFlexibleUpdate).not.toHaveBeenCalled()
  })

  it('runs the immediate flow when it is the only one allowed', async () => {
    mocks.update.getAppUpdateInfo.mockResolvedValue({ ...available, immediateUpdateAllowed: true })
    await createCapacitorDriver().apply()
    expect(mocks.update.performImmediateUpdate).toHaveBeenCalled()
  })

  it('opens the store when Play allows neither flow', async () => {
    mocks.update.getAppUpdateInfo.mockResolvedValue(available)
    await createCapacitorDriver().apply()
    expect(mocks.update.openAppStore).toHaveBeenCalled()
  })

  it('reuses what check() found instead of asking Play again', async () => {
    mocks.update.getAppUpdateInfo.mockResolvedValue({ ...available, immediateUpdateAllowed: true })
    const driver = createCapacitorDriver()
    await driver.check()
    await driver.apply()
    expect(mocks.update.getAppUpdateInfo).toHaveBeenCalledTimes(1)
  })

  describe('flexible update', () => {
    const flexible = { ...available, flexibleUpdateAllowed: true, updatePriority: 2 }

    it('downloads with progress, then restarts into the new version', async () => {
      mocks.update.getAppUpdateInfo.mockResolvedValue(flexible)
      mocks.update.startFlexibleUpdate.mockImplementation(async () => {
        queueMicrotask(() => {
          mocks.emit({ installStatus: 2, bytesDownloaded: 25, totalBytesToDownload: 100 })
          mocks.emit({ installStatus: 2, bytesDownloaded: 500, totalBytesToDownload: 100 })
          mocks.emit({ installStatus: 2, bytesDownloaded: undefined, totalBytesToDownload: 100 })
          mocks.emit({ installStatus: 11 })
        })
        return { code: 0 }
      })
      const progress: number[] = []
      await createCapacitorDriver().apply((f) => progress.push(f))
      expect(progress).toEqual([0.25, 1, 1])
      expect(mocks.update.completeFlexibleUpdate).toHaveBeenCalled()
      expect(mocks.remove).toHaveBeenCalled()
    })

    it('does nothing more when the person declines the Play dialog', async () => {
      mocks.update.getAppUpdateInfo.mockResolvedValue(flexible)
      mocks.update.startFlexibleUpdate.mockResolvedValue({ code: 1 })
      await createCapacitorDriver().apply()
      expect(mocks.update.completeFlexibleUpdate).not.toHaveBeenCalled()
      expect(mocks.remove).toHaveBeenCalled()
    })

    it('does not install a download the person cancelled', async () => {
      mocks.update.getAppUpdateInfo.mockResolvedValue(flexible)
      mocks.update.startFlexibleUpdate.mockImplementation(async () => {
        queueMicrotask(() => mocks.emit({ installStatus: 6 }))
        return { code: 0 }
      })
      await createCapacitorDriver().apply()
      expect(mocks.update.completeFlexibleUpdate).not.toHaveBeenCalled()
    })

    it('throws when the download fails, and when Play refuses to start', async () => {
      mocks.update.getAppUpdateInfo.mockResolvedValue(flexible)
      mocks.update.startFlexibleUpdate.mockImplementationOnce(async () => {
        queueMicrotask(() => mocks.emit({ installStatus: 5 }))
        return { code: 0 }
      })
      await expect(createCapacitorDriver().apply()).rejects.toThrow('failed to download')
      mocks.update.startFlexibleUpdate.mockResolvedValueOnce({ code: 2 })
      await expect(createCapacitorDriver().apply()).rejects.toThrow('did not start (code 2)')
      expect(mocks.remove).toHaveBeenCalledTimes(2)
    })

    it('ignores intermediate states', async () => {
      mocks.update.getAppUpdateInfo.mockResolvedValue(flexible)
      mocks.update.startFlexibleUpdate.mockImplementation(async () => {
        queueMicrotask(() => {
          mocks.emit({ installStatus: 1 })
          mocks.emit({ installStatus: 11 })
        })
        return { code: 0 }
      })
      await createCapacitorDriver().apply()
      expect(mocks.update.completeFlexibleUpdate).toHaveBeenCalled()
    })
  })
})

describe('driver selection', () => {
  it('selectDriver picks the Capacitor driver', () => {
    expect(selectDriver('capacitor').name).toBe('capacitor')
  })

  it('serves the updater service in a Capacitor shell', async () => {
    const app = createApp({ environment: 'test' })
    app.drivers.register('platform', {
      type: 'mobile',
      native: true,
      runtime: 'capacitor',
      os: () => 'android',
    })
    app.container.singleton('platform', () => createPlatform(app))
    mocks.update.getAppUpdateInfo.mockResolvedValue(available)
    const updater = createUpdater({ checkOnBoot: false }, app)
    expect(updater.driver.name).toBe('capacitor')
    expect((await updater.check())?.version).toBe('1.1.0')
    updater.stop()
  })
})
