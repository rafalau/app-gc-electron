import { ipcMain } from 'electron'
import { tbsService } from '../services/tbs.service'

export function registrarIpcTbs() {
  ipcMain.handle('tbs:listarLeiloes', () => tbsService.listActiveAuctions())
  ipcMain.handle(
    'tbs:importarLeilao',
    (_evt, leilaoId: string, auctionId: number, incluirRacaNasInformacoes = false) =>
      tbsService.importAuction(leilaoId, auctionId, incluirRacaNasInformacoes)
  )
}
