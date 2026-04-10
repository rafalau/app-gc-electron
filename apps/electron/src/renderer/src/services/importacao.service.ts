import type {
  AssociationProvider,
  ApiAuctionOption,
  ApiImportProviderOption,
  ImportSummary,
  StudbookImportPayload,
  StudbookSearchResult
} from '../types/importacao'

function getStudbookBridge() {
  if (window.studbook) return window.studbook

  const electronApi = (window as typeof window & {
    electron?: { ipcRenderer?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }
  }).electron

  const ipcInvoke = electronApi?.ipcRenderer?.invoke

  if (ipcInvoke) {
    return {
      buscar: (term: string, provider?: AssociationProvider) =>
        ipcInvoke('studbook:buscar', term, provider) as Promise<StudbookSearchResult[]>,
      importar: (registro: string, provider?: AssociationProvider) =>
        ipcInvoke('studbook:importar', registro, provider) as Promise<StudbookImportPayload>
    }
  }

  throw new Error('Bridge do studbook indisponivel nesta janela.')
}

export async function importarExcel(
  leilaoId: string,
  incluirRacaNasInformacoes = true
): Promise<ImportSummary | null> {
  return window.importacao.excel(leilaoId, incluirRacaNasInformacoes)
}

export async function listarLeiloesApi(provider: ApiImportProviderOption): Promise<ApiAuctionOption[]> {
  return window.importacao.listarLeiloesApi({
    id: String(provider.id),
    nome: String(provider.nome),
    url: String(provider.url)
  })
}

export async function importarLeilaoApi(
  leilaoId: string,
  provider: ApiImportProviderOption,
  auctionId: number,
  incluirRacaNasInformacoes = true
): Promise<ImportSummary> {
  return window.importacao.importarLeilaoApi(
    leilaoId,
    {
      id: String(provider.id),
      nome: String(provider.nome),
      url: String(provider.url)
    },
    auctionId,
    incluirRacaNasInformacoes
  )
}

export async function buscarStudbook(
  term: string,
  provider: AssociationProvider = 'ABCPCC'
): Promise<StudbookSearchResult[]> {
  return getStudbookBridge().buscar(term, provider)
}

export async function importarAnimalStudbook(
  registro: string,
  provider: AssociationProvider = 'ABCPCC'
): Promise<StudbookImportPayload> {
  return getStudbookBridge().importar(registro, provider)
}
