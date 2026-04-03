<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import AnimalModal from '@renderer/components/animal/AnimalModal.vue'
import BaseModal from '@renderer/components/ui/BaseModal.vue'
import BaseSwitch from '@renderer/components/ui/BaseSwitch.vue'
import { useAnimais } from '@renderer/composables/useAnimais'
import type { LeilaoCriarPayload } from '@renderer/types/leilao'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'
import { parseInformacoesAgregadas } from '@renderer/utils/animalInformacoes'
import type {
  OperacaoArquivoInfo,
  OperacaoConexaoInfo,
  OperacaoEstadoPayload
} from '@renderer/types/operacao'
import {
  atualizarArquivoOperacao,
  obterArquivoOperacao,
  obterConexaoOperacao,
  obterEstadoOperacao
} from '@renderer/services/operacao.service'
import {
  definirBoundsSrtPlayer,
  definirVisibilidadeSrtPlayer,
  desligarSrtPlayer,
  iniciarSrtPlayer,
  pararSrtPlayer,
  prepararSrtPlayer
} from '@renderer/services/srtPlayer.service'
import {
  acionarOverlayVmix,
  listarInputsVmix,
  obterConfiguracaoVmix,
  pararPreviewSrt,
  salvarConfiguracaoVmix
} from '@renderer/services/config.service'
import { atualizarLeilao } from '@renderer/services/leiloes.service'
import type { VmixConfig, VmixInput } from '@renderer/types/config'

const router = useRouter()
const route = useRoute()
const leilaoId = route.params.id as string
const animalIdInicial = typeof route.query.animalId === 'string' ? route.query.animalId : ''

const {
  carregando,
  leilao,
  animais,
  modalAberto,
  modalModo,
  form,
  erroModal,
  layoutInformacoesModo,
  abrirEditar,
  fecharModal,
  salvarModal
} = useAnimais(leilaoId)

const arquivoInfo = ref<OperacaoArquivoInfo | null>(null)
const animalSelecionadoId = ref(animalIdInicial)
const buscaAnimal = ref('')
const seletorAnimalAberto = ref(false)
const indiceAnimalDestacado = ref(0)
const lanceDigitado = ref('')
const lanceAtual = ref('0,00')
const lanceAtualCentavos = ref(0)
const copiando = ref<'caminho' | ''>('')
const inputLanceRef = ref<HTMLInputElement | null>(null)
const modalLeilaoAberto = ref(false)
const modalConfiguracaoAberto = ref(false)
const erroLeilaoModal = ref('')
const erroConfiguracaoModal = ref('')
const erroOperacao = ref('')
const erroInputsVmix = ref('')
const carregandoInputsVmix = ref(false)
const acionandoOverlayVmix = ref(false)
const srtPlayerMutado = ref(false)
const inputsVmix = ref<VmixInput[]>([])
const seletorAnimalRef = ref<HTMLDivElement | null>(null)
const srtPlayerHostRef = ref<HTMLDivElement | null>(null)
const conexaoOperacao = ref<OperacaoConexaoInfo | null>(null)
let srtResizeObserver: ResizeObserver | null = null
let srtScrollSyncHandler: (() => void) | null = null
let operacaoEventSource: EventSource | null = null
let aplicandoEstadoExterno = false
let ultimaAssinaturaOperacao = ''
const formVmix = ref<VmixConfig>({
  ativo: false,
  ip: '',
  porta: 8088,
  inputSelecionado: null,
  srt: {
    ativo: false,
    porta: null
  }
})
const formLeilao = ref<LeilaoCriarPayload>({
  titulo_evento: '',
  data: '',
  condicoes_de_pagamento: '',
  usa_dolar: false,
  cotacao: null,
  multiplicador: 1
})

const animalSelecionado = computed(
  () => animais.value.find((animal) => animal.id === animalSelecionadoId.value) ?? null
)
const animaisFiltradosOperacao = computed(() => {
  const termo = buscaAnimal.value.trim().toLowerCase()
  if (!termo) return animais.value

  return animais.value.filter((animal) =>
    [animal.lote, animal.nome]
      .join(' ')
      .toLowerCase()
      .includes(termo)
  )
})

