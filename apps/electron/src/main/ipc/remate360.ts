import { ipcMain } from 'electron'
import { remate360Service } from '../services/remate360.service'
import {
  ensureOperacaoServer,
  fetchRemotoJson,
  getModoConexaoOperacao,
  publicarSyncEvento
} from './operacao'

export function registrarIpcRemate360() {
  ipcMain.handle('remate360:listarEventos', async () => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/remate360/eventos`)
    }

    return remate360Service.listEvents()
  })
  ipcMain.handle(
    'remate360:importarEvento',
    async (_evt, leilaoId: string, eventId: number, incluirRacaNasInformacoes = false) => {
      const conexao = await getModoConexaoOperacao()
      if (conexao.modo === 'REMOTO') {
        return fetchRemotoJson(`${conexao.baseUrl}/sync/remate360/importar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leilaoId, eventId, incluirRacaNasInformacoes })
        })
      }

      await ensureOperacaoServer()
      const resumo = await remate360Service.importEvent(leilaoId, eventId, incluirRacaNasInformacoes)
      publicarSyncEvento('leiloes')
      publicarSyncEvento(`animais:${leilaoId}`)
      return resumo
    }
  )
}
