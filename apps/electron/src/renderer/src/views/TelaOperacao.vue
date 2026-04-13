<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnimais } from '@renderer/composables/useAnimais'
import { getFriendlyErrorMessage } from '@renderer/utils/errorMessage'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'
import {
  formatarGenealogiaParaExibicao,
  formatarInformacoesParaExibicao,
  parseInformacoesAgregadas
} from '@renderer/utils/animalInformacoes'
import type {
  OperacaoArquivoInfo,
  OperacaoConexaoInfo,
  OperacaoEstadoPayload,
  OperacaoEstadoPersistido,
  OperacaoSelecaoModo
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
  obterConfiguracaoVmix
} from '@renderer/services/config.service'
import type { VmixConfig } from '@renderer/types/config'

const VMIX_DEFAULT_PORT = 8088
const SRT_DEFAULT_PORT = 9001
const SRT_RECONNECT_MAX_TENTATIVAS = 10
const INTERVALO_COMPOSTO_PADRAO = 10
const AJUSTES_LANCE_RAPIDO = [10, 20, 30, 50, 100, 500] as const

const router = useRouter()
const route = useRoute()
const leilaoId = route.params.id as string
const animalIdInicial = typeof route.query.animalId === 'string' ? route.query.animalId : ''

const {
  carregando,
  leilao,
  animais,
  layoutInformacoesModo
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
const erroOperacao = ref('')
const acionandoOverlayVmix = ref(false)
const srtPlayerMutado = ref(false)
const recarregandoSrt = ref(false)
const srtStatus = ref('')
const seletorAnimalRef = ref<HTMLDivElement | null>(null)
const srtPlayerHostRef = ref<HTMLDivElement | null>(null)
const conexaoOperacao = ref<OperacaoConexaoInfo | null>(null)
const modoSelecaoOperacao = ref<OperacaoSelecaoModo>('SIMPLES')
const animaisSelecionadosIds = ref<string[]>([])
const animalAtualIndex = ref(0)
const intervaloCompostoSegundos = ref(INTERVALO_COMPOSTO_PADRAO)
let srtResizeObserver: ResizeObserver | null = null
let srtScrollSyncHandler: (() => void) | null = null
let srtResizeWindowHandler: (() => void) | null = null
let recarregarConfigFocusHandler: (() => void) | null = null
let operacaoEventSource: EventSource | null = null
let configVmixEventSource: EventSource | null = null
let aplicandoEstadoExterno = false
let ultimaAssinaturaOperacao = ''
let srtBoundsSyncTimer: number | null = null
let srtBoundsSyncFrame: number | null = null
let srtReconnectTimer: number | null = null
let srtReconnectTentativa = 0
let srtReconnectToken = 0
let rotacaoCompostaTimer: number | null = null
const formVmix = ref<VmixConfig>({
  ativo: false,
  ip: '',
  porta: VMIX_DEFAULT_PORT,
  inputSelecionado: null,
  inputSelecionadoCoberturas: null,
  srt: {
    ativo: false,
    porta: SRT_DEFAULT_PORT,
    networkCachingMs: 200
  }
})
const animalSelecionado = computed(
  () => animais.value.find((animal) => animal.id === animalSelecionadoId.value) ?? null
)
const animaisSelecionadosCompostos = computed(() => {
  const ids = new Set(animaisSelecionadosIds.value)
  return animais.value.filter((animal) => ids.has(animal.id))
})
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
const resumoSelecaoOperacao = computed(() => {
  if (modoSelecaoOperacao.value === 'SIMPLES') {
    return animalSelecionado.value
      ? `${animalSelecionado.value.lote} - ${animalSelecionado.value.nome}`
      : 'Selecione um animal'
  }

  const selecionados = animaisSelecionadosCompostos.value
  if (selecionados.length === 0) return 'Selecione 2 ou mais lotes'
  if (selecionados.length === 1) return `1 lote selecionado: ${selecionados[0].lote}`
  return `${selecionados.length} lotes selecionados`
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
  const inputOverlay = getInputOverlayVmix()

  return Boolean(
    formVmix.value.ativo &&
      formVmix.value.ip.trim() &&
      Number.isInteger(Number(formVmix.value.porta)) &&
      Number(formVmix.value.porta) > 0 &&
      inputOverlay?.key
  )
})
function getInputOverlayVmix() {
  if (animalSelecionado.value?.categoria === 'COBERTURAS') {
    return formVmix.value.inputSelecionadoCoberturas
  }

  return formVmix.value.inputSelecionado
}
const srtIp = computed(() => {
  return formVmix.value.ip.trim()
})
const srtConfigurado = computed(() => {
  return Boolean(
    formVmix.value.srt.ativo &&
      srtIp.value &&
      Number.isInteger(Number(formVmix.value.srt.porta)) &&
      Number(formVmix.value.srt.porta) > 0
  )
})
const endpointSrt = computed(() => {
  if (!srtConfigurado.value) return ''
  return `srt://${srtIp.value}:${formVmix.value.srt.porta}?timeout=5000000&network-caching=${formVmix.value.srt.networkCachingMs ?? 200}`
})
function voltar() {
  router.push(`/leilao/${leilaoId}`)
}

function normalizarIntervaloComposto(valor: number | string | null | undefined) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 ? numero : INTERVALO_COMPOSTO_PADRAO
}

