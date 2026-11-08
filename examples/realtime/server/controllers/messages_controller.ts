import type { HttpContext } from '@kitr/api'
import { chatChannel } from '#app/channels/chat'
import {
  type Message,
  type SendMessage,
  roomQuerySchema,
  sendMessageSchema,
} from '#app/features/chat/schema'
import type { z } from 'zod'

type Ctx<Q = Record<string, string | string[]>, B = unknown> = HttpContext<Record<string, string>, Q, B>

/** Last 100 messages per room, in memory. */
const rooms = new Map<string, Message[]>()
const history = (room: string) => {
  let list = rooms.get(room)
  if (!list) {
    list = [
      {
        id: 'welcome',
        room,
        author: 'kitr',
        text: 'Welcome to #' + room + '. Messages here go over a typed WebSocket channel.',
        at: new Date().toISOString(),
      },
    ]
    rooms.set(room, list)
  }
  return list
}

export default class MessagesController {
  static validation = {
    index: { query: roomQuerySchema },
    store: { body: sendMessageSchema },
  }

  async index({ query }: Ctx<z.infer<typeof roomQuerySchema>>) {
    return history(query.room)
  }

  async store({ app, body, response }: Ctx<Record<string, string | string[]>, SendMessage>) {
    const message: Message = {
      id: crypto.randomUUID(),
      room: body.room,
      author: body.author,
      text: body.text,
      at: new Date().toISOString(),
    }
    const list = history(body.room)
    list.push(message)
    if (list.length > 100) list.shift()
    // The socket server mounted by `.ws()` in server/routes.ts; everyone in the room gets the event.
    app.container.use('realtime').use(chatChannel, { room: body.room }).emit('message', message)
    response.status(201)
    return message
  }
}
