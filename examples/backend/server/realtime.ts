import { createRealtimeServer } from 'kitr/realtime/server'
import { exampleChannel } from '#app/channels/example'
import realtimeConfig from '../config/realtime'

/** Transport and path come from config/realtime.ts. Attached in server/main.ts; from a controller: realtime.use(exampleChannel, { room }).emit('message', data) */
export const realtime = createRealtimeServer({
  ...realtimeConfig,
  channels: [exampleChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