const tituloPagina = computed(() => leilao.value?.titulo_evento || 'Modo Operação')
const resumoLeilao = computed(() => {
  if (!leilao.value) return ''

  const partes = [formatarDataBR(leilao.value.data), `${leilao.value.multiplicador}X`]

  if (leilao.value.condicoes_de_pagamento) {
    partes.push(leilao.value.condicoes_de_pagamento)
  }

  if (leilao.value.usa_dolar && leilao.value.cotacao) {
    partes.push(`DOLAR: ${Number(leilao.value.cotacao).toFixed(2)}`)
  }

  return partes.join('  |  ')
})
const totalLanceFormatado = computed(() => {
  const multiplicador = Number(leilao.value?.multiplicador ?? 1)
  const total = (lanceAtualCentavos.value / 100) * multiplicador
  return formatarMoeda(total)
})
const lanceDolarFormatado = computed(() => {
  const cotacao = Number(leilao.value?.cotacao ?? 0)
  const usaDolar = Boolean(leilao.value?.usa_dolar)
  const valorLance = lanceAtualCentavos.value / 100

  if (!usaDolar || cotacao <= 0 || valorLance <= 0) return '0,00'

  return formatarMoeda(Math.round(valorLance / cotacao))
})
const totalDolarFormatado = computed(() => {
  const cotacao = Number(leilao.value?.cotacao ?? 0)
  const usaDolar = Boolean(leilao.value?.usa_dolar)
  const valorLance = lanceAtualCentavos.value / 100
  const multiplicador = Number(leilao.value?.multiplicador ?? 1)

  if (!usaDolar || cotacao <= 0 || valorLance <= 0) return '0,00'

  return formatarMoeda(Math.round((valorLance * multiplicador) / cotacao))
})
const vmixConfigurado = computed(() => {
  return Boolean(
    formVmix.value.ativo &&
      formVmix.value.ip.trim() &&
      Number.isInteger(Number(formVmix.value.porta)) &&
      Number(formVmix.value.porta) > 0 &&
      formVmix.value.inputSelecionado?.key
  )
})
const srtConfigurado = computed(() => {
  return Boolean(
    formVmix.value.srt.ativo &&
      formVmix.value.ip.trim() &&
      Number.isInteger(Number(formVmix.value.srt.porta)) &&
      Number(formVmix.value.srt.porta) > 0
  )
})
const algumModalAberto = computed(() => {
  return Boolean(modalAberto.value || modalLeilaoAberto.value || modalConfiguracaoAberto.value)
})
const endpointSrt = computed(() => {
  if (!srtConfigurado.value) return ''
  return `srt://${formVmix.value.ip}:${formVmix.value.srt.porta}`
})
function voltar() {
  router.push(`/leilao/${leilaoId}`)
}

function assinarEstadoOperacao(payload: {
  animalId: string | null
  lanceDigitado: string
  layoutModo: 'AGREGADAS' | 'SEPARADAS'
  lanceAtual: string
  lanceAtualCentavos: number
  lanceDolar: string
  totalReal: string
  totalDolar: string
}) {
  return JSON.stringify(payload)
}

async function aplicarEstadoOperacaoExterno(estado: {
  animalId: string | null
  lanceDigitado: string
  layoutModo: 'AGREGADAS' | 'SEPARADAS'
  lanceAtual: string
  lanceAtualCentavos: number
  lanceDolar: string
  totalReal: string
  totalDolar: string
} | null) {
  if (!estado) return

  const assinatura = assinarEstadoOperacao(estado)
  if (assinatura === ultimaAssinaturaOperacao) return

  aplicandoEstadoExterno = true
  ultimaAssinaturaOperacao = assinatura
  animalSelecionadoId.value = estado.animalId ?? ''
  layoutInformacoesModo.value = estado.layoutModo
  lanceDigitado.value = estado.lanceDigitado ?? ''
  lanceAtual.value = estado.lanceAtual ?? '0,00'
  lanceAtualCentavos.value = estado.lanceAtualCentavos ?? 0
  await nextTick()
  aplicandoEstadoExterno = false
}

async function iniciarRealtimeOperacao() {
  if (operacaoEventSource) {
    operacaoEventSource.close()
    operacaoEventSource = null
  }

  conexaoOperacao.value = await obterConexaoOperacao()
  const source = new EventSource(
    `${conexaoOperacao.value.baseUrl}/operacao/events/${encodeURIComponent(leilaoId)}`
  )

  source.onmessage = (event) => {
    try {
      const estado = JSON.parse(event.data) as {
        animalId: string | null
        lanceDigitado: string
        layoutModo: 'AGREGADAS' | 'SEPARADAS'
        lanceAtual: string
        lanceAtualCentavos: number
        lanceDolar: string
        totalReal: string
        totalDolar: string
      } | null
      void aplicarEstadoOperacaoExterno(estado)
    } catch (error) {
      console.error(error)
    }
  }

  source.onerror = () => {
    erroOperacao.value = 'Falha na sincronização em tempo real da operação.'
    if (conexaoOperacao.value?.modo === 'REMOTO') {
      source.close()
      operacaoEventSource = null
      router.replace({
        path: '/conexao',
        query: { erro: 'nao-foi-possivel-conectar-ao-host' }
      })
    }
  }

  operacaoEventSource = source
}

async function abrirModalConfiguracao() {
  erroConfiguracaoModal.value = ''
  erroInputsVmix.value = ''
  formVmix.value = await obterConfiguracaoVmix()
  modalConfiguracaoAberto.value = true
  await carregarInputsVmix()
}