function normalizarAnimalAtualIndex(valor: number | string | null | undefined) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 0 ? numero : 0
}

function normalizarIdsAnimaisSelecionados(ids: string[]) {
  const idsBase = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id ?? '').trim())
        .filter(Boolean)
    )
  )

  if (animais.value.length === 0) {
    return idsBase
  }

  const indicePorId = new Map(animais.value.map((animal, index) => [animal.id, index]))

  return idsBase
    .filter((id) => indicePorId.has(id))
    .sort((a, b) => (indicePorId.get(a) ?? 0) - (indicePorId.get(b) ?? 0))
}

function limparRotacaoComposta() {
  if (rotacaoCompostaTimer !== null) {
    window.clearTimeout(rotacaoCompostaTimer)
    rotacaoCompostaTimer = null
  }
}

function assinarEstadoOperacao(payload: {
  animalId: string | null
  selecaoModo: OperacaoSelecaoModo
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
}) {
  return JSON.stringify(payload)
}

function aplicarEstadoOperacao(estado: OperacaoEstadoPersistido) {
  modoSelecaoOperacao.value = estado.selecaoModo === 'COMPOSTO' ? 'COMPOSTO' : 'SIMPLES'
  animaisSelecionadosIds.value = normalizarIdsAnimaisSelecionados(estado.animaisSelecionadosIds)
  animalAtualIndex.value = normalizarAnimalAtualIndex(estado.animalAtualIndex)
  intervaloCompostoSegundos.value = normalizarIntervaloComposto(estado.intervaloSegundos)
  animalSelecionadoId.value = estado.animalId ?? ''
  layoutInformacoesModo.value = estado.layoutModo
  lanceDigitado.value = estado.lanceDigitado ?? ''
  lanceAtual.value = estado.lanceAtual ?? '0,00'
  lanceAtualCentavos.value = estado.lanceAtualCentavos ?? 0
}

function sincronizarSelecaoCompostaLocal() {
  intervaloCompostoSegundos.value = normalizarIntervaloComposto(intervaloCompostoSegundos.value)

  if (modoSelecaoOperacao.value !== 'COMPOSTO') {
    animaisSelecionadosIds.value = animalSelecionadoId.value ? [animalSelecionadoId.value] : []
    animalAtualIndex.value = 0
    return
  }

  animaisSelecionadosIds.value = normalizarIdsAnimaisSelecionados(animaisSelecionadosIds.value)

  if (animaisSelecionadosIds.value.length === 0) {
    animalSelecionadoId.value = ''
    animalAtualIndex.value = 0
    return
  }

  if (!animaisSelecionadosIds.value.includes(animalSelecionadoId.value)) {
    animalSelecionadoId.value = animaisSelecionadosIds.value[0]
  }

  animalAtualIndex.value = Math.max(animaisSelecionadosIds.value.indexOf(animalSelecionadoId.value), 0)
}

