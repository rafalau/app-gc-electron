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

// Custom APIs for renderer
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    contextBridge.exposeInMainWorld('config', {
      setModo: (modo: 'HOST' | 'REMOTO') => ipcRenderer.invoke('config:setModo', modo),
      getModo: () => ipcRenderer.invoke('config:getModo')
    })

    contextBridge.exposeInMainWorld('leiloes', {
      listar: () => ipcRenderer.invoke('leiloes:listar'),
      criar: (payload: LeilaoCriarPayload) => ipcRenderer.invoke('leiloes:criar', payload),
      atualizar: (id: string, payload: LeilaoAtualizarPayload) => ipcRenderer.invoke('leiloes:atualizar', id, payload),
      remover: (id: string) => ipcRenderer.invoke('leiloes:remover', id)
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
