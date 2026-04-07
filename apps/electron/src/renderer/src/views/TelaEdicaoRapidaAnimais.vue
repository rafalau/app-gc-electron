<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import BaseToast from '@renderer/components/ui/BaseToast.vue'
import { type Animal, type AnimalAtualizacaoEmLotePayload } from '@renderer/types/animal'
import {
  buildInformacoesAgregadas,
  formatarInformacoesParaExibicao,
  parseInformacoesAgregadas
} from '@renderer/utils/animalInformacoes'

type LinhaEdicaoRapida = Animal & {
  condicoesTexto: string
  baseAtualizadoEm: string
  conflitoExterno: boolean
}

type LayoutInformacoesAnimais = 'AGREGADAS' | 'SEPARADAS'

const searchParams = new URLSearchParams(window.location.search)
const leilaoId = searchParams.get('leilaoId') ?? ''
const animalIdInicial = searchParams.get('animalId') ?? ''
const baseUrl = searchParams.get('baseUrl') ?? ''

const carregando = ref(true)
const salvando = ref(false)
const tituloLeilao = ref('Modo Conferência')
const layoutModo = ref<LayoutInformacoesAnimais>('AGREGADAS')
const busca = ref('')
const erro = ref('')
const linhas = ref<LinhaEdicaoRapida[]>([])
const snapshotsPorId = ref<Record<string, string>>({})
const toastRef = ref<InstanceType<typeof BaseToast> | null>(null)
let eventSource: EventSource | null = null
let pollingSyncId: number | null = null
let ignorarConflitosAte = 0

type LeilaoQuickEdit = {
  id: string
  titulo_evento: string
}

