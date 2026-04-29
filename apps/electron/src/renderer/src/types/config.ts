export type VmixConfig = {
  ativo: boolean
  ip: string
  porta: number
  inputSelecionado: VmixInput | null
  inputSelecionadoCoberturas: VmixInput | null
  inputLista: VmixInput | null
  itemListaSelecionado: VmixListItem | null
  srt: SrtConfig
}

export type VmixInput = {
  number: string
  title: string
  type: string
  key: string
}

export type VmixListItem = {
  index: number
  title: string
  value: string
  selected: boolean
}

export type VmixListState = {
  items: VmixListItem[]
  autoPlayNext: boolean | null
}

export type SrtConfig = {
  ativo: boolean
  porta: number | null
  networkCachingMs: number | null
}

export type SrtPreviewStatus = {
  ativo: boolean
  url: string | null
  endpoint: string | null
  erro: string | null
}

export type ModoConfig = {
  modo: 'HOST' | 'REMOTO' | null
  hostIp: string
  portaApp: number
}

export type GcApiConfig = {
  baseUrl: string
  accessToken: string
  deviceName: string
  lastPulledAt: string | null
}

export type GcApiSyncSummary = {
  pushed: number
  pulled: number
  created: number
  updated: number
  deleted: number
  skipped: number
  serverTime: string | null
}
