export type VmixConfig = {
  ativo: boolean
  ip: string
  porta: number
  inputSelecionado: VmixInput | null
}

export type VmixInput = {
  number: string
  title: string
  type: string
  key: string
}
