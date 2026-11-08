---
'@kitr/server': minor
---

`listen()` no longer registers its own `SIGINT` and `SIGTERM` handlers. A process-wide registry holds every listening server and one handler per signal: the first `listen()` installs it, `close()` leaves the registry, the last one removes the handler. On a signal all servers drain at once and the process exits once, with the longest `shutdownTimeout` as the deadline. Two servers in one process used to stack handlers that each called `process.exit`.
