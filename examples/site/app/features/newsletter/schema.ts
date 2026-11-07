import { z } from 'zod'

export const subscribeSchema = z.object({ email: z.email('Enter a valid email') })
export type Subscribe = z.infer<typeof subscribeSchema>