function fecharModalConfiguracao() {
  modalConfiguracaoAberto.value = false
  erroConfiguracaoModal.value = ''
  erroInputsVmix.value = ''
  focarCampoLance()
}

async function toggleMuteSrtPlayer() {
  srtPlayerMutado.value = !srtPlayerMutado.value
  await sincronizarPlaybackSrtPlayer()
}

async function sincronizarBoundsSrtPlayer() {
  if (
    !srtConfigurado.value ||
    !srtPlayerHostRef.value ||
    algumModalAberto.value
  ) {
    await definirVisibilidadeSrtPlayer(false)
    return
  }

  const rect = srtPlayerHostRef.value.getBoundingClientRect()
  const scale = window.devicePixelRatio || 1
  const temTamanho = rect.width > 0 && rect.height > 0

  if (!temTamanho) {
    await definirVisibilidadeSrtPlayer(false)
    return
  }

  await definirBoundsSrtPlayer({
    x: rect.left * scale,
    y: rect.top * scale,
    width: rect.width * scale,
    height: rect.height * scale
  })
  await definirVisibilidadeSrtPlayer(true)
}

async function sincronizarPlaybackSrtPlayer() {
  if (!srtConfigurado.value || algumModalAberto.value) {
    await definirVisibilidadeSrtPlayer(false)
    await pararSrtPlayer()
    return
  }

  await prepararSrtPlayer()
  await sincronizarBoundsSrtPlayer()
  await iniciarSrtPlayer({
    url: endpointSrt.value,
    muted: srtPlayerMutado.value,
    volume: 100
  })
}

async function carregarInputsVmix() {
  if (!formVmix.value.ativo) {
    inputsVmix.value = []
    erroInputsVmix.value = 'Ative o recurso do vMix para buscar os inputs.'
    return
  }

  const ip = String(formVmix.value.ip ?? '').trim()
  const porta = Number(formVmix.value.porta)

  if (!ip) {
    inputsVmix.value = []
    erroInputsVmix.value = 'Informe o IP do vMix para buscar os inputs.'
    return
  }

  if (!Number.isInteger(porta) || porta <= 0 || porta > 65535) {
    inputsVmix.value = []
    erroInputsVmix.value = 'Informe uma porta válida para buscar os inputs.'
    return
  }

  carregandoInputsVmix.value = true
  erroInputsVmix.value = ''

  try {
    const lista = await listarInputsVmix({
      ativo: Boolean(formVmix.value.ativo),
      ip,
      porta,
      inputSelecionado: formVmix.value.inputSelecionado,
      srt: formVmix.value.srt
    })

    inputsVmix.value = lista

    if (!formVmix.value.inputSelecionado?.key) return

    const selecionadoAtual = lista.find(
      (input) => input.key === formVmix.value.inputSelecionado?.key
    )

    formVmix.value.inputSelecionado = selecionadoAtual ?? null
  } catch (error) {
    inputsVmix.value = []
    erroInputsVmix.value = (error as Error).message
  } finally {
    carregandoInputsVmix.value = false
  }
}

function selecionarInputVmix(event: Event) {
  const key = (event.target as HTMLSelectElement).value
  formVmix.value.inputSelecionado = inputsVmix.value.find((input) => input.key === key) ?? null
}

async function salvarConfiguracaoModal() {
  const ip = String(formVmix.value.ip ?? '').trim()
  const porta = Number(formVmix.value.porta)
  const srtPorta = formVmix.value.srt.porta === null ? null : Number(formVmix.value.srt.porta)

  if ((formVmix.value.ativo || formVmix.value.srt.ativo) && !ip) {
    erroConfiguracaoModal.value = 'Informe o IP do vMix.'
    return
  }

  if (formVmix.value.ativo && (!Number.isInteger(porta) || porta <= 0 || porta > 65535)) {
    erroConfiguracaoModal.value = 'Informe uma porta válida entre 1 e 65535.'
    return
  }

  if (
    formVmix.value.srt.ativo &&
    (!Number.isInteger(srtPorta) || Number(srtPorta) <= 0 || Number(srtPorta) > 65535)
  ) {
    erroConfiguracaoModal.value = 'Informe uma porta SRT válida entre 1 e 65535.'
    return
  }

  await salvarConfiguracaoVmix({
    ativo: Boolean(formVmix.value.ativo),
    ip,
    porta,
    inputSelecionado: formVmix.value.inputSelecionado,
    srt: {
      ativo: Boolean(formVmix.value.srt.ativo),
      porta: formVmix.value.srt.ativo ? srtPorta : null
    }
  })

  modalConfiguracaoAberto.value = false
  erroConfiguracaoModal.value = ''
  await pararPreviewSrt()
  await sincronizarPlaybackSrtPlayer()
  focarCampoLance()
}

