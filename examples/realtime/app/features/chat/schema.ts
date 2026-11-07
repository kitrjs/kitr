import { z } from 'zod'

export const sendMessageSchema = z.object({
  room: z.string().min(1),
  author: z.string().trim().min(1, 'Pick a name').max(32),
  text: z.string().trim().min(1, 'Say something').max(500),
})
export type SendMessage = z.infer<typeof sendMessageSchema>

export const roomQuerySchema = z.object({ room: z.string().default('general') })

export interface Message {
  id: string
  room: string
  author: string
  text: string
  at: string
}
