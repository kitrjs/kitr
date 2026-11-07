import { contextBridge, ipcRenderer } from 'electron'
import { exposeIpc } from 'kitr/electron/preload'

// Only the channels declared in electron/ipc.ts reach the renderer; everything else stays in main.
exposeIpc(contextBridge, ipcRenderer)
