import { defineChannel } from 'kitr/realtime'
import { api } from '#app/api/client'
import type { Message } from '#app/features/chat/schema'

/**
 * One definition for both ends. The server emits `message` from MessagesController;
 * the client's `effects` refresh the room's query, so the list updates without any wiring in the component.
 */
export const chatChannel = defineChannel<{ room: string }>({
  name: 'chat',
  events: {
    message: {
      effects: (_message: Message, { room }) => ({
        invalidate: [api.messages.index.key({ query: { room } })],
      }),
    },
  },
  authorize: () => true,
})
