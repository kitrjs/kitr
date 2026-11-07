import { IPC_BRIDGE_KEY } from './electron'

/** True inside a Tauri webview (checks `window.__TAURI_INTERNALS__`), false in a browser. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** True in an Electron renderer (checks the kitr preload bridge, then the user agent). */
export function isElectron(): boolean {
  if (typeof globalThis === 'undefined') return false
  if ((globalThis as any)[IPC_BRIDGE_KEY]) return true
  return typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)
}

/** `'tauri' | 'electron' | null`: which desktop shell the app runs in. */
export function desktopShell(): 'tauri' | 'electron' | null {
  return isTauri() ? 'tauri' : isElectron() ? 'electron' : null
}
