import { createSocketServer } from 'kitr/socket/server'
import { exampleChannel } from '#app/channels/example'

export const sockets = createSocketServer({
  channels: [exampleChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
// In server.ts: sockets.attach(server, '/ws'); from a controller: sockets.use(exampleChannel, { room }).emit('message', data)
