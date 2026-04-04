import { ipcMain } from 'electron'
import { isRemate360Url, remate360Service } from '../services/remate360.service'
import { tbsService } from '../services/tbs.service'
import {
  ensureOperacaoServer,
  fetchRemotoJson,
  getModoConexaoOperacao,
  publicarSyncEvento
} from './operacao'

export type ApiImportProvider = {
  id: string
  nome: string
  url: string
}

export function registrarIpcApiImport() {
  ipcMain.handle('importacao:api:listarLeiloes', async (_evt, provider: ApiImportProvider) => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(
        `${conexao.baseUrl}/sync/importacao/api/leiloes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider })
        }
      )
    }

    if (isRemate360Url(provider.url)) {
      return remate360Service.listEventsByUrl(provider.url)
    }

    return tbsService.listActiveAuctionsByUrl(provider.url)
  })

  ipcMain.handle(
    'importacao:api:importarLeilao',
    async (
      _evt,
      leilaoId: string,
      provider: ApiImportProvider,
      auctionId: number,
      incluirRacaNasInformacoes = false
    ) => {
      const conexao = await getModoConexaoOperacao()
      if (conexao.modo === 'REMOTO') {
        return fetchRemotoJson(`${conexao.baseUrl}/sync/importacao/api/importar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leilaoId, provider, auctionId, incluirRacaNasInformacoes })
        })
      }

      await ensureOperacaoServer()
      const resumo = isRemate360Url(provider.url)
        ? await remate360Service.importEventByUrl(
            leilaoId,
            auctionId,
            incluirRacaNasInformacoes,
            provider.url
          )
        : await tbsService.importAuctionByUrl(
            leilaoId,
            auctionId,
            incluirRacaNasInformacoes,
            provider.url
          )

      publicarSyncEvento('leiloes')
      publicarSyncEvento(`animais:${leilaoId}`)
      return resumo
    }
  )
}
