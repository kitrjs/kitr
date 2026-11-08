import { describe, expect, it } from 'vitest'
import { peersFor, shellPeers } from '../src/shell-peers'
import { versions } from '../src/versions'

describe('shell peers', () => {
  it('adds the Tauri plugins of a device package to a Tauri project only', () => {
    expect(peersFor('notifications', ['tauri'])).toEqual(['@tauri-apps/plugin-notification'])
    expect(peersFor('notifications', ['desktop', 'web'])).toEqual([])
    expect(peersFor('secure-storage', ['tauri'])).toContain('@tauri-apps/plugin-stronghold')
  })

  it('adds electron-updater to a desktop project for the updater', () => {
    expect(peersFor('updater', ['desktop'])).toEqual(['electron-updater'])
    expect(peersFor('updater', ['desktop', 'tauri'])).toEqual([
      'electron-updater',
      '@tauri-apps/api',
      '@tauri-apps/plugin-updater',
      '@tauri-apps/plugin-process',
    ])
  })

  it('has nothing for a package with no native driver peers, and never repeats one', () => {
    expect(peersFor('router', ['tauri'])).toEqual([])
    const files = peersFor('files', ['tauri', 'tauri'])
    expect(new Set(files).size).toBe(files.length)
  })

  it('pins every peer it can install', () => {
    for (const table of Object.values(shellPeers))
      for (const peers of Object.values(table))
        for (const peer of peers) expect(versions[peer], peer).toMatch(/^\^\d/)
  })
})
