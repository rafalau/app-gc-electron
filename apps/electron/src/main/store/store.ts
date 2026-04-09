import Store from 'electron-store'
import { hostname } from 'node:os'

const VMIX_DEFAULT_PORT = 8088
const SRT_DEFAULT_PORT = 9001
const GC_API_DEFAULT_DEVICE_NAME = hostname().trim() || 'gc-desktop'
const GC_API_DEFAULT_BASE_URL = 'https://api-app-gc.remate360.com.br'

type StoreSchema = {
  modo: 'HOST' | 'REMOTO' | null
  operacaoLeilaoAtualId: string | null
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
  >
  apiImportProviders: Array<{
    id: string
    nome: string
    url: string
  }>
  gcApi: {
    baseUrl: string
    accessToken: string
    deviceName: string
    lastPulledAt: string | null
  }
  gcApiLeiloesSync: Record<
    string,
    {
      status: 'success' | 'error'
      lastSyncedAt: string | null
      lastError: string | null
      updatedAt: string
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

  const StoreCtor = ((Store as { default?: unknown }).default ?? Store) as new (opts: {
    name: string
    defaults: StoreSchema
  }) => ElectronStoreInstance

  store = new StoreCtor({
    name: 'config',
    defaults: {
      modo: null,
      operacaoLeilaoAtualId: null,
      conexaoApp: {
        hostIp: '',
        porta: 18452
      },
      vmix: {
        ativo: false,
        ip: '',
        porta: VMIX_DEFAULT_PORT,
        inputSelecionado: null,
        srt: {
          ativo: false,
          porta: SRT_DEFAULT_PORT
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
      ],
      gcApi: {
        baseUrl: GC_API_DEFAULT_BASE_URL,
        accessToken: '',
        deviceName: GC_API_DEFAULT_DEVICE_NAME,
        lastPulledAt: null
      },
      gcApiLeiloesSync: {}
    }
  })

  return store
}
