import { createIpcClient } from '@kitr/desktop/client'
import type { Ipc, IpcPush } from '../platforms/app/ipc'

/** Typed renderer-side client. `ipc.available` is false in a plain browser, so the web build still runs. */
export const ipc = createIpcClient<Ipc, IpcPush>()
