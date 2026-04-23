<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { listarAnimaisPorLeilao } from '@renderer/services/animais.service'
import { obterLeilao } from '@renderer/services/leiloes.service'
import { obterConexaoOperacao, obterEstadoOperacao } from '@renderer/services/operacao.service'
import type { Animal } from '@renderer/types/animal'
import type { Leilao } from '@renderer/types/leilao'
import type { OperacaoConexaoInfo, OperacaoEstadoPersistido } from '@renderer/types/operacao'

const searchParams = new URLSearchParams(window.location.search)
const leilaoId = searchParams.get('leilaoId') ?? ''

const carregando = ref(true)
const erro = ref('')
const leilao = ref<Leilao | null>(null)
const animais = ref<Animal[]>([])
const estado = ref<OperacaoEstadoPersistido | null>(null)
const conexao = ref<OperacaoConexaoInfo | null>(null)
const valorContainerRef = ref<HTMLElement | null>(null)
const valorConteudoRef = ref<HTMLElement | null>(null)
const escalaValor = ref(1)

let operacaoEventSource: EventSource | null = null
let animaisEventSource: EventSource | null = null
let leiloesEventSource: EventSource | null = null
let valorResizeObserver: ResizeObserver | null = null

const animalAtual = computed(
  () => animais.value.find((animal) => animal.id === estado.value?.animalId) ?? null
)

const loteExibicao = computed(() => animalAtual.value?.lote?.trim() || '--')
const valorExibicao = computed(() => estado.value?.lanceAtual?.trim() || '0,00')
const valorPartes = computed(() => {
  const [inteiro, decimal = '00'] = valorExibicao.value.split(',')
  return {
    inteiro: inteiro || '0',
    decimal
  }
})
const parcelasQuantidade = computed(() => Math.max(Number(leilao.value?.multiplicador ?? 0), 0))
const parcelasExibicao = computed(() => {
  const quantidade = parcelasQuantidade.value
  if (quantidade <= 0) return 'SEM PARCELAS'
  return `${quantidade} ${quantidade === 1 ? 'PARCELA' : 'PARCELAS'}`
})

async function ajustarEscalaValor() {
  await nextTick()

  const container = valorContainerRef.value
  const conteudo = valorConteudoRef.value
  if (!container || !conteudo) return

  conteudo.style.transform = 'scale(1)'
  const larguraDisponivel = container.clientWidth
  const larguraConteudo = conteudo.scrollWidth

  if (!larguraDisponivel || !larguraConteudo) {
    escalaValor.value = 1
    return
  }

  escalaValor.value = Math.min(1, larguraDisponivel / larguraConteudo)
}

async function carregarDadosBase() {
  const [leilaoAtual, listaAnimais, estadoAtual] = await Promise.all([
    obterLeilao(leilaoId),
    listarAnimaisPorLeilao(leilaoId),
    obterEstadoOperacao(leilaoId)
  ])

  leilao.value = leilaoAtual
  animais.value = listaAnimais
  estado.value = estadoAtual
}

async function atualizarAnimais() {
  animais.value = await listarAnimaisPorLeilao(leilaoId)
}

async function atualizarLeilao() {
  leilao.value = await obterLeilao(leilaoId)
}

async function iniciarRealtime() {
  conexao.value = await obterConexaoOperacao()
  const baseUrl = conexao.value.baseUrl

  operacaoEventSource = new EventSource(`${baseUrl}/operacao/events/${encodeURIComponent(leilaoId)}`)
  operacaoEventSource.onmessage = (event) => {
    try {
      estado.value = JSON.parse(event.data) as OperacaoEstadoPersistido | null
    } catch (errorAtual) {
      console.error(errorAtual)
    }
  }
  operacaoEventSource.onerror = () => {
    erro.value = 'Falha na sincronização em tempo real da operação.'
  }

  animaisEventSource = new EventSource(`${baseUrl}/sync/events/${encodeURIComponent(`animais:${leilaoId}`)}`)
  animaisEventSource.onmessage = () => {
    void atualizarAnimais()
  }

  leiloesEventSource = new EventSource(`${baseUrl}/sync/events/${encodeURIComponent('leiloes')}`)
  leiloesEventSource.onmessage = () => {
    void atualizarLeilao()
  }
}

function fecharSse() {
  if (operacaoEventSource) {
    operacaoEventSource.close()
    operacaoEventSource = null
  }

  if (animaisEventSource) {
    animaisEventSource.close()
    animaisEventSource = null
  }

  if (leiloesEventSource) {
    leiloesEventSource.close()
    leiloesEventSource = null
  }
}

onMounted(async () => {
  try {
    await carregarDadosBase()
    await iniciarRealtime()
  } catch (errorAtual) {
    erro.value = errorAtual instanceof Error ? errorAtual.message : String(errorAtual)
  } finally {
    carregando.value = false
  }

  valorResizeObserver = new ResizeObserver(() => {
    void ajustarEscalaValor()
  })

  if (valorContainerRef.value) {
    valorResizeObserver.observe(valorContainerRef.value)
  }

  void ajustarEscalaValor()
})

onUnmounted(() => {
  fecharSse()
  if (valorResizeObserver) {
    valorResizeObserver.disconnect()
    valorResizeObserver = null
  }
})

watch(valorExibicao, () => {
  void ajustarEscalaValor()
})
</script>

