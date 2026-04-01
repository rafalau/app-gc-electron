import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CATEGORIAS_ANIMAL, type Animal, type AnimalCriarPayload } from '../types/animal'
import type { Leilao } from '../types/leilao'
import type {
  ImportSummary,
  Remate360EventOption,
  TbsAuctionOption
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
  importarEventoRemate360,
  importarLeilaoTbs,
  listarEventosRemate360,
  listarLeiloesTbs
} from '../services/importacao.service'
import { obterLeilao } from '../services/leiloes.service'
import { obterConexaoOperacao } from '../services/operacao.service'

export type ModalAnimalModo = 'CRIAR' | 'EDITAR'
export type LayoutInformacoesAnimais = 'AGREGADAS' | 'SEPARADAS'

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
  const tbsAberto = ref(false)
  const tbsLoading = ref(false)
  const tbsImportando = ref(false)
  const tbsErro = ref('')
  const tbsLeiloes = ref<TbsAuctionOption[]>([])
  const tbsSelectedAuctionId = ref<number | null>(null)
  const remate360Aberto = ref(false)
  const remate360Loading = ref(false)
  const remate360Importando = ref(false)
  const remate360Erro = ref('')
  const remate360Eventos = ref<Remate360EventOption[]>([])
  const remate360SelectedEventId = ref<number | null>(null)
  const layoutInformacoesModo = ref<LayoutInformacoesAnimais>('AGREGADAS')
  const incluirRacaNasImportacoes = ref(false)
  let eventSource: EventSource | null = null

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

  async function abrirImportacaoTbs() {
    tbsAberto.value = true
    tbsErro.value = ''
    tbsLoading.value = true

    try {
      tbsLeiloes.value = await listarLeiloesTbs()
      if (!tbsSelectedAuctionId.value && tbsLeiloes.value.length > 0) {
        tbsSelectedAuctionId.value = tbsLeiloes.value[0].id
      }
    } catch (error) {
      tbsErro.value = (error as Error).message
    } finally {
      tbsLoading.value = false
    }
  }

  function fecharImportacaoTbs() {
    tbsAberto.value = false
  }

  function selecionarLeilaoTbs(auctionId: number | null) {
    tbsSelectedAuctionId.value = auctionId
  }

  async function importarDaTbs() {
    if (!tbsSelectedAuctionId.value) return

    tbsImportando.value = true
    tbsErro.value = ''

    try {
      const resumo = await importarLeilaoTbs(
        leilaoId,
        tbsSelectedAuctionId.value,
        incluirRacaNasImportacoes.value
      )
      resumoImportacao.value = resumo
      resumoAberto.value = true
      tbsAberto.value = false
      await carregar()
    } catch (error) {
      tbsErro.value = (error as Error).message
    } finally {
      tbsImportando.value = false
    }
  }

  async function abrirImportacaoRemate360() {
    remate360Aberto.value = true
    remate360Erro.value = ''
    remate360Loading.value = true

    try {
      remate360Eventos.value = await listarEventosRemate360()
      if (!remate360SelectedEventId.value && remate360Eventos.value.length > 0) {
        remate360SelectedEventId.value = remate360Eventos.value[0].id
      }
    } catch (error) {
      remate360Erro.value = (error as Error).message
    } finally {
      remate360Loading.value = false
    }
  }

  function fecharImportacaoRemate360() {
    remate360Aberto.value = false
  }

  function selecionarEventoRemate360(eventId: number | null) {
    remate360SelectedEventId.value = eventId
  }

  async function importarDoRemate360() {
    if (!remate360SelectedEventId.value) return

    remate360Importando.value = true
    remate360Erro.value = ''

    try {
      const resumo = await importarEventoRemate360(
        leilaoId,
        remate360SelectedEventId.value,
        incluirRacaNasImportacoes.value
      )
      resumoImportacao.value = resumo
      resumoAberto.value = true
      remate360Aberto.value = false
      await carregar()
    } catch (error) {
      remate360Erro.value = (error as Error).message
    } finally {
      remate360Importando.value = false
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
  onMounted(async () => {
    try {
      const conexao = await obterConexaoOperacao()
      eventSource = new EventSource(
        `${conexao.baseUrl}/sync/events/${encodeURIComponent(`animais:${leilaoId}`)}`
      )
      eventSource.onmessage = () => {
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
    tbsAberto,
    tbsLoading,
    tbsImportando,
    tbsErro,
    tbsLeiloes,
    tbsSelectedAuctionId,
    remate360Aberto,
    remate360Loading,
    remate360Importando,
    remate360Erro,
    remate360Eventos,
    remate360SelectedEventId,
    layoutInformacoesModo,
    incluirRacaNasImportacoes,
    abrirCriar,
    abrirEditar,
    fecharModal,
    fecharResumo,
    importarPlanilhaExcel,
    abrirImportacaoTbs,
    fecharImportacaoTbs,
    selecionarLeilaoTbs,
    importarDaTbs,
    abrirImportacaoRemate360,
    fecharImportacaoRemate360,
    selecionarEventoRemate360,
    importarDoRemate360,
    salvarConfiguracaoLayout,
    salvarModal,
    excluir,
    limparTodos
  }
}