async function aplicarEstadoOperacaoExterno(estado: OperacaoEstadoPersistido | null) {
  if (!estado) return

  const assinatura = assinarEstadoOperacao(estado)
  if (assinatura === ultimaAssinaturaOperacao) return

  aplicandoEstadoExterno = true
  ultimaAssinaturaOperacao = assinatura
  aplicarEstadoOperacao(estado)
  await nextTick()
  aplicandoEstadoExterno = false
  agendarRotacaoComposta()
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
      const estado = JSON.parse(event.data) as OperacaoEstadoPersistido | null
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

async function iniciarRealtimeConfigVmix() {
  if (configVmixEventSource) {
    configVmixEventSource.close()
    configVmixEventSource = null
  }

  const conexao = conexaoOperacao.value ?? (await obterConexaoOperacao())
  if (conexao.modo === 'REMOTO') return

  const source = new EventSource(
    `${conexao.baseUrl}/sync/events/${encodeURIComponent('config:vmix')}`
  )

  source.onmessage = async () => {
    try {
      formVmix.value = await obterConfiguracaoVmix()
      await sincronizarPlaybackSrtPlayerComReconexao()
    } catch (error) {
      erroOperacao.value = getFriendlyErrorMessage(error)
    }
  }

  source.onerror = () => {
    if (conexaoOperacao.value?.modo === 'REMOTO') {
      source.close()
      configVmixEventSource = null
    }
  }

  configVmixEventSource = source
}

async function abrirModalConfiguracao() {
  await window.janela.abrirConfiguracaoVmixOperacao(leilaoId)
}

async function recarregarConfiguracaoVmixLocal() {
  try {
    formVmix.value = await obterConfiguracaoVmix()
    await nextTick()
    await sincronizarPlaybackSrtPlayerComReconexao()
  } catch (error) {
    erroOperacao.value = getFriendlyErrorMessage(error)
  }
}

async function toggleMuteSrtPlayer() {
  srtPlayerMutado.value = !srtPlayerMutado.value
  await sincronizarPlaybackSrtPlayerComReconexao()
}

async function recarregarSrtPlayerManual() {
  if (recarregandoSrt.value) return

  recarregandoSrt.value = true
  erroOperacao.value = ''

  try {
    await pararSrtPlayer()
    cancelarReconexaoSrtPlayer()
    await aguardar(120)
    formVmix.value = await obterConfiguracaoVmix()
    await sincronizarPlaybackSrtPlayerComReconexao({ propagarErroFinal: true })
  } catch (error) {
    erroOperacao.value = getFriendlyErrorMessage(error)
  } finally {
    recarregandoSrt.value = false
  }
}

async function sincronizarBoundsSrtPlayer() {
  if (!srtConfigurado.value || !srtPlayerHostRef.value) {
    await definirVisibilidadeSrtPlayer(false)
    return
  }

  const rect = srtPlayerHostRef.value.getBoundingClientRect()
  const temTamanho = rect.width > 0 && rect.height > 0

  if (!temTamanho) {
    await definirVisibilidadeSrtPlayer(false)
    return
  }

  const isWindows = /Windows/i.test(navigator.userAgent)
  const scale = isWindows ? window.devicePixelRatio || 1 : 1
  const windowsYOffset = isWindows ? 26 * scale : 0

  await definirBoundsSrtPlayer({
    x: rect.left * scale,
    y: rect.top * scale + windowsYOffset,
    width: rect.width * scale,
    height: rect.height * scale
  })
}

function agendarSincronizacaoBoundsSrtPlayer() {
  if (srtBoundsSyncTimer !== null) {
    window.clearTimeout(srtBoundsSyncTimer)
  }

  srtBoundsSyncTimer = window.setTimeout(() => {
    srtBoundsSyncTimer = null
    void sincronizarBoundsSrtPlayer()
  }, 120)
}

function sincronizarBoundsSrtPlayerNoProximoFrame() {
  if (srtBoundsSyncFrame !== null) return

  srtBoundsSyncFrame = window.requestAnimationFrame(() => {
    srtBoundsSyncFrame = null
    void sincronizarBoundsSrtPlayer()
  })
}

function aguardar(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function cancelarReconexaoSrtPlayer() {
  srtReconnectToken += 1
  srtReconnectTentativa = 0
  srtStatus.value = ''

  if (srtReconnectTimer !== null) {
    window.clearTimeout(srtReconnectTimer)
    srtReconnectTimer = null
  }
}

function getIntervaloReconexaoSrt() {
  if (srtReconnectTentativa <= 1) return 1000
  if (srtReconnectTentativa === 2) return 2000
  if (srtReconnectTentativa === 3) return 3000
  return 5000
}

function agendarReconexaoSrtPlayer() {
  if (!srtConfigurado.value || srtReconnectTimer !== null) return

  if (srtReconnectTentativa >= SRT_RECONNECT_MAX_TENTATIVAS) {
    srtStatus.value = 'Sinal SRT indisponivel. Clique em Recarregar quando o sinal voltar.'
    return
  }

  srtReconnectTentativa += 1
  const token = srtReconnectToken
  const intervaloMs = getIntervaloReconexaoSrt()
  srtStatus.value = `Aguardando sinal SRT... tentativa ${srtReconnectTentativa}/${SRT_RECONNECT_MAX_TENTATIVAS} em ${Math.round(intervaloMs / 1000)}s`

  srtReconnectTimer = window.setTimeout(() => {
    srtReconnectTimer = null

    if (token !== srtReconnectToken || !srtConfigurado.value) {
      return
    }

    void sincronizarPlaybackSrtPlayerComReconexao()
  }, intervaloMs)
}

function isErroSrtTransitorio(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')

  return (
    message.includes('Object has been destroyed') ||
    message.includes('srt-player:setBounds') ||
    message.includes('srt-player:start') ||
    message.includes('srt-player:setVisible')
  )
}

async function sincronizarPlaybackSrtPlayer() {
  if (!srtConfigurado.value) {
    cancelarReconexaoSrtPlayer()
    await definirVisibilidadeSrtPlayer(false)
    await pararSrtPlayer()
    return
  }

  await prepararSrtPlayer()
  await sincronizarBoundsSrtPlayer()
  await aguardar(180)
  await sincronizarBoundsSrtPlayer()
  await definirVisibilidadeSrtPlayer(true)
  await iniciarSrtPlayer({
    url: endpointSrt.value,
    muted: srtPlayerMutado.value,
    volume: 100,
    networkCachingMs: formVmix.value.srt.networkCachingMs ?? 200
  })
}

async function sincronizarPlaybackSrtPlayerComRetry(
  tentativasRestantes = 2,
  intervaloMs = 250
) {
  try {
    await sincronizarPlaybackSrtPlayer()
  } catch (error) {
    if (!isErroSrtTransitorio(error) || tentativasRestantes <= 0) {
      throw error
    }

    await aguardar(intervaloMs)
    await sincronizarPlaybackSrtPlayerComRetry(tentativasRestantes - 1, intervaloMs)
  }
}

async function sincronizarPlaybackSrtPlayerComReconexao(options?: {
  propagarErroFinal?: boolean
}) {
  const propagarErroFinal = Boolean(options?.propagarErroFinal)

  try {
    await sincronizarPlaybackSrtPlayerComRetry()
    erroOperacao.value = ''
    cancelarReconexaoSrtPlayer()
  } catch (error) {
    if (!srtConfigurado.value) {
      cancelarReconexaoSrtPlayer()
      if (propagarErroFinal) throw error
      return
    }

    agendarReconexaoSrtPlayer()

    if (propagarErroFinal) {
      throw error
    }
  }
}

async function enviarOverlayGc() {
  erroOperacao.value = ''
  acionandoOverlayVmix.value = true

  try {
    const config = await obterConfiguracaoVmix()
    const inputOverlay = animalSelecionado.value?.categoria === 'COBERTURAS'
      ? config.inputSelecionadoCoberturas
      : config.inputSelecionado

    if (!config.ativo || !inputOverlay?.key) {
      throw new Error('Configure e ative o vMix antes de usar o overlay.')
    }
    await acionarOverlayVmix({
      ...config,
      inputSelecionado: inputOverlay
    })
  } catch (error) {
    erroOperacao.value = getFriendlyErrorMessage(error)
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
  return formatarInformacoesParaExibicao(animalSelecionado.value?.informacoes ?? '')
}

function getGenealogiaAnimal() {
  return formatarGenealogiaParaExibicao(animalSelecionado.value?.genealogia ?? '')
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

function deveAlternarAnimaisCompostos() {
  return modoSelecaoOperacao.value === 'COMPOSTO' && animaisSelecionadosIds.value.length >= 2
}

function definirAnimalSelecionado(
  animalId: string,
  options?: { preservarLances?: boolean; fecharSeletor?: boolean; sincronizar?: boolean }
) {
  const mudou = animalSelecionadoId.value !== animalId
  animalSelecionadoId.value = animalId

  if (modoSelecaoOperacao.value === 'COMPOSTO') {
    animalAtualIndex.value = Math.max(animaisSelecionadosIds.value.indexOf(animalId), 0)
  } else {
    animaisSelecionadosIds.value = animalId ? [animalId] : []
    animalAtualIndex.value = 0
  }

  buscaAnimal.value = ''
  indiceAnimalDestacado.value = 0
  if (options?.fecharSeletor !== false) {
    seletorAnimalAberto.value = false
  }

  if (mudou) {
    if (options?.preservarLances) {
      focarCampoLance()
    } else {
      resetarLances()
    }
  }

  if ((mudou || options?.sincronizar) && options?.sincronizar !== false) {
    void sincronizarArquivo()
  }
}

function agendarRotacaoComposta() {
  limparRotacaoComposta()
  if (!deveAlternarAnimaisCompostos()) return

  rotacaoCompostaTimer = window.setTimeout(() => {
    const ids = normalizarIdsAnimaisSelecionados(animaisSelecionadosIds.value)
    if (ids.length < 2) return

    const indiceAtual = Math.max(ids.indexOf(animalSelecionadoId.value), 0)
    const proximoIndice = (indiceAtual + 1) % ids.length
    animalAtualIndex.value = proximoIndice
    definirAnimalSelecionado(ids[proximoIndice], { preservarLances: true })
    agendarRotacaoComposta()
  }, intervaloCompostoSegundos.value * 1000)
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

function ajustarLanceRapido(delta: number) {
  const valorAtual = Number(lanceAtualCentavos.value || 0) / 100
  const proximoValor = Math.max(0, valorAtual + delta)

  lanceAtualCentavos.value = Math.round(proximoValor * 100)
  lanceAtual.value = formatarMoeda(proximoValor)
  lanceDigitado.value = ''
  focarCampoLance()
  void sincronizarArquivo()
}

function editarAnimalSelecionado() {
  if (!animalSelecionado.value) return
  void window.janela.abrirEditorAnimalOperacao(leilaoId, animalSelecionado.value.id)
}

async function abrirModoConferencia() {
  await window.janela.abrirEdicaoRapida(leilaoId, animalSelecionado.value?.id)
}

function selecionarAnimalOperacao(animalId: string) {
  if (modoSelecaoOperacao.value === 'COMPOSTO') {
    const idsSelecionados = new Set(animaisSelecionadosIds.value)

    if (idsSelecionados.has(animalId)) {
      idsSelecionados.delete(animalId)
    } else {
      idsSelecionados.add(animalId)
    }

    animaisSelecionadosIds.value = normalizarIdsAnimaisSelecionados(Array.from(idsSelecionados))
    sincronizarSelecaoCompostaLocal()

    if (!animaisSelecionadosIds.value.includes(animalSelecionadoId.value)) {
      if (animaisSelecionadosIds.value.length > 0) {
        definirAnimalSelecionado(animaisSelecionadosIds.value[0], {
          preservarLances: true,
          fecharSeletor: false
        })
      } else {
        animalSelecionadoId.value = ''
        animalAtualIndex.value = 0
        void sincronizarArquivo()
      }
      agendarRotacaoComposta()
      return
    }

    definirAnimalSelecionado(animalId, {
      preservarLances: true,
      fecharSeletor: false,
      sincronizar: true
    })
    agendarRotacaoComposta()
    return
  }

  definirAnimalSelecionado(animalId)
}

function definirModoSelecaoOperacao(modo: OperacaoSelecaoModo) {
  if (modoSelecaoOperacao.value === modo) return

  modoSelecaoOperacao.value = modo

  if (modo === 'COMPOSTO') {
    const animalBase = animalSelecionadoId.value || animais.value[0]?.id || ''
    animaisSelecionadosIds.value = animalBase ? [animalBase] : []
    sincronizarSelecaoCompostaLocal()
    void sincronizarArquivo()
    agendarRotacaoComposta()
    focarCampoLance()
    return
  }

  limparRotacaoComposta()
  const animalBase = animalSelecionadoId.value || animais.value[0]?.id || ''
  if (animalBase) {
    definirAnimalSelecionado(animalBase, { preservarLances: true })
  } else {
    animaisSelecionadosIds.value = []
    animalAtualIndex.value = 0
    void sincronizarArquivo()
  }
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
  void window.janela.abrirEditorLeilaoOperacao(leilao.value.id)
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
      selecao_modo: modoSelecaoOperacao.value,
      animais_selecionados_ids: [...animaisSelecionadosIds.value],
      animal_atual_index: animalAtualIndex.value,
      intervalo_segundos: intervaloCompostoSegundos.value,
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
      selecaoModo: payload.selecao_modo,
      animaisSelecionadosIds: payload.animais_selecionados_ids,
      animalAtualIndex: payload.animal_atual_index,
      intervaloSegundos: payload.intervalo_segundos,
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
    erroOperacao.value = getFriendlyErrorMessage(error)
  }
}

watch(
  animais,
  (lista) => {
    if (lista.length === 0) {
      animaisSelecionadosIds.value = []
      animalSelecionadoId.value = ''
      limparRotacaoComposta()
      return
    }

    if (modoSelecaoOperacao.value === 'COMPOSTO') {
      const idsNormalizados = normalizarIdsAnimaisSelecionados(animaisSelecionadosIds.value)
      animaisSelecionadosIds.value =
        idsNormalizados.length > 0
          ? idsNormalizados
          : [
              (animalIdInicial && lista.some((animal) => animal.id === animalIdInicial)
                ? animalIdInicial
                : animalSelecionadoId.value && lista.some((animal) => animal.id === animalSelecionadoId.value)
                  ? animalSelecionadoId.value
                  : lista[0].id)
            ]

      sincronizarSelecaoCompostaLocal()
      agendarRotacaoComposta()
      return
    }

    if (animalSelecionadoId.value && lista.some((animal) => animal.id === animalSelecionadoId.value)) {
      animaisSelecionadosIds.value = [animalSelecionadoId.value]
      return
    }

    if (animalIdInicial && lista.some((animal) => animal.id === animalIdInicial)) {
      definirAnimalSelecionado(animalIdInicial)
      return
    }

    definirAnimalSelecionado(lista[0].id)
  },
  { immediate: true }
)

watch(buscaAnimal, () => {
  indiceAnimalDestacado.value = 0
})

watch(modoSelecaoOperacao, () => {
  if (aplicandoEstadoExterno) return
  sincronizarSelecaoCompostaLocal()
  agendarRotacaoComposta()
  void sincronizarArquivo()
})

watch(
  () => animaisSelecionadosIds.value.join('|'),
  () => {
    if (aplicandoEstadoExterno) return
    sincronizarSelecaoCompostaLocal()
    agendarRotacaoComposta()
    if (modoSelecaoOperacao.value === 'COMPOSTO') {
      void sincronizarArquivo()
    }
  }
)

watch(intervaloCompostoSegundos, (valor) => {
  const normalizado = normalizarIntervaloComposto(valor)
  if (normalizado !== valor) {
    intervaloCompostoSegundos.value = normalizado
    return
  }

  if (aplicandoEstadoExterno) return
  agendarRotacaoComposta()
  if (modoSelecaoOperacao.value === 'COMPOSTO') {
    void sincronizarArquivo()
  }
})

watch(carregando, (value) => {
  if (!value) void sincronizarArquivo()
})

watch(layoutInformacoesModo, () => {
  if (aplicandoEstadoExterno) return
  void sincronizarArquivo()
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
    await iniciarRealtimeConfigVmix()
  } catch (error) {
    erroOperacao.value = getFriendlyErrorMessage(error)
    const conexao = await obterConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      router.replace({
        path: '/conexao',
        query: { erro: 'nao-foi-possivel-conectar-ao-host' }
      })
      return
    }
  }
  await sincronizarPlaybackSrtPlayerComReconexao()
  await sincronizarArquivo()
  focarCampoLance()
})

onBeforeUnmount(() => {
  void window.janela.definirPreset('DESKTOP')
  limparRotacaoComposta()
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)

  recarregarConfigFocusHandler = () => {
    void recarregarConfiguracaoVmixLocal()
  }
  window.addEventListener('focus', recarregarConfigFocusHandler)
})

onMounted(() => {
  srtResizeObserver = new ResizeObserver(() => {
    agendarSincronizacaoBoundsSrtPlayer()
  })

  if (srtPlayerHostRef.value) {
    srtResizeObserver.observe(srtPlayerHostRef.value)
  }

  srtResizeWindowHandler = () => {
    agendarSincronizacaoBoundsSrtPlayer()
  }

  window.addEventListener('resize', srtResizeWindowHandler)

  srtScrollSyncHandler = () => {
    sincronizarBoundsSrtPlayerNoProximoFrame()
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
  if (srtResizeWindowHandler) {
    window.removeEventListener('resize', srtResizeWindowHandler)
    srtResizeWindowHandler = null
  }
  if (recarregarConfigFocusHandler) {
    window.removeEventListener('focus', recarregarConfigFocusHandler)
    recarregarConfigFocusHandler = null
  }
  if (srtBoundsSyncTimer !== null) {
    window.clearTimeout(srtBoundsSyncTimer)
    srtBoundsSyncTimer = null
  }
  if (srtBoundsSyncFrame !== null) {
    window.cancelAnimationFrame(srtBoundsSyncFrame)
    srtBoundsSyncFrame = null
  }
  cancelarReconexaoSrtPlayer()
  if (operacaoEventSource) {
    operacaoEventSource.close()
    operacaoEventSource = null
  }
  if (configVmixEventSource) {
    configVmixEventSource.close()
    configVmixEventSource = null
  }
  void desligarSrtPlayer()
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 p-4">
    <div class="mx-auto flex w-full min-w-0 flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3 max-[500px]:flex-col max-[500px]:items-stretch">
        <button
          class="inline-flex items-center justify-center rounded-xl border border-yellow-300 bg-yellow-100 px-3 py-2 text-left text-sm font-semibold text-yellow-800 shadow-sm transition hover:border-yellow-400 hover:bg-yellow-200 max-[500px]:flex max-[500px]:w-full"
          type="button"
          @click="voltar"
        >
          ← Voltar
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 max-[500px]:flex max-[500px]:w-full max-[500px]:justify-center"
          @click="abrirModoConferencia"
        >
          <i class="fas fa-table text-xs" />
          Modo Conferência
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 max-[500px]:flex max-[500px]:w-full max-[500px]:justify-center"
          @click="abrirModalConfiguracao"
        >
          <i class="fas fa-gear text-xs" />
          Config. Vmix
        </button>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-lg font-bold leading-tight text-slate-900">{{ tituloPagina }}</h1>
            <div v-if="resumoLeilao" class="mt-0.5 text-xs font-medium leading-tight text-slate-600">
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
        class="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start"
      >
        <div v-if="srtConfigurado" class="flex min-w-0 flex-col gap-4">
          <div class="overflow-hidden border border-slate-300 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                SRT
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
                  :disabled="recarregandoSrt"
                  title="Recarregar SRT"
                  @click="recarregarSrtPlayerManual"
                >
                  <i :class="['fas', recarregandoSrt ? 'fa-spinner fa-spin' : 'fa-rotate-right']" />
                  <span class="ml-1">{{ recarregandoSrt ? 'Recarregando' : 'Recarregar' }}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                  :title="srtPlayerMutado ? 'Ativar som' : 'Mutar som'"
                  @click="toggleMuteSrtPlayer"
                >
                  <i :class="['fas', srtPlayerMutado ? 'fa-volume-xmark' : 'fa-volume-high']" />
                </button>
              </div>
            </div>

            <div
              ref="srtPlayerHostRef"
              class="aspect-video overflow-hidden bg-black"
            ></div>

            <div
              v-if="srtStatus"
              class="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
            >
              {{ srtStatus }}
            </div>
          </div>

          <button
            v-if="vmixConfigurado"
            type="button"
            class="inline-flex w-full items-center justify-center rounded-xl border border-slate-400 bg-slate-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition hover:bg-slate-700 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="acionandoOverlayVmix"
            @click="enviarOverlayGc"
          >
            {{ acionandoOverlayVmix ? 'Enviando...' : 'OVERLAY GC' }}
          </button>

          <div class="hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:block">
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

        <div
          v-if="!srtConfigurado && animalSelecionado"
          class="hidden min-w-0 flex-col gap-4 md:flex"
        >
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                  {{ getGenealogiaAnimal() || 'Sem genealogia' }}
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

        <div class="rounded-3xl border border-blue-300 bg-gradient-to-b from-blue-200 via-blue-100 to-white p-4 shadow-md shadow-blue-200/80">
        <div class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Lances
        </div>

        <div v-if="carregando" class="mt-3 text-sm text-slate-500">Carregando animais...</div>

        <div v-else class="mt-3 flex flex-col gap-3">
          <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <button
              type="button"
              :class="[
                'rounded-full border px-2.5 py-1 transition',
                modoSelecaoOperacao === 'SIMPLES'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              ]"
              @click="definirModoSelecaoOperacao('SIMPLES')"
            >
              Simples
            </button>
            <button
              type="button"
              :class="[
                'rounded-full border px-2.5 py-1 transition',
                modoSelecaoOperacao === 'COMPOSTO'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              ]"
              @click="definirModoSelecaoOperacao('COMPOSTO')"
            >
              Composto
            </button>
          </div>

          <div
            v-if="modoSelecaoOperacao === 'COMPOSTO'"
            class="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3"
          >
            <div class="flex items-end gap-3">
              <div class="min-w-0 flex-1">
                <div class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Intervalo
                </div>
                <input
                  v-model.number="intervaloCompostoSegundos"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  type="number"
                  min="1"
                  step="1"
                />
              </div>
              <div class="pb-2 text-[11px] text-slate-500">
                Alterna os lotes selecionados sem zerar o lance.
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div ref="seletorAnimalRef" class="relative min-w-0 flex-1">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                @click="toggleSeletorAnimal"
              >
                <span class="min-w-0 truncate">
                  {{ resumoSelecaoOperacao }}
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

                <div
                  v-if="modoSelecaoOperacao === 'COMPOSTO'"
                  class="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-800"
                >
                  Selecione 2 ou mais lotes para alternar automaticamente.
                </div>

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
                    <div class="flex min-w-0 items-center gap-3">
                      <input
                        v-if="modoSelecaoOperacao === 'COMPOSTO'"
                        :checked="animaisSelecionadosIds.includes(animal.id)"
                        class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        type="checkbox"
                        tabindex="-1"
                      />
                      <span class="min-w-0 truncate">{{ animal.lote }} - {{ animal.nome }}</span>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <span
                        v-if="animalSelecionadoId === animal.id"
                        class="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700"
                      >
                        Em exibição
                      </span>
                      <span
                        class="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        :class="
                          animal.categoria === 'COBERTURAS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        "
                      >
                        {{ animal.categoria }}
                      </span>
                    </div>
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

          <div
            v-if="modoSelecaoOperacao === 'COMPOSTO' && animaisSelecionadosCompostos.length > 0"
            class="rounded-2xl border border-slate-200 bg-white/90 px-3 py-3"
          >
            <div class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Lotes em rotação
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <span
                v-for="animal in animaisSelecionadosCompostos"
                :key="animal.id"
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="
                  animalSelecionadoId === animal.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                "
              >
                {{ animal.lote }}
              </span>
            </div>
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

          <div class="flex w-full gap-1">
            <button
              v-for="valor in AJUSTES_LANCE_RAPIDO"
              :key="`mais-${valor}`"
              type="button"
              class="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-1 py-1.5 text-sm font-semibold leading-none text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              @click="ajustarLanceRapido(valor)"
            >
              +{{ valor }}
            </button>
          </div>

          <div class="flex w-full gap-1">
            <button
              v-for="valor in AJUSTES_LANCE_RAPIDO"
              :key="`menos-${valor}`"
              type="button"
              class="min-w-0 flex-1 rounded-lg border border-rose-200 bg-rose-50 px-1 py-1.5 text-sm font-semibold leading-none text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
              @click="ajustarLanceRapido(-valor)"
            >
              -{{ valor }}
            </button>
          </div>

          <button
            v-if="vmixConfigurado && !srtConfigurado"
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
            :class="!srtConfigurado ? 'md:hidden' : ''"
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
                  {{ getGenealogiaAnimal() || 'Sem genealogia' }}
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

          <div v-if="srtConfigurado" class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
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
      </div>

      <div
        class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        :class="srtConfigurado ? 'hidden' : 'md:hidden'"
      >
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
    </div>
  </div>
</template>
