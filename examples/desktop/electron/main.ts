import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { createIpcEmitter, createMainWindow, handleIpc } from 'kitr/electron/main'
import electronConfig from '../config/electron'
import type { Ipc, IpcPush } from './ipc'

const push = createIpcEmitter<IpcPush>(() => BrowserWindow.getAllWindows()[0]?.webContents)

handleIpc<Ipc>(ipcMain, {
  'app.version': () => app.getVersion(),
  'dialog.openFile': async (_event, filters) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  },
})

app.whenReady().then(async () => {
  const win = await createMainWindow({ ...electronConfig.window, devtools: electronConfig.devtools })
  win.on('focus', () => push.emit('app.focus', true))
  win.on('blur', () => push.emit('app.focus', false))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow(electronConfig.window)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
