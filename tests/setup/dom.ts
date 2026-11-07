import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

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
