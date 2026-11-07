import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryNativeDrivers,
  createNative,
  UnsupportedError,
  webBiometrics,
  webCamera,
  webClipboard,
  webGeolocation,
  webHaptics,
  webShare,
} from '../src'

const nav = navigator as any
function stubNavigator(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { configurable: true, writable: true, value })
}

afterEach(() => {
  for (const key of ['share', 'canShare', 'vibrate', 'geolocation', 'credentials', 'clipboard'])
    stubNavigator(key, undefined)
  vi.unstubAllGlobals()
  localStorage.clear()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('capability wrapper', () => {
  it('calls class-based drivers with the driver as this', async () => {
    class Clipboard {
      #text = ''
      async readText() {
        return this.#text
      }
      async writeText(text: string) {
        this.#text = text
      }
    }
    const native = createNative({ drivers: { clipboard: new Clipboard() } })
    await native.clipboard.writeText('hi')
    expect(await native.clipboard.readText()).toBe('hi')
    const { writeText } = native.clipboard
    await writeText('detached')
    expect(await native.clipboard.readText()).toBe('detached')
    expect(native.clipboard).toMatchObject({ supported: true, name: 'configured' })
  })

  it('unsupported capabilities answer safely or reject with UnsupportedError', async () => {
    stubNavigator('clipboard', undefined)
    const native = createNative()
    expect(native.share.canShare({ text: 'x' })).toBe(false)
    expect(await native.biometrics.available()).toBe(false)
    const stop = native.geolocation.watch(() => {})
    expect(() => stop()).not.toThrow()
    const error = await native.clipboard.readText().catch((e) => e)
    expect(error).toBeInstanceOf(UnsupportedError)
    expect(error.capability).toBe('clipboard')
    expect(native.clipboard.name).toBe('unsupported')
    expect(native.supported()).toEqual({
      clipboard: false,
      share: false,
      haptics: false,
      geolocation: false,
      camera: true,
      biometrics: false,
    })
  })

  it('memory drivers record shares and haptics', async () => {
    const drivers = createMemoryNativeDrivers()
    const native = createNative({ drivers })
    await native.share.share({ url: '/x' })
    await native.haptics.impact('success')
    expect(drivers.shared).toEqual([{ url: '/x' }])
    expect(drivers.haptics_log).toEqual(['success'])
  })
})

describe('web drivers', () => {
  it('share: true when shared, false when dismissed, errors otherwise', async () => {
    stubNavigator(
      'share',
      vi.fn(async () => {}),
    )
    const share = webShare()!
    expect(await share.share({ text: 'x' })).toBe(true)
    nav.share = vi.fn(async () =>
      Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })),
    )
    expect(await share.share({ text: 'x' })).toBe(false)
    nav.share = vi.fn(async () =>
      Promise.reject(Object.assign(new Error('no gesture'), { name: 'NotAllowedError' })),
    )
    await expect(share.share({ text: 'x' })).rejects.toThrow('no gesture')
  })

  it('share: without canShare, files are assumed unsupported', () => {
    stubNavigator('share', vi.fn())
    const share = webShare()!
    expect(share.canShare({ text: 'x' })).toBe(true)
    expect(share.canShare({ files: [new File(['a'], 'a.txt')] })).toBe(false)
    stubNavigator('canShare', () => true)
    expect(share.canShare({ files: [new File(['a'], 'a.txt')] })).toBe(true)
  })

  it('haptics map kinds to vibration patterns', async () => {
    const vibrate = vi.fn()
    stubNavigator('vibrate', vibrate)
    const haptics = webHaptics()!
    await haptics.impact('light')
    await haptics.impact('error')
    expect(vibrate.mock.calls).toEqual([[10], [[50, 50, 50, 50, 50]]])
  })

  it('geolocation converts positions, passes options and clears watches', async () => {
    const coords = {
      latitude: 1,
      longitude: 2,
      accuracy: 3,
      altitude: null,
      heading: null,
      speed: null,
    }
    const geo = {
      getCurrentPosition: vi.fn((ok: any, _err: any, _opts: any) => ok({ coords, timestamp: 9 })),
      watchPosition: vi.fn((ok: any) => {
        ok({ coords, timestamp: 10 })
        return 7
      }),
      clearWatch: vi.fn(),
    }
    stubNavigator('geolocation', geo)
    const driver = webGeolocation()!
    expect(await driver.current({ highAccuracy: true, timeout: 500 })).toEqual({
      ...coords,
      timestamp: 9,
    })
    expect(geo.getCurrentPosition.mock.calls[0]![2]).toEqual({
      enableHighAccuracy: true,
      timeout: 500,
    })
    const seen: number[] = []
    const stop = driver.watch((p) => seen.push(p.timestamp))
    stop()
    expect(seen).toEqual([10])
    expect(geo.clearWatch).toHaveBeenCalledWith(7)
    geo.getCurrentPosition.mockImplementation((_ok: any, err: any) =>
      err({ code: 1, message: 'denied' }),
    )
    await expect(driver.current()).rejects.toMatchObject({ code: 1 })
  })

  it('clipboard reads and writes through the browser', async () => {
    let text = ''
    stubNavigator('clipboard', {
      readText: async () => text,
      writeText: async (t: string) => void (text = t),
    })
    const clip = webClipboard()!
    await clip.writeText('copied')
    expect(await clip.readText()).toBe('copied')
  })

  it('camera opens a capture input, or the library without capture', async () => {
    const photo = new File(['img'], 'p.jpg', { type: 'image/jpeg' })
    let input: HTMLInputElement | undefined
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      input = this
      Object.defineProperty(this, 'files', { value: [photo] })
      queueMicrotask(() => this.onchange?.(new Event('change')))
    })
    const camera = webCamera()!
    expect(await camera.capture()).toEqual({ blob: photo, type: 'image/jpeg', source: 'camera' })
    expect(input!.getAttribute('capture')).toBe('environment')
    expect(input!.accept).toBe('image/*')
    expect(await camera.capture({ source: 'library' })).toMatchObject({ source: 'library' })
    expect(input!.hasAttribute('capture')).toBe(false)
    expect(document.querySelectorAll('input')).toHaveLength(0)
  })
})

