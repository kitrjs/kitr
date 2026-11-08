---
'@kitr/realtime': minor
---

`closeSessions(userId)` on the WebSocket, SSE, Socket.IO and transport-neutral realtime servers closes every connection of a user on that instance (WebSocket code 4401, reason `Session revoked`) and returns the count, so a revoked session stops receiving events. A connection belongs to the `userId`, `user.id` or `id` of the context `authorize` returned, or to whatever the new `identify` option says. Wire it to `onSessionsRevoked` of the auth session controller.
