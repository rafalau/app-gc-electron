import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CATEGORIAS_ANIMAL, type Animal, type AnimalCriarPayload } from '../types/animal'
import type { Leilao } from '../types/leilao'
import type {
  ApiAuctionOption,
  ApiImportProviderConfig,
  ApiImportProviderOption,
  ImportSummary,
} from '../types/importacao'
import {
  atualizarAnimal,
  criarAnimal,
  listarAnimaisPorLeilao,
  removerAnimaisPorLeilao,
  removerAnimal
} from '../services/animais.service'
import {
  importarExcel,
  importarLeilaoApi,
  listarLeiloesApi
} from '../services/importacao.service'
import { obterLeilao } from '../services/leiloes.service'
import { obterApiImportProviders } from '../services/config.service'
import { obterConexaoOperacao } from '../services/operacao.service'

export type ModalAnimalModo = 'CRIAR' | 'EDITAR'
export type LayoutInformacoesAnimais = 'AGREGADAS' | 'SEPARADAS'

function toApiImportProviderOptions(providers: ApiImportProviderConfig[]): ApiImportProviderOption[] {
  return providers.map((provider) => ({
    id: provider.id,
    nome: provider.nome,
    url: provider.url
  }))
}

function getPreferredApiImportProviderId(providers: ApiImportProviderOption[]) {
  return providers[0]?.id ?? ''
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function criarFormVazio(leilaoId: string): AnimalCriarPayload {
  return {
    leilao_id: leilaoId,
    lote: '',
    nome: '',
    categoria: CATEGORIAS_ANIMAL[0],
    vendedor: '',
    condicoes_pagamento_especificas: '',
    raca: '',
    sexo: '',
    pelagem: '',
    nascimento: '',
    altura: '',
    informacoes: '',
    genealogia: '',
    condicoes_cobertura: []
  }
}

function splitLote(lote: string) {
  return lote
    .trim()
    .toUpperCase()
    .match(/\d+|[^\d]+/g)
    ?.map((parte) => {
      const numerica = /^\d+$/.test(parte)
      return {
        valor: parte,
        numerica,
        numero: numerica ? BigInt(parte) : null
      }
    }) ?? [{ valor: lote.trim().toUpperCase(), numerica: false, numero: null }]
}

function compararLote(a: string, b: string) {
  const partesA = splitLote(a)
  const partesB = splitLote(b)
  const limite = Math.max(partesA.length, partesB.length)

  for (let i = 0; i < limite; i += 1) {
    const parteA = partesA[i]
    const parteB = partesB[i]

    if (!parteA) return -1
    if (!parteB) return 1

    if (parteA.numerica && parteB.numerica) {
      if (parteA.numero! < parteB.numero!) return -1
      if (parteA.numero! > parteB.numero!) return 1
      if (parteA.valor.length !== parteB.valor.length) return parteA.valor.length - parteB.valor.length
      continue
    }

    if (parteA.numerica !== parteB.numerica) {
      return parteA.numerica ? -1 : 1
    }

    const comparacao = parteA.valor.localeCompare(parteB.valor, 'pt-BR')
    if (comparacao !== 0) return comparacao
  }

  return a.localeCompare(b, 'pt-BR')
}

function validarLote(lote: string) {
  const valor = lote.trim().toUpperCase()
  const match = valor.match(/^(\d+)/)
  if (!match) return 'O lote deve começar com número'
  if (match[1].length < 2) return 'O lote deve ter pelo menos dois dígitos no início. Ex: 01, 02, 10'
  return ''
}

export function useAnimais(leilaoId: string) {
  const router = useRouter()
  const carregando = ref(true)
  const leilao = ref<Leilao | null>(null)
  const animais = ref<Animal[]>([])
  const busca = ref('')

  const modalAberto = ref(false)
  const modalModo = ref<ModalAnimalModo>('CRIAR')
  const editandoId = ref<string | null>(null)
  const erroModal = ref('')
  const form = ref<AnimalCriarPayload>(criarFormVazio(leilaoId))
  const resumoImportacao = ref<ImportSummary | null>(null)
  const resumoAberto = ref(false)
  const limpandoTudo = ref(false)
  const excluindoAnimalId = ref<string | null>(null)
  const apiImportAberto = ref(false)
  const apiImportLoading = ref(false)
  const apiImportImportando = ref(false)
  const apiImportErro = ref('')
  const apiImportLeiloes = ref<ApiAuctionOption[]>([])
  const apiImportProviders = ref<ApiImportProviderOption[]>([])
  const apiImportSelectedProviderId = ref<string>('')
  const apiImportSelectedAuctionId = ref<number | null>(null)
  const apiImportHasConfiguredProviders = computed(() => apiImportProviders.value.length > 0)
  const layoutInformacoesModo = ref<LayoutInformacoesAnimais>('AGREGADAS')
  const incluirRacaNasImportacoes = ref(false)
  let eventSource: EventSource | null = null
  let primeiroEventoSyncRecebido = false

  async function carregarProvidersApi() {
    const providers = await obterApiImportProviders()
    apiImportProviders.value = toApiImportProviderOptions(providers)
    apiImportSelectedProviderId.value = getPreferredApiImportProviderId(apiImportProviders.value)
  }

  function getApiImportProviderSelecionado() {
    return apiImportProviders.value.find((provider) => provider.id === apiImportSelectedProviderId.value) ?? null
  }

  function erroDeConexaoRemota(error: unknown) {
    const message = (error as Error)?.message ?? ''
    return (
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('Falha na comunicação com o host')
    )
  }

  async function carregar() {
    carregando.value = true
    try {
      const [leilaoAtual, lista, layout] = await Promise.all([
        obterLeilao(leilaoId),
        listarAnimaisPorLeilao(leilaoId),
        window.config.getLayoutAnimais(leilaoId)
      ])
      leilao.value = leilaoAtual
      animais.value = lista
      layoutInformacoesModo.value = layout.modo
      incluirRacaNasImportacoes.value = layout.incluirRacaNasImportacoes
    } catch (error) {
      if (erroDeConexaoRemota(error)) {
        router.replace({
          path: '/conexao',
          query: { erro: 'nao-foi-possivel-conectar-ao-host' }
        })
        return
      }
      throw error
    } finally {
      carregando.value = false
    }
  }

  const animaisFiltrados = computed(() => {
    const termo = busca.value.trim().toLowerCase()
    const lista = [...animais.value].sort((a, b) => compararLote(a.lote, b.lote))

    if (!termo) return lista

    return lista.filter((animal) =>
      [
        animal.lote,
        animal.nome,
        animal.categoria,
        animal.vendedor,
        animal.condicoes_pagamento_especificas,
        animal.raca,
        animal.sexo,
        animal.pelagem,
        animal.nascimento,
        animal.informacoes,
        animal.genealogia,
        animal.condicoes_cobertura.join(' ')
      ]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    )
  })

  function abrirCriar() {
    erroModal.value = ''
    modalModo.value = 'CRIAR'
    editandoId.value = null
    form.value = criarFormVazio(leilaoId)
    modalAberto.value = true
  }

  function abrirEditar(animal: Animal) {
    erroModal.value = ''
    modalModo.value = 'EDITAR'
    editandoId.value = animal.id
    form.value = {
      leilao_id: animal.leilao_id,
      lote: animal.lote,
      nome: animal.nome,
      categoria: animal.categoria,
      vendedor: animal.vendedor,
      condicoes_pagamento_especificas: animal.condicoes_pagamento_especificas,
      raca: animal.raca,
      sexo: animal.sexo,
      pelagem: animal.pelagem,
      nascimento: animal.nascimento,
      altura: animal.altura,
      informacoes: animal.informacoes,
      genealogia: animal.genealogia,
      condicoes_cobertura: [...animal.condicoes_cobertura]
    }
    modalAberto.value = true
  }

  function fecharModal() {
    modalAberto.value = false
  }

  function fecharResumo() {
    resumoAberto.value = false
  }

  async function importarPlanilhaExcel() {
    const resumo = await importarExcel(leilaoId, incluirRacaNasImportacoes.value)
    if (!resumo) return
    resumoImportacao.value = resumo
    resumoAberto.value = true
    await carregar()
  }

  async function carregarLeiloesApi(provider: ApiImportProviderOption) {
    apiImportErro.value = ''
    apiImportLoading.value = true

    try {
      apiImportLeiloes.value = await listarLeiloesApi(provider)
      apiImportSelectedAuctionId.value = apiImportLeiloes.value[0]?.id ?? null
    } catch (error) {
      apiImportErro.value = (error as Error).message
      apiImportLeiloes.value = []
      apiImportSelectedAuctionId.value = null
    } finally {
      apiImportLoading.value = false
    }
  }

  async function abrirImportacaoApi() {
    await carregarProvidersApi()
    if (!getApiImportProviderSelecionado()) return
    apiImportAberto.value = true
    await carregarLeiloesApi(getApiImportProviderSelecionado()!)
  }

  function fecharImportacaoApi() {
    apiImportAberto.value = false
  }

  async function selecionarProviderApi(providerId: string) {
    apiImportSelectedProviderId.value = providerId
    const provider = getApiImportProviderSelecionado()
    if (!provider) return
    await carregarLeiloesApi(provider)
  }

  function selecionarLeilaoApi(auctionId: number | null) {
    apiImportSelectedAuctionId.value = auctionId
  }

  async function importarDaApi() {
    if (!apiImportSelectedAuctionId.value) return
    const provider = getApiImportProviderSelecionado()
    if (!provider) return

    apiImportImportando.value = true
    apiImportErro.value = ''

    try {
      const resumo = await importarLeilaoApi(
        leilaoId,
        provider,
        apiImportSelectedAuctionId.value,
        incluirRacaNasImportacoes.value
      )
      resumoImportacao.value = resumo
      resumoAberto.value = true
      apiImportAberto.value = false
      await carregar()
    } catch (error) {
      apiImportErro.value = (error as Error).message
    } finally {
      apiImportImportando.value = false
    }
  }

  async function salvarModal(payload: AnimalCriarPayload) {
    erroModal.value = ''
    const payloadNormalizado: AnimalCriarPayload = {
      ...payload,
      condicoes_cobertura: [...payload.condicoes_cobertura]
    }

    if (!payloadNormalizado.lote.trim()) {
      erroModal.value = 'Informe o lote do animal'
      return
    }

    const erroLote = validarLote(payloadNormalizado.lote)
    if (erroLote) {
      erroModal.value = erroLote
      return
    }

    if (!payloadNormalizado.nome.trim()) {
      erroModal.value = 'Informe o nome do animal'
      return
    }

    if (
      payloadNormalizado.categoria === 'COBERTURAS' &&
      payloadNormalizado.condicoes_cobertura.length === 0
    ) {
      erroModal.value = 'Adicione ao menos uma condição para coberturas'
      return
    }

    form.value = { ...payloadNormalizado }

    if (modalModo.value === 'CRIAR') {
      await criarAnimal({ ...payloadNormalizado, leilao_id: leilaoId })
    } else {
      if (!editandoId.value) return
      await atualizarAnimal(editandoId.value, {
        lote: payloadNormalizado.lote,
        nome: payloadNormalizado.nome,
        categoria: payloadNormalizado.categoria,
        vendedor: payloadNormalizado.vendedor,
        condicoes_pagamento_especificas: payloadNormalizado.condicoes_pagamento_especificas,
        raca: payloadNormalizado.raca,
        sexo: payloadNormalizado.sexo,
        pelagem: payloadNormalizado.pelagem,
        nascimento: payloadNormalizado.nascimento,
        altura: payloadNormalizado.altura,
        informacoes: payloadNormalizado.informacoes,
        genealogia: payloadNormalizado.genealogia,
        condicoes_cobertura: payloadNormalizado.condicoes_cobertura
      })
    }

    await carregar()
    fecharModal()
  }

  async function excluir(animal: Animal) {
    if (excluindoAnimalId.value) return

    excluindoAnimalId.value = animal.id

    try {
      await wait(280)
      await removerAnimal(animal.id)
      await carregar()
    } finally {
      excluindoAnimalId.value = null
    }
  }

  async function limparTodos() {
    limpandoTudo.value = true

    try {
      await removerAnimaisPorLeilao(leilaoId)
      await carregar()
    } finally {
      limpandoTudo.value = false
    }
  }

  onMounted(carregar)
  onMounted(() => {
    void carregarProvidersApi()
  })
  onMounted(async () => {
    try {
      const conexao = await obterConexaoOperacao()
      eventSource = new EventSource(
        `${conexao.baseUrl}/sync/events/${encodeURIComponent(`animais:${leilaoId}`)}`
      )
      eventSource.onmessage = () => {
        if (!primeiroEventoSyncRecebido) {
          primeiroEventoSyncRecebido = true
          void carregar()
          return
        }
        void carregar()
      }
      eventSource.onerror = () => {
        router.replace({
          path: '/conexao',
          query: { erro: 'nao-foi-possivel-conectar-ao-host' }
        })
      }
    } catch {
      router.replace({
        path: '/conexao',
        query: { erro: 'nao-foi-possivel-conectar-ao-host' }
      })
    }
  })
  onUnmounted(() => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  })

  async function salvarConfiguracaoLayout(
    modo: LayoutInformacoesAnimais,
    incluirRaca: boolean
  ) {
    await window.config.setLayoutAnimais(leilaoId, {
      modo,
      incluirRacaNasImportacoes: incluirRaca
    })
    layoutInformacoesModo.value = modo
    incluirRacaNasImportacoes.value = incluirRaca
  }

  return {
    carregando,
    leilao,
    animais,
    busca,
    animaisFiltrados,
    modalAberto,
    modalModo,
    form,
    erroModal,
    resumoImportacao,
    resumoAberto,
    limpandoTudo,
    excluindoAnimalId,
    apiImportAberto,
    apiImportLoading,
    apiImportImportando,
    apiImportErro,
    apiImportLeiloes,
    apiImportSelectedProviderId,
    apiImportSelectedAuctionId,
    apiImportProviders,
    apiImportHasConfiguredProviders,
    carregarProvidersApi,
    layoutInformacoesModo,
    incluirRacaNasImportacoes,
    abrirCriar,
    abrirEditar,
    fecharModal,
    fecharResumo,
    importarPlanilhaExcel,
    abrirImportacaoApi,
    fecharImportacaoApi,
    selecionarProviderApi,
    selecionarLeilaoApi,
    importarDaApi,
    salvarConfiguracaoLayout,
    salvarModal,
    excluir,
    limparTodos
  }
}