describe('web biometrics', () => {
  function setup() {
    const rawId = new Uint8Array([1, 2, 3, 4]).buffer
    const credentials = {
      create: vi.fn(async (_o: any) => ({ rawId })),
      get: vi.fn(async (_o: any) => ({ id: 'x' })),
    }
    stubNavigator('credentials', credentials)
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => true),
    })
    return { credentials, driver: webBiometrics()! }
  }

  it('registers a platform credential once, then asks for it by id', async () => {
    const { credentials, driver } = setup()
    expect(await driver.available()).toBe(true)
    expect(await driver.authenticate()).toBe(true)
    const created = credentials.create.mock.calls[0]![0].publicKey
    expect(created.authenticatorSelection).toMatchObject({
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    })
    expect(created.challenge).toHaveLength(32)
    expect(await driver.authenticate()).toBe(true)
    expect(credentials.create).toHaveBeenCalledTimes(1)
    const asked = credentials.get.mock.calls[0]![0].publicKey
    expect(asked.userVerification).toBe('required')
    expect([...asked.allowCredentials[0].id]).toEqual([1, 2, 3, 4])
    // Each prompt gets a fresh challenge.
    await driver.authenticate()
    expect(credentials.get.mock.calls[1]![0].publicKey.challenge).not.toEqual(asked.challenge)
  })

  it('cancel is false and keeps the credential; a lost credential is forgotten', async () => {
    const { credentials, driver } = setup()
    await driver.authenticate()
    credentials.get.mockRejectedValueOnce(
      Object.assign(new Error('cancel'), { name: 'NotAllowedError' }),
    )
    expect(await driver.authenticate()).toBe(false)
    expect(localStorage.getItem('kitr:biometrics:credential')).toBeTruthy()
    credentials.get.mockRejectedValueOnce(
      Object.assign(new Error('gone'), { name: 'InvalidStateError' }),
    )
    expect(await driver.authenticate()).toBe(false)
    expect(localStorage.getItem('kitr:biometrics:credential')).toBeNull()
    expect(await driver.authenticate()).toBe(true)
    expect(credentials.create).toHaveBeenCalledTimes(2)
  })

  it('cancelling registration is false and stores nothing', async () => {
    const { credentials, driver } = setup()
    credentials.create.mockRejectedValueOnce(
      Object.assign(new Error('cancel'), { name: 'NotAllowedError' }),
    )
    expect(await driver.authenticate()).toBe(false)
    expect(localStorage.getItem('kitr:biometrics:credential')).toBeNull()
  })

  it('is unsupported without WebAuthn, and unavailable when the check throws', async () => {
    expect(webBiometrics()).toBeNull()
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error('x')),
    })
    expect(await webBiometrics()!.available()).toBe(false)
  })
})
