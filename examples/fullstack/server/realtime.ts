import { createRealtimeServer } from 'kitr/realtime/server'
import { exampleChannel } from '#app/channels/example'

/** Attached in server/main.ts; from a controller: realtime.use(exampleChannel, { room }).emit('message', data) */
export const realtime = createRealtimeServer({
  channels: [exampleChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
