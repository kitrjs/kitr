import { createRealtimeServer } from 'kitr/realtime/server'
import { chatChannel } from '#app/channels/chat'

export const realtime = createRealtimeServer({
  channels: [chatChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
