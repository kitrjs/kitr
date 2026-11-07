import { createIpcClient } from 'kitr/electron'
import type { Ipc, IpcPush } from '../electron/ipc'

/** Typed renderer-side client. `ipc.available` is false in a plain browser, so the web build still runs. */
export const ipc = createIpcClient<Ipc, IpcPush>()
