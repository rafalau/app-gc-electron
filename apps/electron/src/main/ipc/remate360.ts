import { ipcMain } from 'electron'
import { remate360Service } from '../services/remate360.service'

export function registrarIpcRemate360() {
  ipcMain.handle('remate360:listarEventos', () => remate360Service.listEvents())
  ipcMain.handle(
    'remate360:importarEvento',
    (_evt, leilaoId: string, eventId: number, incluirRacaNasInformacoes = false) =>
      remate360Service.importEvent(leilaoId, eventId, incluirRacaNasInformacoes)
  )
}
