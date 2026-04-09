import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type LeilaoCriarPayload = {
  titulo_evento: string
  data: string
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
}

type LeilaoAtualizarPayload = Partial<LeilaoCriarPayload>

type AnimalCriarPayload = {
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
  altura: string
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
}

type AnimalAtualizarPayload = Partial<Omit<AnimalCriarPayload, 'leilao_id'>>
type AnimalAtualizacaoEmLotePayload = {
  id: string
} & AnimalAtualizarPayload

type Leilao = {
  id: string
  titulo_evento: string
  data: string
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
  total_animais: number
  gc_sync_status?: 'success' | 'error' | null
  gc_sync_at?: string | null
  gc_sync_error?: string | null
  criado_em: string
  atualizado_em: string
}

type Animal = {
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
  altura: string
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
  criado_em: string
  atualizado_em: string
}

type OperacaoEstadoPayload = {
  leilao: Leilao | null
  animal: Animal | null
  selecao_modo: 'SIMPLES' | 'COMPOSTO'
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

type ModoConfigPayload = {
  modo: 'HOST' | 'REMOTO' | null
  hostIp: string
  portaApp: number
}

type OperacaoConexaoPayload = {
  modo: 'HOST' | 'REMOTO' | null
  hostIp: string
  porta: number
  baseUrl: string
  ipsDisponiveis: string[]
}

type OperacaoEstadoPersistido = {
  animalId: string | null
  selecaoModo: 'SIMPLES' | 'COMPOSTO'
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

type ApiImportProviderConfigPayload = {
  id: string
  nome: string
  url: string
}

type ApiImportProviderPayload = {
  id: string
  nome: string
  url: string
}

type GcApiConfigPayload = {
  baseUrl: string
  accessToken: string
  deviceName: string
  lastPulledAt: string | null
}

type GcApiSyncSummaryPayload = {
  pushed: number
  pulled: number
  created: number
  updated: number
  deleted: number
  skipped: number
  serverTime: string | null
}

// Custom APIs for renderer
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    contextBridge.exposeInMainWorld('config', {
      setModo: (config: ModoConfigPayload) => ipcRenderer.invoke('config:setModo', config),
      getModo: () => ipcRenderer.invoke('config:getModo'),
      getModoConfig: () => ipcRenderer.invoke('config:getModoConfig'),
      getVmix: () => ipcRenderer.invoke('config:getVmix'),
      setVmix: (vmix: {
        ativo: boolean
        ip: string
        porta: number
        inputSelecionado: { key: string; number: string; title: string; type: string } | null
        srt: { ativo: boolean; porta: number | null }
      }) => ipcRenderer.invoke('config:setVmix', vmix),
      listarInputsVmix: (vmix: {
        ativo: boolean
        ip: string
        porta: number
        inputSelecionado: { key: string; number: string; title: string; type: string } | null
        srt: { ativo: boolean; porta: number | null }
      }) => ipcRenderer.invoke('config:listarInputsVmix', vmix),
      acionarOverlayVmix: (vmix: {
        ativo: boolean
        ip: string
        porta: number
        inputSelecionado: { key: string; number: string; title: string; type: string } | null
        srt: { ativo: boolean; porta: number | null }
      }) => ipcRenderer.invoke('config:acionarOverlayVmix', vmix),
      iniciarPreviewSrt: (vmix: {
        ativo: boolean
        ip: string
        porta: number
        inputSelecionado: { key: string; number: string; title: string; type: string } | null
        srt: { ativo: boolean; porta: number | null }
      }) => ipcRenderer.invoke('config:iniciarPreviewSrt', vmix),
      pararPreviewSrt: () => ipcRenderer.invoke('config:pararPreviewSrt'),
      getStatusPreviewSrt: () => ipcRenderer.invoke('config:getStatusPreviewSrt'),
      abrirMonitorSrtExterno: (vmix: {
        ativo: boolean
        ip: string
        porta: number
        inputSelecionado: { key: string; number: string; title: string; type: string } | null
        srt: { ativo: boolean; porta: number | null }
      }) => ipcRenderer.invoke('config:abrirMonitorSrtExterno', vmix),
      pararMonitorSrtExterno: () => ipcRenderer.invoke('config:pararMonitorSrtExterno'),
      getApiImportProviders: () => ipcRenderer.invoke('config:getApiImportProviders'),
      setApiImportProviders: (providers: ApiImportProviderConfigPayload[]) =>
        ipcRenderer.invoke('config:setApiImportProviders', providers),
      getGcApi: () => ipcRenderer.invoke('config:getGcApi'),
      setGcApi: (config: GcApiConfigPayload) => ipcRenderer.invoke('config:setGcApi', config),
      testGcApi: (config: GcApiConfigPayload) => ipcRenderer.invoke('config:testGcApi', config),
      getLayoutAnimais: (leilaoId: string) => ipcRenderer.invoke('config:getLayoutAnimais', leilaoId),
      setLayoutAnimais: (
        leilaoId: string,
        layout: { modo: 'AGREGADAS' | 'SEPARADAS'; incluirRacaNasImportacoes: boolean }
      ) => ipcRenderer.invoke('config:setLayoutAnimais', leilaoId, layout)
    })

    contextBridge.exposeInMainWorld('leiloes', {
      listar: () => ipcRenderer.invoke('leiloes:listar'),
      obter: (id: string) => ipcRenderer.invoke('leiloes:obter', id),
      criar: (payload: LeilaoCriarPayload) => ipcRenderer.invoke('leiloes:criar', payload),
      atualizar: (id: string, payload: LeilaoAtualizarPayload) => ipcRenderer.invoke('leiloes:atualizar', id, payload),
      remover: (id: string) => ipcRenderer.invoke('leiloes:remover', id)
    })

    contextBridge.exposeInMainWorld('animais', {
      listarPorLeilao: (leilaoId: string) => ipcRenderer.invoke('animais:listarPorLeilao', leilaoId),
      criar: (payload: AnimalCriarPayload) => ipcRenderer.invoke('animais:criar', payload),
      atualizar: (id: string, payload: AnimalAtualizarPayload) =>
        ipcRenderer.invoke('animais:atualizar', id, payload),
      atualizarEmLote: (payloads: AnimalAtualizacaoEmLotePayload[]) =>
        ipcRenderer.invoke('animais:atualizarEmLote', payloads),
      remover: (id: string) => ipcRenderer.invoke('animais:remover', id),
      removerPorLeilao: (leilaoId: string) => ipcRenderer.invoke('animais:removerPorLeilao', leilaoId)
    })

    contextBridge.exposeInMainWorld('gcSync', {
      sincronizarTudo: (): Promise<GcApiSyncSummaryPayload> => ipcRenderer.invoke('gc-sync:sincronizarTudo'),
      sincronizarLeilao: (leilaoId: string): Promise<GcApiSyncSummaryPayload> =>
        ipcRenderer.invoke('gc-sync:sincronizarLeilao', leilaoId)
    })

    contextBridge.exposeInMainWorld('importacao', {
      excel: (leilaoId: string, incluirRacaNasInformacoes = false) =>
        ipcRenderer.invoke('importacao:excel', leilaoId, incluirRacaNasInformacoes),
      listarLeiloesApi: (provider: ApiImportProviderPayload) =>
        ipcRenderer.invoke('importacao:api:listarLeiloes', provider),
      importarLeilaoApi: (
        leilaoId: string,
        provider: ApiImportProviderPayload,
        auctionId: number,
        incluirRacaNasInformacoes = false
      ) =>
        ipcRenderer.invoke(
          'importacao:api:importarLeilao',
          leilaoId,
          provider,
          auctionId,
          incluirRacaNasInformacoes
        )
    })

    contextBridge.exposeInMainWorld('studbook', {
      buscar: (term: string) => ipcRenderer.invoke('studbook:buscar', term),
      importar: (registro: string) => ipcRenderer.invoke('studbook:importar', registro)
    })

    contextBridge.exposeInMainWorld('operacao', {
      obterArquivo: (leilaoId: string) => ipcRenderer.invoke('operacao:obterArquivo', leilaoId),
      obterEstado: (leilaoId: string): Promise<OperacaoEstadoPersistido | null> =>
        ipcRenderer.invoke('operacao:obterEstado', leilaoId),
      obterConexao: (): Promise<OperacaoConexaoPayload> => ipcRenderer.invoke('operacao:obterConexao'),
      atualizarArquivo: (leilaoId: string, payload: OperacaoEstadoPayload) =>
        ipcRenderer.invoke('operacao:atualizarArquivo', leilaoId, payload)
    })

    contextBridge.exposeInMainWorld('janela', {
      definirPreset: (preset: 'DESKTOP' | 'OPERACAO') =>
        ipcRenderer.invoke('janela:definirPreset', preset),
      abrirEdicaoRapida: (leilaoId: string, animalId?: string) =>
        ipcRenderer.invoke('janela:abrirEdicaoRapida', leilaoId, animalId),
      abrirEditorLeilaoOperacao: (leilaoId: string) =>
        ipcRenderer.invoke('janela:abrirEditorLeilaoOperacao', leilaoId),
      abrirEditorAnimalOperacao: (leilaoId: string, animalId: string) =>
        ipcRenderer.invoke('janela:abrirEditorAnimalOperacao', leilaoId, animalId),
      abrirConfiguracaoVmixOperacao: (leilaoId: string) =>
        ipcRenderer.invoke('janela:abrirConfiguracaoVmixOperacao', leilaoId),
      abrirEditorLeilaoRemoto: (leilaoId: string) =>
        ipcRenderer.invoke('janela:abrirEditorLeilaoRemoto', leilaoId),
      abrirEditorAnimalRemoto: (leilaoId: string, animalId: string) =>
        ipcRenderer.invoke('janela:abrirEditorAnimalRemoto', leilaoId, animalId),
      abrirConfiguracaoAnimaisRemoto: (leilaoId: string) =>
        ipcRenderer.invoke('janela:abrirConfiguracaoAnimaisRemoto', leilaoId)
    })

    contextBridge.exposeInMainWorld('srtPlayer', {
      prepare: () => ipcRenderer.invoke('srt-player:prepare'),
      setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
        ipcRenderer.invoke('srt-player:setBounds', bounds),
      setVisible: (visible: boolean) => ipcRenderer.invoke('srt-player:setVisible', visible),
      setMute: (muted: boolean) => ipcRenderer.invoke('srt-player:setMute', muted),
      start: (payload: { url: string; muted?: boolean; volume?: number }) =>
        ipcRenderer.invoke('srt-player:start', payload),
      stop: () => ipcRenderer.invoke('srt-player:stop'),
      shutdown: () => ipcRenderer.invoke('srt-player:shutdown')
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
