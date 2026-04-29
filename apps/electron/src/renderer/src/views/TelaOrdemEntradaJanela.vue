<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import { atualizarAnimaisEmLote, listarAnimaisPorLeilao } from '@renderer/services/animais.service'
import { atualizarLeilao, obterLeilao } from '@renderer/services/leiloes.service'
import type { Animal } from '@renderer/types/animal'
import type { Leilao } from '@renderer/types/leilao'

const searchParams = new URLSearchParams(window.location.search)
const leilaoId = searchParams.get('leilaoId') ?? ''

const carregando = ref(true)
const salvando = ref(false)
const erro = ref('')
const leilao = ref<Leilao | null>(null)
const disponiveis = ref<Animal[]>([])
const ordenados = ref<Animal[]>([])
const selecionadosDisponiveis = ref<string[]>([])
const selecionadosOrdenados = ref<string[]>([])

const titulo = computed(() => leilao.value?.titulo_evento || 'Ordem de Entrada')
const podeAdicionar = computed(() => selecionadosDisponiveis.value.length > 0)
const podeRemover = computed(() => selecionadosOrdenados.value.length > 0)
const podeSubir = computed(() => {
  const indices = getIndicesSelecionadosOrdenados()
  return indices.length > 0 && indices[0] > 0
})
const podeDescer = computed(() => {
  const indices = getIndicesSelecionadosOrdenados()
  return indices.length > 0 && indices[indices.length - 1] < ordenados.value.length - 1
})

function normalizarOrdem(valor: number | string | null | undefined) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 ? numero : 0
}

function compararLote(a: Animal, b: Animal) {
  return String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true })
}

function ordenarPorEntrada(lista: Animal[]) {
  return [...lista].sort((a, b) => {
    const ordemA = normalizarOrdem(a.ordem)
    const ordemB = normalizarOrdem(b.ordem)
    if (ordemA && ordemB && ordemA !== ordemB) return ordemA - ordemB
    if (ordemA && !ordemB) return -1
    if (!ordemA && ordemB) return 1
    return compararLote(a, b)
  })
}

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    const [leilaoAtual, animais] = await Promise.all([
      obterLeilao(leilaoId),
      listarAnimaisPorLeilao(leilaoId)
    ])
    leilao.value = leilaoAtual
    const animaisOrdenados = ordenarPorEntrada(
      animais.filter((animal) => normalizarOrdem(animal.ordem) > 0)
    )
    const idsOrdenados = new Set(animaisOrdenados.map((animal) => animal.id))

    ordenados.value = animaisOrdenados
    disponiveis.value = animais
      .filter((animal) => !idsOrdenados.has(animal.id))
      .sort(compararLote)
  } catch (errorAtual) {
    erro.value = errorAtual instanceof Error ? errorAtual.message : String(errorAtual)
  } finally {
    carregando.value = false
  }
}

function getIndicesSelecionadosOrdenados() {
  const ids = new Set(selecionadosOrdenados.value)
  return ordenados.value
    .map((animal, index) => (ids.has(animal.id) ? index : -1))
    .filter((index) => index >= 0)
}

function adicionarNaOrdem() {
  const ids = new Set(selecionadosDisponiveis.value)
  if (ids.size === 0) return

  const adicionados = disponiveis.value.filter((animal) => ids.has(animal.id))
  disponiveis.value = disponiveis.value.filter((animal) => !ids.has(animal.id))
  ordenados.value = [...ordenados.value, ...adicionados]
  selecionadosDisponiveis.value = []
  selecionadosOrdenados.value = adicionados.map((animal) => animal.id)
}

function removerDaOrdem() {
  const ids = new Set(selecionadosOrdenados.value)
  if (ids.size === 0) return

  const removidos = ordenados.value.filter((animal) => ids.has(animal.id))
  ordenados.value = ordenados.value.filter((animal) => !ids.has(animal.id))
  disponiveis.value = [...disponiveis.value, ...removidos].sort(compararLote)
  selecionadosOrdenados.value = []
  selecionadosDisponiveis.value = removidos.map((animal) => animal.id)
}