async function enviarOverlayGc() {
  erroOperacao.value = ''
  acionandoOverlayVmix.value = true

  try {
    const config = await obterConfiguracaoVmix()
    if (!config.ativo || !config.inputSelecionado?.key) {
      throw new Error('Configure e ative o vMix antes de usar o overlay.')
    }
    await acionarOverlayVmix(config)
  } catch (error) {
    erroOperacao.value = (error as Error).message
  } finally {
    acionandoOverlayVmix.value = false
    focarCampoLance()
  }
}

function formatarDataBR(iso?: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function getRaca() {
  if (!animalSelecionado.value) return ''
  if (animalSelecionado.value.raca) return animalSelecionado.value.raca
  return parseInformacoesAgregadas(animalSelecionado.value.informacoes).raca.trim()
}

function getVendedor() {
  return String(animalSelecionado.value?.vendedor ?? '').trim()
}

function getCondicoesEspecificas() {
  return String(animalSelecionado.value?.condicoes_pagamento_especificas ?? '').trim()
}

function getInformacoesAnimal() {
  return String(animalSelecionado.value?.informacoes ?? '').trim()
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function parseValorLance(valor: string) {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  if (!digitos) return null
  return Number(digitos)
}

function focarCampoLance() {
  void nextTick(() => {
    inputLanceRef.value?.focus()
    inputLanceRef.value?.select()
  })
}

function resetarLances() {
  lanceDigitado.value = ''
  lanceAtual.value = '0,00'
  lanceAtualCentavos.value = 0
  focarCampoLance()
}

function atualizarDigitacaoLance(event: Event) {
  lanceDigitado.value = (event.target as HTMLInputElement).value.replace(/[^\d]/g, '')
}

function enviarLance() {
  const valor = parseValorLance(lanceDigitado.value)

  if (valor === null) {
    lanceAtual.value = '0,00'
    lanceAtualCentavos.value = 0
    lanceDigitado.value = ''
    focarCampoLance()
    void sincronizarArquivo()
    return
  }

  const valorFormatado = formatarMoeda(valor)
  const valorCentavos = Math.round(valor * 100)

  lanceAtual.value = valorFormatado
  lanceAtualCentavos.value = valorCentavos
  lanceDigitado.value = ''
  focarCampoLance()
  void sincronizarArquivo()
}

function editarAnimalSelecionado() {
  if (!animalSelecionado.value) return
  abrirEditar(animalSelecionado.value)
}

async function abrirEdicaoRapida() {
  await window.janela.abrirEdicaoRapida(leilaoId, animalSelecionado.value?.id)
}

function selecionarAnimalOperacao(animalId: string) {
  animalSelecionadoId.value = animalId
  buscaAnimal.value = ''
  seletorAnimalAberto.value = false
  indiceAnimalDestacado.value = 0
}

function abrirSeletorAnimal() {
  seletorAnimalAberto.value = true
  indiceAnimalDestacado.value = 0
  void nextTick(() => {
    const input = seletorAnimalRef.value?.querySelector('input')
    if (input instanceof HTMLInputElement) input.focus()
  })
}

function toggleSeletorAnimal() {
  if (seletorAnimalAberto.value) {
    seletorAnimalAberto.value = false
    return
  }
  abrirSeletorAnimal()
}

function handleClickOutside(event: MouseEvent) {
  if (seletorAnimalRef.value && !seletorAnimalRef.value.contains(event.target as Node)) {
    seletorAnimalAberto.value = false
  }
}

function destacarProximoAnimal() {
  if (animaisFiltradosOperacao.value.length === 0) return
  indiceAnimalDestacado.value = Math.min(
    indiceAnimalDestacado.value + 1,
    animaisFiltradosOperacao.value.length - 1
  )
}

function destacarAnimalAnterior() {
  if (animaisFiltradosOperacao.value.length === 0) return
  indiceAnimalDestacado.value = Math.max(indiceAnimalDestacado.value - 1, 0)
}

function confirmarAnimalDestacado() {
  const animal = animaisFiltradosOperacao.value[indiceAnimalDestacado.value]
  if (!animal) return
  selecionarAnimalOperacao(animal.id)
}

function abrirEdicaoLeilao() {
  if (!leilao.value) return

  erroLeilaoModal.value = ''
  formLeilao.value = {
    titulo_evento: leilao.value.titulo_evento,
    data: leilao.value.data,
    condicoes_de_pagamento: leilao.value.condicoes_de_pagamento,
    usa_dolar: leilao.value.usa_dolar,
    cotacao: leilao.value.cotacao,
    multiplicador: leilao.value.multiplicador
  }
  modalLeilaoAberto.value = true
}

function fecharModalLeilao() {
  modalLeilaoAberto.value = false
  focarCampoLance()
}

async function salvarLeilaoOperacao(payload: LeilaoCriarPayload) {
  erroLeilaoModal.value = ''

  if (!leilao.value) return
  if (!payload.multiplicador || payload.multiplicador <= 0) {
    erroLeilaoModal.value = 'Multiplicador deve ser maior que 0'
    return
  }
  if (payload.usa_dolar) {
    if (!payload.cotacao || payload.cotacao <= 0) {
      erroLeilaoModal.value = 'Cotação é obrigatória quando usa dólar'
      return
    }
  } else {
    payload.cotacao = null
  }

  leilao.value = await atualizarLeilao(leilao.value.id, {
    condicoes_de_pagamento: payload.condicoes_de_pagamento,
    usa_dolar: payload.usa_dolar,
    cotacao: payload.cotacao,
    multiplicador: payload.multiplicador
  })
  modalLeilaoAberto.value = false
  focarCampoLance()
  await sincronizarArquivo()
}

function fecharModalOperacao() {
  fecharModal()
  focarCampoLance()
}

async function salvarEdicaoAnimal(payload: typeof form.value) {
  await salvarModal(payload)
  focarCampoLance()
  await sincronizarArquivo()
}

async function copiarTexto(texto: string, alvo: 'caminho') {
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    const area = document.createElement('textarea')
    area.value = texto
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.focus()
    area.select()
    document.execCommand('copy')
    document.body.removeChild(area)
  }

  copiando.value = alvo
  window.setTimeout(() => {
    if (copiando.value === alvo) copiando.value = ''
  }, 1200)
}

async function sincronizarArquivo() {
  if (aplicandoEstadoExterno) return
  if (!arquivoInfo.value) return
  if (carregando.value) return
  if (!leilao.value) return

  try {
    const leilaoPlain = leilao.value
      ? JSON.parse(JSON.stringify(leilao.value))
      : null
    const animalPlain = animalSelecionado.value
      ? JSON.parse(JSON.stringify(animalSelecionado.value))
      : null

    const payload: OperacaoEstadoPayload = {
      leilao: leilaoPlain,
      animal: animalPlain,
      layout_modo: layoutInformacoesModo.value,
      lance_digitado: lanceDigitado.value,
      lance_atual: lanceAtual.value,
      lance_atual_centavos: lanceAtualCentavos.value,
      lance_dolar: lanceDolarFormatado.value,
      total_real: totalLanceFormatado.value,
      total_dolar: totalDolarFormatado.value,
      atualizado_em: new Date().toISOString()
    }
    ultimaAssinaturaOperacao = assinarEstadoOperacao({
      animalId: payload.animal?.id ?? null,
      lanceDigitado: payload.lance_digitado,
      layoutModo: payload.layout_modo,
      lanceAtual: payload.lance_atual,
      lanceAtualCentavos: payload.lance_atual_centavos,
      lanceDolar: payload.lance_dolar,
      totalReal: payload.total_real,
      totalDolar: payload.total_dolar
    })

    arquivoInfo.value = await atualizarArquivoOperacao(leilaoId, payload)
    erroOperacao.value = ''
  } catch (error) {
    erroOperacao.value = (error as Error).message
  }
}

watch(
  animais,
  (lista) => {
    if (lista.length === 0) {
      animalSelecionadoId.value = ''
      return
    }

    if (animalSelecionadoId.value && lista.some((animal) => animal.id === animalSelecionadoId.value)) {
      return
    }

    if (animalIdInicial && lista.some((animal) => animal.id === animalIdInicial)) {
      selecionarAnimalOperacao(animalIdInicial)
      return
    }

    selecionarAnimalOperacao(lista[0].id)
  },
  { immediate: true }
)

watch(animalSelecionadoId, () => {
  if (aplicandoEstadoExterno) return
  resetarLances()
  void sincronizarArquivo()
})

watch(buscaAnimal, () => {
  indiceAnimalDestacado.value = 0
})

watch(carregando, (value) => {
  if (!value) void sincronizarArquivo()
})

watch(layoutInformacoesModo, () => {
  if (aplicandoEstadoExterno) return
  void sincronizarArquivo()
})

watch(algumModalAberto, () => {
  void sincronizarPlaybackSrtPlayer()
})

onMounted(async () => {
  await window.janela.definirPreset('OPERACAO')
  try {
    formVmix.value = await obterConfiguracaoVmix()
    arquivoInfo.value = await obterArquivoOperacao(leilaoId)
    const estado = await obterEstadoOperacao(leilaoId)
    if (estado) {
      await aplicarEstadoOperacaoExterno(estado)
    }
    await iniciarRealtimeOperacao()
  } catch (error) {
    erroOperacao.value = (error as Error).message
    const conexao = await obterConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      router.replace({
        path: '/conexao',
        query: { erro: 'nao-foi-possivel-conectar-ao-host' }
      })
      return
    }
  }
  await pararPreviewSrt()
  await sincronizarPlaybackSrtPlayer()
  await sincronizarArquivo()
  focarCampoLance()
})

