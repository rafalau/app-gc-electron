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

export type VmixConfig = {
  ativo: boolean
  ip: string
  porta: number
  inputSelecionado: VmixInput | null
  srt: SrtConfig
}

export type VmixInput = {
  number: string
  title: string
  type: string
  key: string
}

export type SrtConfig = {
  ativo: boolean
  porta: number | null
}

export type SrtPreviewStatus = {
  ativo: boolean
  url: string | null
  endpoint: string | null
  erro: string | null
}

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

export type ModoConfig = {
  modo: 'HOST' | 'REMOTO' | null
  hostIp: string
  portaApp: number
}

export type OperacaoConexaoInfo = {
  modo: 'HOST' | 'REMOTO' | null
  hostIp: string
  porta: number
  baseUrl: string
  ipsDisponiveis: string[]
}

export type OperacaoEstadoPersistido = {
  animalId: string | null
  lanceDigitado: string
  layoutModo: 'AGREGADAS' | 'SEPARADAS'
  lanceAtual: string
  lanceAtualCentavos: number
  lanceDolar: string
  totalReal: string
  totalDolar: string
}

declare global {
  interface Window {
    config: {
      setModo: (config: ModoConfig) => Promise<void>
      getModo: () => Promise<'HOST' | 'REMOTO' | null>
      getModoConfig: () => Promise<ModoConfig>
      getVmix: () => Promise<VmixConfig>
      setVmix: (vmix: VmixConfig) => Promise<void>
      listarInputsVmix: (vmix: VmixConfig) => Promise<VmixInput[]>
      acionarOverlayVmix: (vmix: VmixConfig) => Promise<{ ok: boolean }>
      iniciarPreviewSrt: (vmix: VmixConfig) => Promise<SrtPreviewStatus>
      pararPreviewSrt: () => Promise<SrtPreviewStatus>
      getStatusPreviewSrt: () => Promise<SrtPreviewStatus>
      abrirMonitorSrtExterno: (vmix: VmixConfig) => Promise<{ ok: boolean }>
      pararMonitorSrtExterno: () => Promise<{ ok: boolean }>
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
    operacao: {
      obterArquivo: (leilaoId: string) => Promise<OperacaoArquivoInfo>
      obterEstado: (leilaoId: string) => Promise<OperacaoEstadoPersistido | null>
      obterConexao: () => Promise<OperacaoConexaoInfo>
      atualizarArquivo: (
        leilaoId: string,
        payload: OperacaoEstadoPayload
      ) => Promise<OperacaoArquivoInfo>
    }
    janela: {
      definirPreset: (preset: 'DESKTOP' | 'OPERACAO') => Promise<void>
    }
    srtPlayer: {
      prepare: () => Promise<{ ok: boolean }>
      setBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<{ ok: boolean }>
      setVisible: (visible: boolean) => Promise<{ ok: boolean }>
      setMute: (muted: boolean) => Promise<{ ok: boolean }>
      start: (payload: { url: string; muted?: boolean; volume?: number }) => Promise<{ ok: boolean }>
      stop: () => Promise<{ ok: boolean }>
      shutdown: () => Promise<{ ok: boolean }>
    }
  }
}
