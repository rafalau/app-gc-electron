import { BrowserWindow, ipcMain } from 'electron'
import { pickImportFile } from '../services/fileImport.service'
import { importAnimaisFromWorkbook } from '../services/animalImport.service'

export function registrarIpcImportacoes() {
  ipcMain.handle('importacao:excel', async (_evt, leilaoId: string, incluirRacaNasInformacoes = false) => {
    const owner = BrowserWindow.getFocusedWindow()
    const filePath = await pickImportFile(owner)

    if (!filePath) return null
    return importAnimaisFromWorkbook(leilaoId, filePath, { incluirRacaNasInformacoes })
  })
}
