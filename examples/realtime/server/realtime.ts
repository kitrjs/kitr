import { createRealtimeServer } from 'kitr/realtime/server'
import { chatChannel } from '#app/channels/chat'
import realtimeConfig from '../config/realtime'

/** Transport and path come from config/realtime.ts. */
export const realtime = createRealtimeServer({
  ...realtimeConfig,
  channels: [chatChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
