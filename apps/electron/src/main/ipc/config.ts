import { ipcMain } from 'electron'
import { getStore } from '../store/store'

export function registrarIpcConfig() {
  ipcMain.handle('config:setModo', async (_, modo: 'HOST' | 'REMOTO') => {
    const store = await getStore()
    store.set('modo', modo)
  })

  ipcMain.handle('config:getModo', async () => {
    const store = await getStore()
    return store.get('modo')
  })
}
