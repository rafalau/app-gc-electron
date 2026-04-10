import type {
  AssociationProvider,
  ApiAuctionOption,
  ApiImportProviderOption,
  ImportSummary,
  StudbookImportPayload,
  StudbookSearchResult
} from '../types/importacao'

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
  return window.studbook.buscar(term, provider)
}

export async function importarAnimalStudbook(
  registro: string,
  provider: AssociationProvider = 'ABCPCC'
): Promise<StudbookImportPayload> {
  return window.studbook.importar(registro, provider)
}