<template>
  <div class="painel-preco">
    <div class="painel-preco__background" />

    <main class="painel-preco__content">
      <div v-if="erro" class="painel-preco__erro">
        {{ erro }}
      </div>

      <div v-if="carregando" class="painel-preco__loading">Carregando painel...</div>

      <template v-else>
        <section class="painel-preco__lote">
          <span class="painel-preco__lote-texto">LOTE {{ loteExibicao }}</span>
        </section>

        <section class="painel-preco__valor-card">
          <div ref="valorContainerRef" class="painel-preco__valor-viewport">
            <div
              ref="valorConteudoRef"
              class="painel-preco__valor"
              :style="{ transform: `scale(${escalaValor})` }"
            >
              <span class="painel-preco__currency">R$</span>
              <span class="painel-preco__amount">
                <span class="painel-preco__amount-inteiro">{{ valorPartes.inteiro }}</span>
                <span class="painel-preco__amount-decimal">,{{ valorPartes.decimal }}</span>
              </span>
            </div>
          </div>
        </section>

        <section class="painel-preco__parcelas">
          {{ parcelasExibicao }}
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.painel-preco {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.1), transparent 38%),
    linear-gradient(145deg, #050b17 0%, #0d1f3d 42%, #2a0b16 100%);
  color: #f8fafc;
  font-weight: 900;
}

.painel-preco__background {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 14% 24%, rgba(37, 99, 235, 0.34), transparent 24%),
    radial-gradient(circle at 84% 18%, rgba(220, 38, 38, 0.28), transparent 24%),
    radial-gradient(circle at 52% 88%, rgba(127, 29, 29, 0.22), transparent 18%),
    linear-gradient(120deg, rgba(15, 23, 42, 0.18), rgba(127, 29, 29, 0.14));
  opacity: 0.96;
}

.painel-preco__content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  gap: clamp(12px, 2vh, 28px);
  padding: clamp(16px, 2.4vw, 38px);
}

.painel-preco__erro,
.painel-preco__loading {
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(18px);
  padding: 20px 28px;
  font-size: clamp(18px, 1.8vw, 28px);
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.painel-preco__lote {
  min-width: min(22rem, 86vw);
  max-width: 90vw;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: clamp(12px, 1.2vw, 20px);
  padding: clamp(14px, 1.8vw, 22px) clamp(40px, 4.8vw, 88px);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 28px 80px rgba(2, 8, 23, 0.35);
  color: #0f172a;
  text-align: center;
  flex-wrap: wrap;
}

.painel-preco__lote-texto {
  font-family: 'Arial Black', Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  font-size: clamp(88px, 8vw, 168px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 1px 0 rgba(15, 23, 42, 0.14);
}

.painel-preco__valor-card {
  width: 95vw;
  padding: clamp(26px, 3.2vw, 48px) clamp(24px, 3.4vw, 52px);
  border-radius: 42px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow:
    0 40px 120px rgba(2, 8, 23, 0.42),
    0 12px 28px rgba(15, 23, 42, 0.18);
  color: #020617;
  text-align: center;
}

.painel-preco__valor-viewport {
  width: 100%;
  overflow: hidden;
}

.painel-preco__valor {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: clamp(14px, 1.2vw, 24px);
  flex-wrap: nowrap;
  width: max-content;
  margin-inline: auto;
  transform-origin: center center;
}

.painel-preco__currency {
  font-size: clamp(48px, 4vw, 84px);
  font-weight: 900;
  line-height: 1;
  transform: translateY(-0.08em);
}

.painel-preco__amount {
  font-family: 'Arial Black', Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  font-weight: 900;
  line-height: 0.82;
  letter-spacing: 0.01em;
  white-space: nowrap;
  text-shadow: 0 2px 0 rgba(15, 23, 42, 0.08);
  display: inline-flex;
  align-items: flex-start;
}

.painel-preco__amount-inteiro {
  font-size: clamp(156px, 16vw, 360px);
  line-height: 0.82;
}

.painel-preco__amount-decimal {
  font-size: clamp(68px, 5.8vw, 136px);
  line-height: 1;
  margin-top: 0.12em;
}

.painel-preco__parcelas {
  min-width: min(50rem, 94vw);
  padding: clamp(16px, 2vw, 24px) clamp(44px, 5vw, 96px);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 22px 68px rgba(2, 8, 23, 0.3);
  color: #0f172a;
  text-align: center;
  font-family: 'Arial Black', Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  font-size: clamp(68px, 6.8vw, 144px);
  font-weight: 900;
  letter-spacing: 0.03em;
  text-shadow: 0 1px 0 rgba(15, 23, 42, 0.1);
  line-height: 1;
  text-transform: uppercase;
}

@media (max-height: 840px) {
  .painel-preco__content {
    justify-content: center;
    gap: 16px;
    padding-block: 14px;
  }

  .painel-preco__amount {
    line-height: 0.84;
  }

  .painel-preco__amount-inteiro {
    font-size: clamp(124px, 12.5vw, 260px);
  }

  .painel-preco__amount-decimal {
    font-size: clamp(52px, 5vw, 98px);
  }

  .painel-preco__lote-texto {
    font-size: clamp(64px, 6.8vw, 120px);
  }

  .painel-preco__parcelas {
    font-size: clamp(44px, 5vw, 88px);
  }
}

@media (max-width: 900px) {
  .painel-preco__content {
    justify-content: center;
  }

  .painel-preco__valor-card {
    border-radius: 30px;
  }

  .painel-preco__valor {
    flex-wrap: wrap;
  }
}
</style>
