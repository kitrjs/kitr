import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { app } from './app'

/**
 * Boot providers first, so the first client render matches the server's HTML. A single-page app's
 * shell is the same HTML for every URL, so it renders from scratch instead of hydrating.
 */
app.boot().then(() => {
  const tree = (
    <StrictMode>
      <StartClient />
    </StrictMode>
  )
  startTransition(() => {
    if (import.meta.env.KITR_RENDER === 'spa') createRoot(document).render(tree)
    else hydrateRoot(document, tree)
  })
})
