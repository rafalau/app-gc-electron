export {}

export type Leilao = {
  id: string
  titulo_evento: string
  data: string // yyyy-mm-dd
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
  total_animais: number
  criado_em: string
  atualizado_em: string
}

export type LeilaoCriarPayload = {
  titulo_evento: string
  data: string
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
}

export type LeilaoAtualizarPayload = Partial<LeilaoCriarPayload>

export type Animal = {
  id: string
  leilao_id: string
  lote: string
  nome: string
  categoria: string
  vendedor: string
  condicoes_pagamento_especificas: string
  raca: string
  sexo: string
  pelagem: string
  nascimento: string
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
  criado_em: string
  atualizado_em: string
}

export type AnimalCriarPayload = {
  leilao_id: string
  lote: string
  nome: string
  categoria: string
  vendedor: string
  condicoes_pagamento_especificas: string
  raca: string
  sexo: string
  pelagem: string
  nascimento: string
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
}

export type AnimalAtualizarPayload = Partial<Omit<AnimalCriarPayload, 'leilao_id'>>

export type ImportSummary = {
  totalRead: number
  imported: number
  updated: number
  skipped: number
  invalid: number
  errors: string[]
}

export type TbsAuctionOption = {
  id: number
  titulo: string
  dataHora: string
  totalAnimais: number
}

export type Remate360EventOption = {
  id: number
  titulo: string
  dataHora: string
  totalAnimais: number
}

export type StudbookSearchResult = {
  nome: string
  registro: string
}

export type StudbookImportPayload = {
  nome: string
  informacoes: string
  genealogia: string
}

export type LayoutAnimaisConfig = {
  modo: 'AGREGADAS' | 'SEPARADAS'
  incluirRacaNasImportacoes: boolean
}

declare global {
  interface Window {
    config: {
      setModo: (modo: 'HOST' | 'REMOTO' | null) => Promise<void>
      getModo: () => Promise<'HOST' | 'REMOTO' | null>
      getLayoutAnimais: (leilaoId: string) => Promise<LayoutAnimaisConfig>
      setLayoutAnimais: (leilaoId: string, layout: LayoutAnimaisConfig) => Promise<void>
    }
    leiloes: {
      listar: () => Promise<Leilao[]>
      obter: (id: string) => Promise<Leilao | null>
      criar: (payload: LeilaoCriarPayload) => Promise<Leilao>
      atualizar: (id: string, payload: LeilaoAtualizarPayload) => Promise<Leilao>
      remover: (id: string) => Promise<boolean>
    }
    animais: {
      listarPorLeilao: (leilaoId: string) => Promise<Animal[]>
      criar: (payload: AnimalCriarPayload) => Promise<Animal>
      atualizar: (id: string, payload: AnimalAtualizarPayload) => Promise<Animal>
      remover: (id: string) => Promise<boolean>
      removerPorLeilao: (leilaoId: string) => Promise<boolean>
    }
    importacao: {
      excel: (leilaoId: string, incluirRacaNasInformacoes?: boolean) => Promise<ImportSummary | null>
    }
    tbs: {
      listarLeiloes: () => Promise<TbsAuctionOption[]>
      importarLeilao: (
        leilaoId: string,
        auctionId: number,
        incluirRacaNasInformacoes?: boolean
      ) => Promise<ImportSummary>
    }
    remate360: {
      listarEventos: () => Promise<Remate360EventOption[]>
      importarEvento: (
        leilaoId: string,
        eventId: number,
        incluirRacaNasInformacoes?: boolean
      ) => Promise<ImportSummary>
    }
    studbook: {
      buscar: (term: string) => Promise<StudbookSearchResult[]>
      importar: (registro: string) => Promise<StudbookImportPayload>
    }
  }
}
