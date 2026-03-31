import { ipcMain } from 'electron'
import { getStore } from '../store/store'

export function registrarIpcConfig() {
  ipcMain.handle('config:setModo', async (_, modo: 'HOST' | 'REMOTO' | null) => {
    const store = await getStore()
    store.set('modo', modo)
  })

  ipcMain.handle('config:getModo', async () => {
    const store = await getStore()
    return store.get('modo')
  })

  ipcMain.handle('config:getLayoutAnimais', async (_evt, leilaoId: string) => {
    const store = await getStore()
    const layouts = store.get('layoutAnimaisPorLeilao')
    return (
      layouts?.[leilaoId] ?? {
        modo: 'AGREGADAS',
        incluirRacaNasImportacoes: false
      }
    )
  })

  ipcMain.handle(
    'config:setLayoutAnimais',
    async (
      _evt,
      leilaoId: string,
      layout: { modo: 'AGREGADAS' | 'SEPARADAS'; incluirRacaNasImportacoes: boolean }
    ) => {
      const store = await getStore()
      const layouts = store.get('layoutAnimaisPorLeilao')
      store.set('layoutAnimaisPorLeilao', {
        ...layouts,
        [leilaoId]: layout
      })
    }
  )
}
