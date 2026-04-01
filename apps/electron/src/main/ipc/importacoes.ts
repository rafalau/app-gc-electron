import { BrowserWindow, ipcMain } from 'electron'
import { pickImportFile } from '../services/fileImport.service'
import { importAnimaisFromWorkbook } from '../services/animalImport.service'
import { ensureOperacaoServer, getModoConexaoOperacao, publicarSyncEvento } from './operacao'

export function registrarIpcImportacoes() {
  ipcMain.handle('importacao:excel', async (_evt, leilaoId: string, incluirRacaNasInformacoes = false) => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      throw new Error('Importação por arquivo Excel deve ser feita no aplicativo HOST.')
    }

    const owner = BrowserWindow.getFocusedWindow()
    const filePath = await pickImportFile(owner)

    if (!filePath) return null
    await ensureOperacaoServer()
    const resumo = await importAnimaisFromWorkbook(leilaoId, filePath, { incluirRacaNasInformacoes })
    publicarSyncEvento('leiloes')
    publicarSyncEvento(`animais:${leilaoId}`)
    return resumo
  })
}
