type StoreSchema = {
  modo: 'HOST' | 'REMOTO' | null
  vmix: {
    ativo: boolean
    ip: string
    porta: number
    inputSelecionado: {
      key: string
      number: string
      title: string
      type: string
    } | null
    srt: {
      ativo: boolean
      porta: number | null
    }
  }
  layoutAnimaisPorLeilao: Record<
    string,
    { modo: 'AGREGADAS' | 'SEPARADAS'; incluirRacaNasImportacoes: boolean }
  >
  operacaoPorLeilao: Record<
    string,
    {
      animalId: string | null
      layoutModo: 'AGREGADAS' | 'SEPARADAS'
      lanceAtual: string
      lanceAtualCentavos: number
      lanceDolar: string
      totalReal: string
      totalDolar: string
    }
  >
}

type ElectronStoreInstance = {
  get: <K extends keyof StoreSchema>(key: K) => StoreSchema[K]
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) => void
}

let store: ElectronStoreInstance | null = null

export async function getStore() {
  if (store) return store

  const mod = await import('electron-store')
  const StoreCtor = mod.default as unknown as new (opts: {
    name: string
    defaults: StoreSchema
  }) => ElectronStoreInstance

  store = new StoreCtor({
    name: 'config',
    defaults: {
      modo: null,
      vmix: {
        ativo: false,
        ip: '',
        porta: 8088,
        inputSelecionado: null,
        srt: {
          ativo: false,
          porta: null
        }
      },
      layoutAnimaisPorLeilao: {},
      operacaoPorLeilao: {}
    }
  })

  return store
}
