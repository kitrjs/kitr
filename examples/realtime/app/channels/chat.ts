import { defineChannel } from 'kitr/realtime'
import type { Message } from '#app/features/chat/schema'

/**
 * One definition for both ends: the server serves it from server/routes.ts and emits `message`
 * from MessagesController; the client's `effects` refresh the room's query, so the list updates
 * without any wiring in the component. The key is spelled out (`api.messages.index.key(...)`
 * would pull the client into the server).
 */
export const chatChannel = defineChannel<{ room: string }>({
  name: 'chat',
  events: {
    message: {
      effects: (_message: Message, { room }) => ({
        invalidate: [['api', 'messages.index', {}, { room }]],
      }),
    },
  },
  authorize: () => true,
})
