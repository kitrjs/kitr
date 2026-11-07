/**
 * The IPC contract shared by main, preload and the renderer. Add a command here, implement it
 * in electron/main.ts, call it from the app with `ipc.invoke('...')`.
 */
export type Ipc = {
  'app.version': () => string
  'dialog.openFile': (filters?: Array<{ name: string; extensions: string[] }>) => string | null
}

/** Events pushed from main to the renderer. */
export type IpcPush = {
  'app.focus': (focused: boolean) => void
}
