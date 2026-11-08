import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { runWithSession } from 'kitr/auth/server'
import { auth } from '#server/auth'
import { server } from '#server/main'

/** Requests for paths the kitr server has routes for (endpoints, sockets, /healthz) go to it; pages go to Start. */
export default createServerEntry({
  fetch(request, options) {
    if (server.handles(request)) return server.fetch(request)
    return runWithSession(auth, request, () => handler.fetch(request, options))
  },
})
