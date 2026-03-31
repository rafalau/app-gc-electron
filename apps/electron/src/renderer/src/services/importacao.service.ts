import type {
  ImportSummary,
  Remate360EventOption,
  StudbookImportPayload,
  StudbookSearchResult,
  TbsAuctionOption
} from '../types/importacao'

export async function importarExcel(
  leilaoId: string,
  incluirRacaNasInformacoes = false
): Promise<ImportSummary | null> {
  return window.importacao.excel(leilaoId, incluirRacaNasInformacoes)
}

export async function listarLeiloesTbs(): Promise<TbsAuctionOption[]> {
  return window.tbs.listarLeiloes()
}

export async function importarLeilaoTbs(
  leilaoId: string,
  auctionId: number,
  incluirRacaNasInformacoes = false
): Promise<ImportSummary> {
  return window.tbs.importarLeilao(leilaoId, auctionId, incluirRacaNasInformacoes)
}

export async function listarEventosRemate360(): Promise<Remate360EventOption[]> {
  return window.remate360.listarEventos()
}

export async function importarEventoRemate360(
  leilaoId: string,
  eventId: number,
  incluirRacaNasInformacoes = false
): Promise<ImportSummary> {
  return window.remate360.importarEvento(leilaoId, eventId, incluirRacaNasInformacoes)
}

export async function buscarStudbook(term: string): Promise<StudbookSearchResult[]> {
  return window.studbook.buscar(term)
}

export async function importarAnimalStudbook(registro: string): Promise<StudbookImportPayload> {
  return window.studbook.importar(registro)
}
