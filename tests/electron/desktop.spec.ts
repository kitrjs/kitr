import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron, expect, test } from '@playwright/test'

const release = fileURLToPath(
  new URL('../../examples/desktop/dist/app/release/linux-unpacked/', import.meta.url),
)
const executable = process.env.KITR_ELECTRON_APP ?? join(release, '@kitrexample-desktop')

test('secure storage round-trips and a notification call does not throw', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'kitr-electron-'))
  const app = await electron.launch({
    executablePath: executable,
    args: ['--no-sandbox', '--password-store=gnome-libsecret', `--user-data-dir=${userData}`],
  })
  try {
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    // The window has the preload bridge and no node.
    expect(await window.evaluate(() => typeof (globalThis as { kitrIpc?: unknown }).kitrIpc)).toBe(
      'object',
    )
    expect(await window.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe(
      'undefined',
    )

    await window.getByTestId('secret-input').fill('s3cret-value')
    await window.getByTestId('secret-save').click()
    await expect(window.getByTestId('device-status')).toHaveText('saved')

    await window.getByTestId('secret-load').click()
    await expect(window.getByTestId('secret-value')).toHaveText('s3cret-value')

    await window.getByTestId('notify').click()
    await expect(window.getByTestId('device-status')).toHaveText('notification sent')
  } finally {
    await app.close()
  }
})
