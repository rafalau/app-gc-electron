import { ipcMain } from 'electron'
import { tbsService } from '../services/tbs.service'
import {
  ensureOperacaoServer,
  fetchRemotoJson,
  getModoConexaoOperacao,
  publicarSyncEvento
} from './operacao'

export function registrarIpcTbs() {
  ipcMain.handle('tbs:listarLeiloes', async () => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/tbs/leiloes`)
    }

    return tbsService.listActiveAuctions()
  })
  ipcMain.handle(
    'tbs:importarLeilao',
    async (_evt, leilaoId: string, auctionId: number, incluirRacaNasInformacoes = false) => {
      const conexao = await getModoConexaoOperacao()
      if (conexao.modo === 'REMOTO') {
        return fetchRemotoJson(`${conexao.baseUrl}/sync/tbs/importar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leilaoId, auctionId, incluirRacaNasInformacoes })
        })
      }

      await ensureOperacaoServer()
      const resumo = await tbsService.importAuction(leilaoId, auctionId, incluirRacaNasInformacoes)
      publicarSyncEvento('leiloes')
      publicarSyncEvento(`animais:${leilaoId}`)
      return resumo
    }
  )
}
