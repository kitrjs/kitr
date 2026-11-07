import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// happy-dom never fetches external scripts in tests. Without this flag it reports each one
// (the analytics adapters' gtag and Plausible tags) as an unhandled DOMException; with it the
// script fires `load` and the test asserts on the tag the adapter wrote, not the network.
const happy = (globalThis as any).window?.happyDOM
if (happy?.settings) happy.settings.handleDisabledFileLoadingAsSuccess = true

// Unmount between tests so effects and listeners from one test never reach the next.
afterEach(() => {
  cleanup()
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {}
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; max-age=0; path=/`
  }
})
