import { contextBridge, ipcRenderer } from 'electron'
import { exposeIpc } from 'kitr/desktop/preload'

// Only the channels declared in ipc.ts (and kitr's own kitr:* channels) reach the renderer.
exposeIpc(contextBridge, ipcRenderer)