onBeforeUnmount(() => {
  void window.janela.definirPreset('DESKTOP')
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onMounted(() => {
  srtResizeObserver = new ResizeObserver(() => {
    void sincronizarBoundsSrtPlayer()
  })

  if (srtPlayerHostRef.value) {
    srtResizeObserver.observe(srtPlayerHostRef.value)
  }

  window.addEventListener('resize', () => {
    void sincronizarBoundsSrtPlayer()
  })

  srtScrollSyncHandler = () => {
    void sincronizarBoundsSrtPlayer()
  }

  window.addEventListener('scroll', srtScrollSyncHandler, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (srtResizeObserver) {
    srtResizeObserver.disconnect()
    srtResizeObserver = null
  }
  if (srtScrollSyncHandler) {
    window.removeEventListener('scroll', srtScrollSyncHandler, true)
    srtScrollSyncHandler = null
  }
  if (operacaoEventSource) {
    operacaoEventSource.close()
    operacaoEventSource = null
  }
  void desligarSrtPlayer()
  void pararPreviewSrt()
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 p-4">
    <div class="mx-auto flex w-full max-w-[520px] flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <button
          class="text-left text-sm font-medium text-blue-700 transition hover:text-blue-900"
          type="button"
          @click="voltar"
        >
          ← Voltar para animais
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          @click="abrirEdicaoRapida"
        >
          <i class="fas fa-table text-xs" />
          Edição Rápida
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          @click="abrirModalConfiguracao"
        >
          <i class="fas fa-gear text-xs" />
          Config. Vmix
        </button>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-xl font-bold text-slate-900">{{ tituloPagina }}</h1>
            <div v-if="resumoLeilao" class="mt-2 text-xs font-medium text-slate-600">
              {{ resumoLeilao }}
            </div>
          </div>

          <button
            type="button"
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            :disabled="!leilao"
            @click="abrirEdicaoLeilao"
          >
            <i class="fas fa-pen text-sm" />
          </button>
        </div>
      </div>

      <div
        v-if="srtConfigurado"
        class="overflow-hidden border border-slate-300 bg-white shadow-sm"
      >
        <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            SRT
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
            :title="srtPlayerMutado ? 'Ativar som' : 'Mutar som'"
            @click="toggleMuteSrtPlayer"
          >
            <i :class="['fas', srtPlayerMutado ? 'fa-volume-xmark' : 'fa-volume-high']" />
          </button>
        </div>

        <div
          ref="srtPlayerHostRef"
          class="aspect-video bg-black"
        />
      </div>

      <div class="rounded-3xl border border-blue-300 bg-gradient-to-b from-blue-200 via-blue-100 to-white p-4 shadow-md shadow-blue-200/80">
        <div class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Lances
        </div>

        <div v-if="carregando" class="mt-3 text-sm text-slate-500">Carregando animais...</div>

        <div v-else class="mt-3 flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <div ref="seletorAnimalRef" class="relative min-w-0 flex-1">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                @click="toggleSeletorAnimal"
              >
                <span class="min-w-0 truncate">
                  {{
                    animalSelecionado
                      ? `${animalSelecionado.lote} - ${animalSelecionado.nome}`
                      : 'Selecione um animal'
                  }}
                </span>
                <i
                  :class="[
                    'fas shrink-0 text-xs text-slate-400 transition-transform',
                    seletorAnimalAberto ? 'fa-chevron-up' : 'fa-chevron-down'
                  ]"
                />
              </button>

              <div
                v-if="seletorAnimalAberto"
                class="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                <input
                  v-model="buscaAnimal"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  type="text"
                  placeholder="Buscar por lote ou nome"
                  @input="applyUppercaseInput($event, (value) => (buscaAnimal = value))"
                  @keydown.down.prevent="destacarProximoAnimal"
                  @keydown.up.prevent="destacarAnimalAnterior"
                  @keydown.enter.prevent="confirmarAnimalDestacado"
                />

                <div class="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-100">
                  <button
                    v-for="(animal, index) in animaisFiltradosOperacao"
                    :key="animal.id"
                    type="button"
                    :class="[
                      'flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition last:border-b-0',
                      index === indiceAnimalDestacado ? 'bg-blue-50' : 'hover:bg-slate-50'
                    ]"
                    @click="selecionarAnimalOperacao(animal.id)"
                  >
                    <span class="min-w-0 truncate">{{ animal.lote }} - {{ animal.nome }}</span>
                    <span
                      class="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      :class="
                        animal.categoria === 'COBERTURAS'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      "
                    >
                      {{ animal.categoria }}
                    </span>
                  </button>

                  <div
                    v-if="animaisFiltradosOperacao.length === 0"
                    class="px-4 py-3 text-sm text-slate-500"
                  >
                    Nenhum animal encontrado.
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              :disabled="!animalSelecionado"
              title="Editar animal"
              @click="editarAnimalSelecionado"
            >
              <i class="fas fa-pen text-sm" />
            </button>
          </div>

          <input
            ref="inputLanceRef"
            v-model="lanceDigitado"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-bold text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            type="text"
            inputmode="decimal"
            placeholder="Digite o lance"
            @input="atualizarDigitacaoLance"
            @keydown.enter.prevent="enviarLance"
          />

          <button
            v-if="vmixConfigurado"
            type="button"
            class="inline-flex w-full items-center justify-center rounded-xl border border-slate-400 bg-slate-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition hover:bg-slate-700 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="acionandoOverlayVmix"
            @click="enviarOverlayGc"
          >
            {{ acionandoOverlayVmix ? 'Enviando...' : 'OVERLAY GC' }}
          </button>

          <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Lance Atual
            </div>
            <div class="mt-1 text-3xl font-black text-emerald-700">{{ lanceAtual }}</div>
            <div class="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800/80">
              Total: {{ totalLanceFormatado }}
            </div>
          </div>

          <div
            v-if="leilao?.usa_dolar && leilao?.cotacao"
            class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center"
          >
            <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
              Lance U$: {{ lanceDolarFormatado }} | Total U$: {{ totalDolarFormatado }}
            </div>
          </div>

          <div
            v-if="animalSelecionado"
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
                Lote {{ animalSelecionado.lote }}
              </div>
              <span
                class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                :class="
                  animalSelecionado.categoria === 'COBERTURAS'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                "
              >
                {{ animalSelecionado.categoria }}
              </span>
            </div>

            <div class="mt-3 text-lg font-bold text-slate-900 break-words">
              {{ animalSelecionado.nome }}
            </div>

            <div class="mt-4 space-y-3 text-sm text-slate-700">
              <div>
                <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {{
                    animalSelecionado.categoria === 'COBERTURAS'
                      ? 'Pacotes Disponíveis'
                      : 'Informações'
                  }}
                </div>
                <div
                  v-if="animalSelecionado.categoria === 'COBERTURAS'"
                  class="mt-1 space-y-1.5"
                >
                  <div
                    v-for="condicao in animalSelecionado.condicoes_cobertura"
                    :key="condicao"
                    class="rounded-xl bg-slate-50 px-3 py-2 break-words"
                  >
                    {{ condicao }}
                  </div>
                  <div
                    v-if="animalSelecionado.condicoes_cobertura.length === 0"
                    class="mt-1 text-slate-500"
                  >
                    Sem condições
                  </div>
                </div>
                <div v-else class="mt-1 break-words">
                  {{ getInformacoesAnimal() || 'Sem informações' }}
                </div>
              </div>

              <div
                v-if="animalSelecionado.categoria === 'COBERTURAS' && getInformacoesAnimal()"
              >
                <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Informações
                </div>
                <div class="mt-1 break-words">
                  {{ getInformacoesAnimal() }}
                </div>
              </div>

              <div v-if="getRaca()">
                <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Raça
                </div>
                <div class="mt-1 break-words">
                  {{ getRaca() }}
                </div>
              </div>

              <div>
                <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Genealogia
                </div>
                <div class="mt-1 break-words">
                  {{ animalSelecionado.genealogia || 'Sem genealogia' }}
                </div>
              </div>

              <div v-if="getCondicoesEspecificas()">
                <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Condições Específicas
                </div>
                <div class="mt-1 break-words">
                  {{ getCondicoesEspecificas() }}
                </div>
              </div>

              <div v-if="getVendedor()">
                <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Vendedor
                </div>
                <div class="mt-1 break-words">
                  {{ getVendedor() }}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          JSON vMix
        </div>

        <div
          v-if="erroOperacao"
          class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {{ erroOperacao }}
        </div>

        <div class="mt-3 flex flex-col gap-3">
          <div
            v-for="url in arquivoInfo?.urls_http || []"
            :key="url"
            class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  URL
                </div>
                <div class="mt-1 break-all text-sm text-slate-700">
                  {{ url }}
                </div>
              </div>

              <button
                type="button"
                class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                @click="copiarTexto(url, 'caminho')"
              >
                <i
                  :class="[
                    'fas text-sm',
                    copiando === 'caminho' ? 'fa-check' : 'fa-copy'
                  ]"
                />
              </button>
            </div>
          </div>

          <div
            v-if="!arquivoInfo?.urls_http?.length"
            class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              URL
            </div>
            <div class="mt-1 break-all text-sm text-slate-700">
              Carregando...
            </div>
          </div>

        </div>
      </div>
    </div>

    <AnimalModal
      :aberto="modalAberto"
      :modo="modalModo"
      :layout-modo="layoutInformacoesModo"
      :form="form"
      :erro="erroModal"
      @fechar="fecharModalOperacao"
      @salvar="salvarEdicaoAnimal"
    />

    <BaseModal :aberto="modalLeilaoAberto" titulo="Editar Operação" @fechar="fecharModalLeilao">
      <div
        v-if="erroLeilaoModal"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {{ erroLeilaoModal }}
      </div>

      <div class="grid grid-cols-12 gap-5">
        <div class="col-span-12 md:col-span-4">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Multiplicador
          </label>
          <input
            v-model.number="formLeilao.multiplicador"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            type="number"
            min="0"
            step="0.01"
          />
        </div>

        <div class="col-span-12 md:col-span-8">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Condições Pagto.
          </label>
          <input
            v-model="formLeilao.condicoes_de_pagamento"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            type="text"
          />
        </div>

        <div class="col-span-12 md:col-span-6">
          <div
            class="flex h-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm"
          >
            <div>
              <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Moeda
              </div>
              <label class="mt-1 block text-sm font-medium text-slate-800">Usar dólar?</label>
            </div>
            <BaseSwitch v-model="formLeilao.usa_dolar" />
          </div>
        </div>

        <div class="col-span-12 md:col-span-6">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Cotação do Dólar
          </label>
          <input
            v-model.number="formLeilao.cotacao"
            :disabled="!formLeilao.usa_dolar"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            type="number"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <template #footer>
        <BaseButton @click="fecharModalLeilao">Cancelar</BaseButton>
        <BaseButton variante="primario" @click="salvarLeilaoOperacao(formLeilao)">
          Salvar
        </BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :aberto="modalConfiguracaoAberto"
      titulo="Configuração do vMix"
      @fechar="fecharModalConfiguracao"
    >
      <div
        v-if="erroConfiguracaoModal"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {{ erroConfiguracaoModal }}
      </div>

      <div class="grid grid-cols-12 gap-5">
        <div class="col-span-12">
          <div
            class="flex h-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm"
          >
            <div>
              <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Integração
              </div>
              <label class="mt-1 block text-sm font-medium text-slate-800">Ativar vMix?</label>
            </div>
            <BaseSwitch v-model="formVmix.ativo" />
          </div>
        </div>

        <div class="col-span-12">
          <div
            class="flex h-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm"
          >
            <div>
              <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Tela SRT
              </div>
              <label class="mt-1 block text-sm font-medium text-slate-800">Ativar SRT?</label>
            </div>
            <BaseSwitch v-model="formVmix.srt.ativo" />
          </div>
        </div>

        <div class="col-span-12 md:col-span-7">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            IP do vMix
          </label>
          <input
            v-model="formVmix.ip"
            :disabled="!formVmix.ativo"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            type="text"
            placeholder="Ex.: 192.168.0.50"
          />
        </div>

        <div class="col-span-12 md:col-span-5">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Porta
          </label>
          <input
            v-model.number="formVmix.porta"
            :disabled="!formVmix.ativo"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            type="number"
            min="1"
            max="65535"
            step="1"
            placeholder="8088"
          />
        </div>

        <div class="col-span-12 md:col-span-5">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Porta SRT
          </label>
          <input
            v-model.number="formVmix.srt.porta"
            :disabled="!formVmix.srt.ativo"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            type="number"
            min="1"
            max="65535"
            step="1"
            placeholder="Ex.: 9998"
          />
        </div>

        <div class="col-span-12">
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div class="text-sm text-slate-600">
              Buscar inputs disponíveis no vMix configurado.
            </div>
            <BaseButton :disabled="carregandoInputsVmix || !formVmix.ativo" @click="carregarInputsVmix">
              {{ carregandoInputsVmix ? 'Buscando...' : 'Atualizar' }}
            </BaseButton>
          </div>
        </div>

        <div
          v-if="erroInputsVmix"
          class="col-span-12 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {{ erroInputsVmix }}
        </div>

        <div class="col-span-12">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Input do vMix
          </label>
          <div class="relative">
            <select
              :value="formVmix.inputSelecionado?.key ?? ''"
              class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              :disabled="!formVmix.ativo || carregandoInputsVmix || inputsVmix.length === 0"
              @change="selecionarInputVmix"
            >
              <option value="">Selecione um input</option>
              <option v-for="input in inputsVmix" :key="input.key" :value="input.key">
                {{ input.title || `Input ${input.number}` }} | #{{ input.number }} | {{ input.type }}
              </option>
            </select>
            <i
              class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"
            />
          </div>
        </div>

        <div
          v-if="formVmix.inputSelecionado"
          class="col-span-12 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Input salvo: {{ formVmix.inputSelecionado.title || `Input ${formVmix.inputSelecionado.number}` }}
          (#{{ formVmix.inputSelecionado.number }}) - {{ formVmix.inputSelecionado.type }}
        </div>

        <div class="col-span-12">
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Porta padrão vMix: <strong>8088</strong>
          </div>
        </div>
      </div>

      <template #footer>
        <BaseButton @click="fecharModalConfiguracao">Cancelar</BaseButton>
        <BaseButton variante="primario" @click="salvarConfiguracaoModal">Salvar</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
