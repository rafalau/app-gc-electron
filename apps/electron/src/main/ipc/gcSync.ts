import { ipcMain } from 'electron'
import { sincronizarGcApiLeilao, sincronizarGcApiTudo } from '../services/gcApiSync.service'
import { getModoConexaoOperacao, publicarSyncEvento } from './operacao'

export function registrarIpcGcSync() {
  ipcMain.handle('gc-sync:sincronizarTudo', async () => {
    const conexao = await getModoConexaoOperacao()

    if (conexao.modo === 'REMOTO') {
      throw new Error('A sincronização com a GC API só pode ser executada no HOST.')
    }

    const summary = await sincronizarGcApiTudo()
    publicarSyncEvento('leiloes')
    return summary
  })

  ipcMain.handle('gc-sync:sincronizarLeilao', async (_evt, leilaoId: string) => {
    const conexao = await getModoConexaoOperacao()

    if (conexao.modo === 'REMOTO') {
      throw new Error('A sincronização com a GC API só pode ser executada no HOST.')
    }

    const summary = await sincronizarGcApiLeilao(leilaoId)
    publicarSyncEvento('leiloes')
    publicarSyncEvento(`animais:${leilaoId}`)
    return summary
  })
}
