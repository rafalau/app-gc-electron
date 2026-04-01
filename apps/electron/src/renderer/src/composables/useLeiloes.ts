import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Leilao, LeilaoCriarPayload } from '../types/leilao'
import {
  atualizarLeilao,
  criarLeilao,
  listarLeiloes,
  removerLeilao
} from '../services/leiloes.service'
import { obterConexaoOperacao } from '../services/operacao.service'

export type AbaLeiloes = 'ATIVOS' | 'ARQUIVADOS'
export type ModalLeilaoModo = 'CRIAR' | 'EDITAR'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function isArquivado(dataISO: string) {
  return dataISO < hojeISO()
}

export function useLeiloes() {
  const router = useRouter()
  const leiloes = ref<Leilao[]>([])
  const aba = ref<AbaLeiloes>('ATIVOS')
  const busca = ref('')

  const modalAberto = ref(false)
  const modalModo = ref<ModalLeilaoModo>('CRIAR')
  const editandoId = ref<string | null>(null)
  const erroModal = ref('')
  let eventSource: EventSource | null = null

  function erroDeConexaoRemota(error: unknown) {
    const message = (error as Error)?.message ?? ''
    return (
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('Falha na comunicação com o host')
    )
  }

  const form = ref<LeilaoCriarPayload>({
    titulo_evento: '',
    data: hojeISO(),
    condicoes_de_pagamento: '',
    usa_dolar: false,
    cotacao: null,
    multiplicador: 1
  })

  async function carregar() {
    try {
      leiloes.value = await listarLeiloes()
    } catch (error) {
      if (erroDeConexaoRemota(error)) {
        router.replace({
          path: '/conexao',
          query: { erro: 'nao-foi-possivel-conectar-ao-host' }
        })
        return
      }
      throw error
    }
  }

  const leiloesFiltrados = computed(() => {
    const termo = busca.value.trim().toLowerCase()

    const filtrados = leiloes.value.filter((l) => {
      const porAba = aba.value === 'ATIVOS' ? !isArquivado(l.data) : isArquivado(l.data)
      if (!porAba) return false
      if (!termo) return true
      return l.titulo_evento.toLowerCase().includes(termo) || l.data.includes(termo)
    })

    filtrados.sort((a, b) => {
      if (aba.value === 'ATIVOS') return a.data.localeCompare(b.data)
      return b.data.localeCompare(a.data)
    })

    return filtrados
  })

  function abrirCriar() {
    erroModal.value = ''
    modalModo.value = 'CRIAR'
    editandoId.value = null
    form.value = {
      titulo_evento: '',
      data: hojeISO(),
      condicoes_de_pagamento: '',
      usa_dolar: false,
      cotacao: null,
      multiplicador: 1
    }
    modalAberto.value = true
  }

  function abrirEditar(leilao: Leilao) {
    erroModal.value = ''
    modalModo.value = 'EDITAR'
    editandoId.value = leilao.id
    form.value = {
      titulo_evento: leilao.titulo_evento,
      data: leilao.data,
      condicoes_de_pagamento: leilao.condicoes_de_pagamento,
      usa_dolar: leilao.usa_dolar,
      cotacao: leilao.cotacao ?? null,
      multiplicador: leilao.multiplicador
    }
    modalAberto.value = true
  }

  function fecharModal() {
    modalAberto.value = false
  }

  async function salvarModal(payload: LeilaoCriarPayload) {
    erroModal.value = ''

    if (!payload.titulo_evento.trim()) {
      erroModal.value = 'Informe o nome do leilão'
      return
    }

    if (!payload.data) {
      erroModal.value = 'Informe a data do leilão'
      return
    }

    if (!payload.multiplicador || payload.multiplicador <= 0) {
      erroModal.value = 'Multiplicador deve ser maior que 0'
      return
    }

    if (payload.usa_dolar) {
      if (!payload.cotacao || payload.cotacao <= 0) {
        erroModal.value = 'Cotação é obrigatória quando usa dólar'
        return
      }
    } else {
      payload.cotacao = null
    }

    form.value = { ...payload }

    if (modalModo.value === 'CRIAR') {
      await criarLeilao({ ...payload })
    } else {
      if (!editandoId.value) return
      await atualizarLeilao(editandoId.value, { ...payload })
    }

    await carregar()
    fecharModal()
  }

  async function excluir(leilao: Leilao) {
    await removerLeilao(leilao.id)
    await carregar()
  }

  onMounted(carregar)
  onMounted(async () => {
    try {
      const conexao = await obterConexaoOperacao()
      eventSource = new EventSource(`${conexao.baseUrl}/sync/events/${encodeURIComponent('leiloes')}`)
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

  return {
    leiloes,
    aba,
    busca,
    leiloesFiltrados,

    modalAberto,
    modalModo,
    form,
    erroModal,
    abrirCriar,
    abrirEditar,
    fecharModal,
    salvarModal,
    excluir
  }
}
