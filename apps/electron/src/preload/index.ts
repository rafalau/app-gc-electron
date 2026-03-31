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

// Custom APIs for renderer
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    contextBridge.exposeInMainWorld('config', {
      setModo: (modo: 'HOST' | 'REMOTO' | null) => ipcRenderer.invoke('config:setModo', modo),
      getModo: () => ipcRenderer.invoke('config:getModo'),
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
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
