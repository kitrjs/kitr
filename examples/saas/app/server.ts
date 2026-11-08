import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { runWithSession } from 'kitr/auth/server'
import { auth } from '#server/auth'
import { server } from '#server/main'

/** Every request goes through the kitr server's middleware (request context, shield's headers and CSP nonce); paths it has routes for (endpoints, sockets, /healthz) are answered there, pages are rendered by Start inside it. */
export default createServerEntry({
  fetch(request, options) {
    return server.fetch(request, {
      pages: (request) => {
        return runWithSession(auth, request, () => handler.fetch(request, options))
      },
    })
  },
})