function resetarOrdem() {
  disponiveis.value = [...disponiveis.value, ...ordenados.value].sort(compararLote)
  ordenados.value = []
  selecionadosDisponiveis.value = []
  selecionadosOrdenados.value = []
}

function moverOrdenados(direcao: -1 | 1) {
  const indices = getIndicesSelecionadosOrdenados()
  if (indices.length === 0) return

  const itens = [...ordenados.value]
  const iteracao = direcao < 0 ? indices : [...indices].reverse()

  for (const index of iteracao) {
    const alvo = index + direcao
    if (alvo < 0 || alvo >= itens.length) continue
    const item = itens[index]
    itens[index] = itens[alvo]
    itens[alvo] = item
  }

  ordenados.value = itens
}

async function salvar() {
  salvando.value = true
  erro.value = ''

  try {
    const payloads = [
      ...ordenados.value.map((animal, index) => ({ id: animal.id, ordem: index + 1 })),
      ...disponiveis.value.map((animal) => ({ id: animal.id, ordem: 0 }))
    ]

    await atualizarAnimaisEmLote(payloads)
    await atualizarLeilao(leilaoId, { ordenacao_animais: ordenados.value.length > 0 ? 'ENTRADA' : 'LOTE' })
    window.close()
  } catch (errorAtual) {
    erro.value = errorAtual instanceof Error ? errorAtual.message : String(errorAtual)
  } finally {
    salvando.value = false
  }
}

function fechar() {
  window.close()
}

onMounted(() => {
  void carregar()
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div class="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div class="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
          Ordem de Entrada
        </div>
        <div class="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{{ titulo }}</div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
        <div v-if="erro" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {{ erro }}
        </div>

        <div v-if="carregando" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Carregando...
        </div>

        <div v-else class="grid min-h-[420px] flex-1 grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)_4rem] gap-3">
          <div class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div class="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              Lotes do leilão
            </div>
            <select
              v-model="selecionadosDisponiveis"
              multiple
              class="min-h-0 flex-1 border-0 bg-white p-2 text-sm text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100"
            >
              <option v-for="animal in disponiveis" :key="animal.id" :value="animal.id">
                {{ animal.lote }} - {{ animal.nome }}
              </option>
            </select>
          </div>

          <div class="flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              class="h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              :disabled="!podeAdicionar"
              @click="adicionarNaOrdem"
            >
              <i class="fas fa-chevron-right" />
            </button>
            <button
              type="button"
              class="h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              :disabled="!podeRemover"
              @click="removerDaOrdem"
            >
              <i class="fas fa-chevron-left" />
            </button>
          </div>

          <div class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div class="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              Ordem de entrada
            </div>
            <select
              v-model="selecionadosOrdenados"
              multiple
              class="min-h-0 flex-1 border-0 bg-white p-2 text-sm font-semibold text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100"
            >
              <option v-for="(animal, index) in ordenados" :key="animal.id" :value="animal.id">
                [{{ index + 1 }}]  -  {{ animal.lote }}  |  {{ animal.nome }}
              </option>
            </select>
          </div>

          <div class="flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              class="h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              :disabled="!podeSubir"
              @click="moverOrdenados(-1)"
            >
              <i class="fas fa-chevron-up" />
            </button>
            <button
              type="button"
              class="h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              :disabled="!podeDescer"
              @click="moverOrdenados(1)"
            >
              <i class="fas fa-chevron-down" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <BaseButton :disabled="carregando || salvando || ordenados.length === 0" @click="resetarOrdem">
          Resetar
        </BaseButton>
        <div class="flex justify-end gap-3">
          <BaseButton :disabled="salvando" @click="fechar">Cancelar</BaseButton>
          <BaseButton variante="primario" :disabled="carregando || salvando" @click="salvar">
            {{ salvando ? 'Salvando...' : 'Salvar' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
