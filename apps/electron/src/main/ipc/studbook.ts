import { ipcMain } from 'electron'
import { studbookService } from '../services/studbook.service'

export function registrarIpcStudbook() {
  ipcMain.handle('studbook:buscar', (_evt, term: string, provider?: 'ABCPCC' | 'ABQM' | 'ABCCRM' | 'ABCCH') =>
    studbookService.search(term, provider)
  )
  ipcMain.handle('studbook:importar', (_evt, registro: string, provider?: 'ABCPCC' | 'ABQM' | 'ABCCRM' | 'ABCCH') =>
    studbookService.importByRegistro(registro, provider)
  )
}
