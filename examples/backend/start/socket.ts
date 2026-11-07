import { createSocketServer } from 'kitr/socket/server'
import { exampleChannel } from '#app/channels/example'

/** Attached to the server in server.ts. Emit from a controller: sockets.use(exampleChannel, { room }).emit('message', data) */
export const sockets = createSocketServer({
  channels: [exampleChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
