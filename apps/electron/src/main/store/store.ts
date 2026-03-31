type StoreSchema = {
  modo: 'HOST' | 'REMOTO' | null
  layoutAnimaisPorLeilao: Record<
    string,
    { modo: 'AGREGADAS' | 'SEPARADAS'; incluirRacaNasImportacoes: boolean }
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
      layoutAnimaisPorLeilao: {}
    }
  })

  return store
}
