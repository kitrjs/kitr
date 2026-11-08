import { createApp } from '@kitr/kitr/app'
import { createSecureStorage } from '@kitr/secure-storage'
import { expect, it } from 'vitest'
import flagsProvider from '#app/providers/flags-provider'
import vaultProvider from '#app/vault'
import flagsPackage from './flags-package'

it('a provider registers a service that pages read with useService()', async () => {
  const app = createApp({
    providers: [flagsProvider],
    config: { flags: { flags: { beta: true } } },
  })
  await app.boot()
  const flags = app.container.use('flags')
  expect(flags.isOn('beta')).toBe(true)
  expect(flags.isOn('missing')).toBe(false)
})

it('a driver registered on the app replaces the default one', async () => {
  const app = createApp({ providers: [vaultProvider] })
  await app.boot()
  const storage = createSecureStorage({}, app)
  expect(storage.driver.name).toBe('map-vault')
  await storage.set('note', 'hello')
  expect(await storage.get('note')).toBe('hello')
})

it('a package wraps the provider for kitr add', () => {
  expect(flagsPackage.name).toBe('flags')
})
