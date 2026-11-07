import { createSocketServer } from 'kitr/socket/server'
import { chatChannel } from '#app/channels/chat'

export const sockets = createSocketServer({
  channels: [chatChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
