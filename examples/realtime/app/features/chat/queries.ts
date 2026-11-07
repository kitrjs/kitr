import { defineMutation, defineQuery, defineSubscription } from 'kitr/query'
import { channel } from 'kitr/socket'
import { api } from '#app/api/client'
import { chatChannel } from '#app/channels/chat'
import { getSocket } from '#app/socket'

export const messagesQuery = defineQuery(api.messages.index.query())

export const sendMessage = defineMutation(
  api.messages.store.mutation({
    // The socket event refreshes the list for everyone, including the sender; nothing to do here.
  }),
)

/** Live events for a room; `useSubscription(chatSubscription(), { room })` in a client-only component. */
export const chatSubscription = () => defineSubscription(channel(getSocket(), chatChannel).subscription())
