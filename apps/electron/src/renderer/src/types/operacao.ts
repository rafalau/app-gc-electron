import type { Animal } from './animal'
import type { Leilao } from './leilao'

export type OperacaoSelecaoModo = 'SIMPLES' | 'COMPOSTO'

export type OperacaoEstadoPayload = {
  leilao: Leilao | null
  animal: Animal | null
  selecao_modo: OperacaoSelecaoModo
  animais_selecionados_ids: string[]
  animal_atual_index: number
  intervalo_segundos: number
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
  selecaoModo: OperacaoSelecaoModo
  animaisSelecionadosIds: string[]
  animalAtualIndex: number
  intervaloSegundos: number
  lanceDigitado: string
  layoutModo: 'AGREGADAS' | 'SEPARADAS'
  lanceAtual: string
  lanceAtualCentavos: number
  lanceDolar: string
  totalReal: string
  totalDolar: string
}

export type OperacaoConexaoInfo = {
  modo: 'HOST' | 'REMOTO' | null
  hostIp: string
  porta: number
  baseUrl: string
  ipsDisponiveis: string[]
}
