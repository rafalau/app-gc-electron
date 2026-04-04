export type ImportSummary = {
  totalRead: number
  imported: number
  updated: number
  skipped: number
  invalid: number
  errors: string[]
}

export type ApiAuctionOption = {
  id: number
  titulo: string
  dataHora: string
  totalAnimais: number
}

export type TbsAuctionOption = ApiAuctionOption
export type Remate360EventOption = ApiAuctionOption

export type ApiImportProviderConfig = {
  id: string
  nome: string
  url: string
}

export type ApiImportProviderOption = ApiImportProviderConfig

export type StudbookSearchResult = {
  nome: string
  registro: string
}

export type StudbookImportPayload = {
  nome: string
  informacoes: string
  genealogia: string
}
