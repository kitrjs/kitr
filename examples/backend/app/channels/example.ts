import { defineChannel } from 'kitr/realtime'

/** One definition for both ends. The client applies `effects`; the server checks `authorize`. */
export const exampleChannel = defineChannel<{ room: string }>({
  name: 'example',
  events: {
    message: { effects: () => ({ invalidate: [['messages']] }) },
  },
  authorize: () => true,
})
