import { mutationFrom, queryFrom, subscriptionFrom } from 'kitr/query'
import { channel } from 'kitr/realtime'
import { api } from '#app/api/client'
import { chatChannel } from '#app/channels/chat'
import { getSocket } from '#app/realtime'

export const messagesQuery = queryFrom(api.messages.index.query())

export const sendMessage = mutationFrom(
  api.messages.store.mutation({
    // The socket event refreshes the list for everyone, including the sender; nothing to do here.
  }),
)

/** Live events for a room; `useSubscription(chatSubscription(), { room })` in a client-only component. */
export const chatSubscription = () => subscriptionFrom(channel(getSocket(), chatChannel).subscription())
