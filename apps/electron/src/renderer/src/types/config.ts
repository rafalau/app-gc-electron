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
