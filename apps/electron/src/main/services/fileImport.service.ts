import { BrowserWindow, dialog } from 'electron'

export async function pickImportFile(owner?: BrowserWindow | null): Promise<string | null> {
  const result = owner
    ? await dialog.showOpenDialog(owner, {
        title: 'Selecionar planilha',
        properties: ['openFile'],
        filters: [{ name: 'Planilhas Excel', extensions: ['xls', 'xlsx'] }]
      })
    : await dialog.showOpenDialog({
        title: 'Selecionar planilha',
        properties: ['openFile'],
        filters: [{ name: 'Planilhas Excel', extensions: ['xls', 'xlsx'] }]
      })

  return result.canceled ? null : result.filePaths[0]
}
