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
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
}

type AnimalAtualizarPayload = Partial<Omit<AnimalCriarPayload, 'leilao_id'>>

type Leilao = {
  id: string
  titulo_evento: string
  data: string
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
  total_animais: number
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
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
  criado_em: string
  atualizado_em: string
}

type OperacaoEstadoPayload = {
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

// Custom APIs for renderer
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    contextBridge.exposeInMainWorld('config', {
      setModo: (modo: 'HOST' | 'REMOTO' | null) => ipcRenderer.invoke('config:setModo', modo),
      getModo: () => ipcRenderer.invoke('config:getModo'),
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
      remover: (id: string) => ipcRenderer.invoke('animais:remover', id),
      removerPorLeilao: (leilaoId: string) => ipcRenderer.invoke('animais:removerPorLeilao', leilaoId)
    })

    contextBridge.exposeInMainWorld('importacao', {
      excel: (leilaoId: string, incluirRacaNasInformacoes = false) =>
        ipcRenderer.invoke('importacao:excel', leilaoId, incluirRacaNasInformacoes)
    })

    contextBridge.exposeInMainWorld('tbs', {
      listarLeiloes: () => ipcRenderer.invoke('tbs:listarLeiloes'),
      importarLeilao: (leilaoId: string, auctionId: number, incluirRacaNasInformacoes = false) =>
        ipcRenderer.invoke('tbs:importarLeilao', leilaoId, auctionId, incluirRacaNasInformacoes)
    })

    contextBridge.exposeInMainWorld('remate360', {
      listarEventos: () => ipcRenderer.invoke('remate360:listarEventos'),
      importarEvento: (leilaoId: string, eventId: number, incluirRacaNasInformacoes = false) =>
        ipcRenderer.invoke(
          'remate360:importarEvento',
          leilaoId,
          eventId,
          incluirRacaNasInformacoes
        )
    })

    contextBridge.exposeInMainWorld('studbook', {
      buscar: (term: string) => ipcRenderer.invoke('studbook:buscar', term),
      importar: (registro: string) => ipcRenderer.invoke('studbook:importar', registro)
    })

    contextBridge.exposeInMainWorld('operacao', {
      obterArquivo: (leilaoId: string) => ipcRenderer.invoke('operacao:obterArquivo', leilaoId),
      obterEstado: (leilaoId: string) => ipcRenderer.invoke('operacao:obterEstado', leilaoId),
      atualizarArquivo: (leilaoId: string, payload: OperacaoEstadoPayload) =>
        ipcRenderer.invoke('operacao:atualizarArquivo', leilaoId, payload)
    })

    contextBridge.exposeInMainWorld('janela', {
      definirPreset: (preset: 'DESKTOP' | 'OPERACAO') =>
        ipcRenderer.invoke('janela:definirPreset', preset)
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
