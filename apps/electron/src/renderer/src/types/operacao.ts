import type { Animal } from './animal'
import type { Leilao } from './leilao'

export type OperacaoEstadoPayload = {
  leilao: Leilao | null
  animal: Animal | null
  layout_modo: 'AGREGADAS' | 'SEPARADAS'
  lance_digitado: string
  lance_atual: string
  lance_atual_centavos: number
  lance_dolar: string
  total_real: string
  total_dolar: string
  atualizado_em: string
}

export type OperacaoArquivoInfo = {
  url_http: string
  urls_http: string[]
}

export type OperacaoEstadoPersistido = {
  animalId: string | null
  layoutModo: 'AGREGADAS' | 'SEPARADAS'
  lanceAtual: string
  lanceAtualCentavos: number
  lanceDolar: string
  totalReal: string
  totalDolar: string
}