type LayoutAnimaisConfig = {
  modo: LayoutInformacoesAnimais
  incluirRacaNasImportacoes: boolean
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Falha HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

function showToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  duration = 4000
) {
  toastRef.value?.addToast(message, type, duration)
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

function normalizarTexto(value: string) {
  return value.toUpperCase()
}

function normalizarCondicoesTexto(value: string) {
  return value
    .split(/\n|;/)
    .map((item) => normalizarTexto(item).trim())
    .filter(Boolean)
}

function serializarAnimal(animal: Animal) {
  return JSON.stringify({
    lote: animal.lote,
    nome: animal.nome,
    categoria: animal.categoria,
    vendedor: animal.vendedor,
    condicoes_pagamento_especificas: animal.condicoes_pagamento_especificas,
    raca: animal.raca,
    sexo: animal.sexo,
    pelagem: animal.pelagem,
    nascimento: animal.nascimento,
    informacoes: formatarInformacoesParaExibicao(animal.informacoes),
    genealogia: animal.genealogia,
    condicoes_cobertura: animal.condicoes_cobertura
  })
}

function serializarLinha(linha: LinhaEdicaoRapida) {
  return JSON.stringify({
    lote: linha.lote,
    nome: linha.nome,
    categoria: linha.categoria,
    vendedor: linha.vendedor,
    condicoes_pagamento_especificas: linha.condicoes_pagamento_especificas,
    raca: linha.raca,
    sexo: linha.sexo,
    pelagem: linha.pelagem,
    nascimento: linha.nascimento,
    informacoes: linha.informacoes,
    genealogia: linha.genealogia,
    condicoes_cobertura: normalizarCondicoesTexto(linha.condicoesTexto)
  })
}

function criarLinha(animal: Animal): LinhaEdicaoRapida {
  const parsed = parseInformacoesAgregadas(animal.informacoes)
  return {
    ...animal,
    informacoes: formatarInformacoesParaExibicao(animal.informacoes),
    raca: animal.raca || parsed.raca,
    sexo: animal.sexo || parsed.sexo,
    pelagem: animal.pelagem || parsed.pelagem,
    nascimento: animal.nascimento || parsed.nascimento,
    condicoesTexto: animal.condicoes_cobertura.join('\n'),
    baseAtualizadoEm: animal.atualizado_em,
    conflitoExterno: false
  }
}

function linhaEstaSuja(linha: LinhaEdicaoRapida) {
  return snapshotsPorId.value[linha.id] !== serializarLinha(linha)
}

function validarLote(lote: string) {
  const valor = lote.trim().toUpperCase()
  const match = valor.match(/^(\d+)/)
  if (!match) return 'O lote deve começar com número'
  if (match[1].length < 2) return 'O lote deve ter pelo menos dois dígitos no início'
  return ''
}

function atualizarCampo<K extends keyof LinhaEdicaoRapida>(id: string, campo: K, valor: LinhaEdicaoRapida[K]) {
  const linha = linhas.value.find((item) => item.id === id)
  if (!linha) return
  ;(linha[campo] as LinhaEdicaoRapida[K]) = valor
}

async function focarAnimalInicial() {
  if (!animalIdInicial) return
  await nextTick()
  document.getElementById(`animal-rapido-${animalIdInicial}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  })
}

async function carregarDados(opcoes?: { preservarRascunho?: boolean }) {
  const preservarRascunho = Boolean(opcoes?.preservarRascunho)
  erro.value = ''

  if (!preservarRascunho) {
    carregando.value = true
  }

  try {
    const [leilao, animais, layout] = await Promise.all([
      fetchJson<LeilaoQuickEdit | null>(`/sync/leiloes/${encodeURIComponent(leilaoId)}`),
      fetchJson<Animal[]>(`/sync/animais/${encodeURIComponent(leilaoId)}`),
      fetchJson<LayoutAnimaisConfig>(`/sync/layout/${encodeURIComponent(leilaoId)}`)
    ])

    tituloLeilao.value = leilao?.titulo_evento || 'Modo Conferência'
    layoutModo.value = layout?.modo === 'SEPARADAS' ? 'SEPARADAS' : 'AGREGADAS'

    const linhasAtuais = new Map(linhas.value.map((linha) => [linha.id, linha]))
    const linhasSujas = new Set(
      preservarRascunho
        ? linhas.value.filter((linha) => linhaEstaSuja(linha)).map((linha) => linha.id)
        : []
    )

    const proximasLinhas: LinhaEdicaoRapida[] = []
    const proximosSnapshots: Record<string, string> = {}
    let conflitos = 0
    let sujasPreservadas = 0

    for (const animal of [...animais].sort((a, b) => compararLote(a.lote, b.lote))) {
      const snapshot = serializarAnimal(animal)
      proximosSnapshots[animal.id] = snapshot

      if (preservarRascunho && linhasSujas.has(animal.id)) {
        const rascunho = linhasAtuais.get(animal.id)
        if (rascunho) {
          const houveMudancaExternaEnquantoEditava =
            rascunho.baseAtualizadoEm !== animal.atualizado_em && Date.now() > ignorarConflitosAte

          proximasLinhas.push({
            ...rascunho,
            baseAtualizadoEm: animal.atualizado_em,
            conflitoExterno: houveMudancaExternaEnquantoEditava
          })
          sujasPreservadas += 1
          if (houveMudancaExternaEnquantoEditava) conflitos += 1
          continue
        }
      }

      proximasLinhas.push(criarLinha(animal))
    }

    linhas.value = proximasLinhas
    snapshotsPorId.value = proximosSnapshots

    if (preservarRascunho && linhasSujas.size > sujasPreservadas) {
      showToast(
        'Algumas linhas foram alteradas ou removidas externamente enquanto você editava.',
        'warning',
        4500
      )
    } else if (conflitos > 0) {
      showToast(
        'Chegaram alterações externas em linhas com rascunho local. Revise antes de salvar.',
        'warning',
        4500
      )
    }

    await focarAnimalInicial()
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
    showToast(erro.value, 'error', 6000)
  } finally {
    carregando.value = false
  }
}

async function iniciarSync() {
  if (pollingSyncId) {
    window.clearInterval(pollingSyncId)
    pollingSyncId = null
  }

  try {
    eventSource = new EventSource(
      `${baseUrl}/sync/events/${encodeURIComponent(`animais:${leilaoId}`)}`
    )
    eventSource.onopen = () => {}
    eventSource.onmessage = () => {
      void carregarDados({ preservarRascunho: true })
    }
    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
      iniciarPollingSync()
    }
  } catch {
    iniciarPollingSync()
  }
}

function iniciarPollingSync() {
  if (pollingSyncId) return

  showToast(
    'Realtime direto indisponível nesta janela. Sincronizando por atualização automática.',
    'info',
    5000
  )

  pollingSyncId = window.setInterval(() => {
    void carregarDados({ preservarRascunho: true })
  }, 2000)
}

const linhasFiltradas = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  if (!termo) return linhas.value

  return linhas.value.filter((linha) =>
    [linha.lote, linha.nome]
      .join(' ')
      .toLowerCase()
      .includes(termo)
  )
})

const totalSujo = computed(() => linhas.value.filter((linha) => linhaEstaSuja(linha)).length)
const totalConflitos = computed(() => linhas.value.filter((linha) => linha.conflitoExterno).length)

async function salvarTudo() {
  erro.value = ''

  const alteradas = linhas.value.filter((linha) => linhaEstaSuja(linha))
  if (alteradas.length === 0) {
    showToast('Nenhuma alteração pendente.', 'info', 3000)
    return
  }

  const payloads: AnimalAtualizacaoEmLotePayload[] = []

  for (const linha of alteradas) {
    if (!linha.lote.trim()) {
      erro.value = `Lote obrigatório no animal ${linha.nome || linha.id}.`
      return
    }

    const erroLote = validarLote(linha.lote)
    if (erroLote) {
      erro.value = `${erroLote} no animal ${linha.nome || linha.id}.`
      return
    }

    if (!linha.nome.trim()) {
      erro.value = `Nome obrigatório no lote ${linha.lote}.`
      return
    }

    const condicoes = normalizarCondicoesTexto(linha.condicoesTexto)
    if (linha.categoria === 'COBERTURAS' && condicoes.length === 0) {
      erro.value = `Adicione ao menos uma condição para o lote ${linha.lote}.`
      return
    }

    const informacoes =
      layoutModo.value === 'SEPARADAS'
        ? buildInformacoesAgregadas({
            raca: linha.raca,
            sexo: linha.sexo,
            pelagem: linha.pelagem,
            nascimento: linha.nascimento
          })
        : linha.informacoes

    payloads.push({
      id: linha.id,
      lote: linha.lote,
      nome: linha.nome,
      categoria: linha.categoria,
      vendedor: linha.vendedor,
      condicoes_pagamento_especificas: linha.condicoes_pagamento_especificas,
      raca: linha.raca,
      sexo: linha.sexo,
      pelagem: linha.pelagem,
      nascimento: linha.nascimento,
      informacoes,
      genealogia: linha.genealogia,
      condicoes_cobertura: condicoes
    })
  }

  salvando.value = true

  try {
    ignorarConflitosAte = Date.now() + 5000
    await fetchJson<Animal[]>(`/sync/animais-lote`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads)
    })
    await carregarDados()
    showToast(`${payloads.length} animal(is) salvo(s) de uma vez.`, 'success', 3500)
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
    showToast(erro.value, 'error', 6000)
  } finally {
    salvando.value = false
  }
}

function fecharJanela() {
  window.close()
}

onMounted(async () => {
  await carregarDados()
  await iniciarSync()
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  if (pollingSyncId) {
    window.clearInterval(pollingSyncId)
    pollingSyncId = null
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-800 text-slate-900">
    <BaseToast ref="toastRef" />
    <div class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div class="flex flex-col gap-4 px-5 py-4 lg:px-7">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Modo Conferência
            </div>
            <h1 class="mt-1 text-2xl font-black text-slate-900">{{ tituloLeilao }}</h1>
            <div class="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span class="rounded-full bg-slate-100 px-3 py-1">
                {{ linhas.length }} animal(is)
              </span>
              <span class="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                {{ totalSujo }} com alteração
              </span>
              <span
                v-if="totalConflitos > 0"
                class="rounded-full bg-rose-100 px-3 py-1 text-rose-800"
              >
                {{ totalConflitos }} com conflito externo
              </span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <BaseButton variante="secundario" @click="fecharJanela">Fechar</BaseButton>
            <BaseButton variante="sucesso" :disabled="salvando || totalSujo === 0" @click="salvarTudo">
              {{ salvando ? 'Salvando...' : 'Salvar alterações' }}
            </BaseButton>
          </div>
        </div>

        <input
          v-model="busca"
          type="text"
          class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          placeholder="Buscar por lote ou nome..."
          @input="busca = normalizarTexto(busca)"
        />

      </div>
    </div>

    <div class="px-6 py-6 lg:px-8 lg:py-8">
      <div v-if="carregando" class="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Carregando animais...
      </div>

      <div v-else-if="linhasFiltradas.length > 0" class="space-y-6">
        <div
          v-for="linha in linhasFiltradas"
          :id="`animal-rapido-${linha.id}`"
          :key="linha.id"
          class="rounded-3xl border bg-white p-4 shadow-sm"
          :class="[
            linhaEstaSuja(linha) ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200',
            linha.conflitoExterno ? 'ring-1 ring-inset ring-rose-200' : ''
          ]"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span class="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
                Lote {{ linha.lote || 'SEM LOTE' }}
              </span>
              <span
                class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                :class="
                  linha.categoria === 'COBERTURAS'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                "
              >
                {{ linha.categoria }}
              </span>
              <span
                v-if="linhaEstaSuja(linha)"
                class="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800"
              >
                Alterado
              </span>
              <span
                v-if="linha.conflitoExterno"
                class="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-800"
              >
                Conflito externo
              </span>
            </div>
          </div>

          <div class="mt-4 grid gap-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-[110px_minmax(0,1fr)]">
              <div>
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Lote
                </div>
                <input
                  :value="linha.lote"
                  class="campo-grid w-full px-2 text-center"
                  type="text"
                  maxlength="4"
                  @input="
                    atualizarCampo(
                      linha.id,
                      'lote',
                      normalizarTexto(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </div>

              <div>
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Nome
                </div>
                <input
                  :value="linha.nome"
                  class="campo-grid w-full"
                  type="text"
                  @input="
                    atualizarCampo(
                      linha.id,
                      'nome',
                      normalizarTexto(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </div>
            </div>

            <div v-if="layoutModo === 'SEPARADAS'" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Raça
                </div>
                <input
                  :value="linha.raca"
                  class="campo-grid w-full"
                  type="text"
                  @input="
                    atualizarCampo(
                      linha.id,
                      'raca',
                      normalizarTexto(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </div>

              <div>
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Sexo
                </div>
                <input
                  :value="linha.sexo"
                  class="campo-grid w-full"
                  type="text"
                  @input="
                    atualizarCampo(
                      linha.id,
                      'sexo',
                      normalizarTexto(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </div>

              <div>
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Pelagem
                </div>
                <input
                  :value="linha.pelagem"
                  class="campo-grid w-full"
                  type="text"
                  @input="
                    atualizarCampo(
                      linha.id,
                      'pelagem',
                      normalizarTexto(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </div>

              <div>
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Nascimento
                </div>
                <input
                  :value="linha.nascimento"
                  class="campo-grid w-full"
                  type="text"
                  @input="
                    atualizarCampo(
                      linha.id,
                      'nascimento',
                      normalizarTexto(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </div>
            </div>

            <div v-else>
              <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Informações
              </div>
              <input
                :value="linha.informacoes"
                class="campo-grid w-full"
                type="text"
                @input="
                  atualizarCampo(
                    linha.id,
                    'informacoes',
                    normalizarTexto(($event.target as HTMLInputElement).value)
                  )
                "
              />
            </div>

            <div>
              <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Genealogia
              </div>
              <input
                :value="linha.genealogia"
                class="campo-grid w-full"
                type="text"
                @input="
                  atualizarCampo(
                    linha.id,
                    'genealogia',
                    normalizarTexto(($event.target as HTMLInputElement).value)
                  )
                "
              />
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Vendedor
                </div>
                <input
                  :value="linha.vendedor"
                  class="campo-grid w-full"
                  type="text"
                  @input="
                    atualizarCampo(
                      linha.id,
                      'vendedor',
                      normalizarTexto(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </div>

              <div>
                <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Condições Específicas
                </div>
                <input
                  :value="linha.condicoes_pagamento_especificas"
                  class="campo-grid w-full"
                  type="text"
                  @input="
                    atualizarCampo(
                      linha.id,
                      'condicoes_pagamento_especificas',
                      normalizarTexto(($event.target as HTMLInputElement).value)
                    )
                  "
                />
              </div>
            </div>

            <div v-if="linha.categoria === 'COBERTURAS'">
              <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Pacotes disponíveis
              </div>
              <input
                :value="linha.condicoesTexto"
                class="campo-grid w-full"
                type="text"
                @input="
                  atualizarCampo(
                    linha.id,
                    'condicoesTexto',
                    normalizarTexto(($event.target as HTMLInputElement).value)
                  )
                "
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm"
      >
        Nenhum animal encontrado.
      </div>
    </div>

    <div class="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur lg:px-7">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-slate-600">
          {{ totalSujo }} linha(s) com alteração pendente.
        </div>

        <div class="flex flex-wrap gap-2">
          <BaseButton variante="secundario" @click="fecharJanela">Fechar</BaseButton>
          <BaseButton variante="sucesso" :disabled="salvando || totalSujo === 0" @click="salvarTudo">
            {{ salvando ? 'Salvando...' : 'Salvar alterações' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.campo-grid {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgb(226 232 240);
  background: rgb(248 250 252);
  padding: 0.75rem 0.875rem;
  color: rgb(15 23 42);
  outline: none;
  line-height: 1.4;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.campo-grid:focus {
  border-color: rgb(96 165 250);
  background: white;
  box-shadow: 0 0 0 4px rgb(219 234 254);
}

</style>
