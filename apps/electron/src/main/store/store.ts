import Store from 'electron-store'

type StoreSchema = {
  modo: 'HOST' | 'REMOTO' | null
  conexaoApp: {
    hostIp: string
    porta: number
  }
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
  apiImportProviders: Array<{
    id: string
    nome: string
    url: string
  }>
}

type ElectronStoreInstance = {
  get: <K extends keyof StoreSchema>(key: K) => StoreSchema[K]
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) => void
}

let store: ElectronStoreInstance | null = null

export async function getStore() {
  if (store) return store

  const StoreCtor = ((Store as { default?: unknown }).default ?? Store) as new (opts: {
    name: string
    defaults: StoreSchema
  }) => ElectronStoreInstance

  store = new StoreCtor({
    name: 'config',
    defaults: {
      modo: null,
      conexaoApp: {
        hostIp: '',
        porta: 18452
      },
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
      operacaoPorLeilao: {},
      apiImportProviders: [
        {
          id: 'remate360',
          nome: 'Remate360',
          url: 'https://api-integrador.remate360.com.br/api/public/NnngF8tD8xIPVLQe1UK3fI0MHHqbKmdIZtgECOGiJR7IvFSHjSjWhbBm3yuaYpNH/eventos'
        },
        {
          id: 'rpn-leiloes',
          nome: 'RPN Leilões',
          url: 'https://rpnleiloes.com.br/api/leiloes-ativos'
        },
        {
          id: 'fom-leiloes',
          nome: 'FOM Leilões',
          url: 'https://fomleiloes.com.br/api/leiloes-ativos'
        },
        {
          id: 'canal-business',
          nome: 'Canal Business',
          url: 'https://canalbusiness.com.br/api/leiloes-ativos'
        },
        {
          id: 'agencia-tbs',
          nome: 'Agência TBS',
          url: 'https://agenciatbs.net.br/api/leiloes-ativos'
        },
        {
          id: 'sprint-sales',
          nome: 'Sprint Sales',
          url: 'https://leilaosprintsales.com.br/api/leiloes-ativos'
        }
      ]
    }
  })

  return store
}
