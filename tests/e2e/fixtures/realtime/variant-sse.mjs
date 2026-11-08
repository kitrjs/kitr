import { join } from 'node:path'
import { replaceIn } from '../../patch-utils.mjs'

/**
 * The realtime kit on its Server-Sent Events transport, switched the way its docs describe:
 * `transport: 'sse'` in config/realtime.ts, `.sse()` in place of `.ws()` on the server, and the
 * client built from the config. The channels, queries and the page stay as the kit ships them.
 */
export default function variant({ target }) {
  replaceIn(
    join(target, 'config/realtime.ts'),
    "path: '/api/ws',\n  transport: 'websocket',",
    "path: '/api/events',\n  transport: 'sse',",
  )
  replaceIn(join(target, 'server/routes.ts'), ".ws('/ws', {", ".sse('/events', {")
  replaceIn(
    join(target, 'app/realtime.ts'),
    "import { type SocketTransport, createSocketClient } from '@kitr/realtime'",
    "import { type SocketTransport, createRealtimeClient } from '@kitr/realtime'",
  )
  replaceIn(
    join(target, 'app/realtime.ts'),
    "createSocketClient({\n    url: () => window.location.origin.replace(/^http/, 'ws') + realtimeConfig.path,\n  })",
    'createRealtimeClient(realtimeConfig)',
  )
}
