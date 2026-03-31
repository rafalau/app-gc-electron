import { ipcMain } from 'electron'
import { studbookService } from '../services/studbook.service'

export function registrarIpcStudbook() {
  ipcMain.handle('studbook:buscar', (_evt, term: string) => studbookService.search(term))
  ipcMain.handle('studbook:importar', (_evt, registro: string) =>
    studbookService.importByRegistro(registro)
  )
}
