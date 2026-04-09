<script setup lang="ts">
import { reactive, ref, watch, onMounted } from 'vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import { CATEGORIAS_ANIMAL, type AnimalCriarPayload } from '@renderer/types/animal'
import type { LayoutInformacoesAnimais } from '@renderer/composables/useAnimais'
import type { StudbookSearchResult } from '@renderer/types/importacao'
import { buscarStudbook, importarAnimalStudbook } from '@renderer/services/importacao.service'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'
import {
  buildInformacoesAgregadas,
  parseInformacoesAgregadas
} from '@renderer/utils/animalInformacoes'

const searchParams = new URLSearchParams(window.location.search)
const leilaoId = searchParams.get('leilaoId') ?? ''
const animalId = searchParams.get('animalId') ?? ''
const baseUrl = searchParams.get('baseUrl') ?? ''

const carregando = ref(true)
const salvando = ref(false)
const erro = ref('')
const titulo = ref('Editar Animal')
const layoutModo = ref<LayoutInformacoesAnimais>('SEPARADAS')
const form = ref<AnimalCriarPayload>({
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
  peso: '',
  informacoes: '',
  genealogia: '',
  condicoes_cobertura: []
})

const formLocal = reactive<AnimalCriarPayload>({
  leilao_id: '',
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
  peso: '',
  informacoes: '',
  genealogia: '',
  condicoes_cobertura: []
})

const novaCondicao = ref('')
const studbookTerm = ref('')
const studbookResults = ref<StudbookSearchResult[]>([])
const studbookLoading = ref(false)
const studbookImportandoRegistro = ref('')
const studbookErro = ref('')
const studbookAberto = ref(false)

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Falha HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

function sincronizarForm() {
  formLocal.leilao_id = form.value.leilao_id
  formLocal.lote = form.value.lote
  formLocal.nome = form.value.nome
  formLocal.categoria = form.value.categoria
  formLocal.vendedor = form.value.vendedor
  formLocal.condicoes_pagamento_especificas = form.value.condicoes_pagamento_especificas
  formLocal.raca = form.value.raca
  formLocal.sexo = form.value.sexo
  formLocal.pelagem = form.value.pelagem
  formLocal.nascimento = form.value.nascimento
  formLocal.altura = form.value.altura
  formLocal.peso = form.value.peso
  formLocal.informacoes = form.value.informacoes
  formLocal.genealogia = form.value.genealogia
  formLocal.condicoes_cobertura = [...form.value.condicoes_cobertura]

  if (!formLocal.raca && !formLocal.sexo && !formLocal.pelagem && !formLocal.nascimento && !formLocal.altura && !formLocal.peso) {
    const parsed = parseInformacoesAgregadas(form.value.informacoes)
    formLocal.raca = parsed.raca
    formLocal.sexo = parsed.sexo
    formLocal.pelagem = parsed.pelagem
    formLocal.nascimento = parsed.nascimento
    formLocal.altura = parsed.altura
    formLocal.peso = parsed.peso
  }

  novaCondicao.value = ''
  studbookTerm.value = ''
  studbookResults.value = []
  studbookErro.value = ''
  studbookAberto.value = false
}

watch(
  form,
  () => sincronizarForm(),
  { deep: true, immediate: true }
)

function validarLote(lote: string) {
  const valor = lote.trim().toUpperCase()
  const match = valor.match(/^(\d+)/)
  if (!match) return 'O lote deve começar com número'
  if (match[1].length < 2) return 'O lote deve ter pelo menos dois dígitos no início. Ex: 01, 02, 10'
  return ''
}

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    const [leilao, animais] = await Promise.all([
      fetchJson<any>(`/sync/leiloes/${encodeURIComponent(leilaoId)}`),
      fetchJson<any[]>(`/sync/animais/${encodeURIComponent(leilaoId)}`)
    ])

    const animal = animais.find((item) => item.id === animalId)
    if (!animal) {
      erro.value = 'Animal não encontrado.'
      return
    }

    titulo.value = leilao?.titulo_evento ? `Editar Animal - ${leilao.titulo_evento}` : 'Editar Animal'
    document.title = titulo.value
    layoutModo.value = 'SEPARADAS'
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
      peso: animal.peso,
      informacoes: animal.informacoes,
      genealogia: animal.genealogia,
      condicoes_cobertura: [...animal.condicoes_cobertura]
    }
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
  } finally {
    carregando.value = false
  }
}

async function pesquisarStudbook() {
  studbookErro.value = ''
  studbookResults.value = []

  if (!studbookTerm.value.trim()) return

  studbookLoading.value = true
  try {
    studbookResults.value = await buscarStudbook(studbookTerm.value)
    if (studbookResults.value.length === 0) {
      studbookErro.value = 'A pesquisa não retornou resultados.'
    }
  } catch (errorAtual) {
    studbookErro.value = (errorAtual as Error).message
  } finally {
    studbookLoading.value = false
  }
}

async function importarStudbook(registro: string) {
  studbookErro.value = ''
  studbookImportandoRegistro.value = registro

  try {
    const payload = await importarAnimalStudbook(registro)
    formLocal.nome = payload.nome
    formLocal.informacoes = payload.informacoes
    formLocal.genealogia = payload.genealogia
    const parsed = parseInformacoesAgregadas(payload.informacoes)
    formLocal.raca = parsed.raca
    formLocal.sexo = parsed.sexo
    formLocal.pelagem = parsed.pelagem
    formLocal.nascimento = parsed.nascimento
    formLocal.altura = parsed.altura
    formLocal.peso = parsed.peso
    studbookAberto.value = false
  } catch (errorAtual) {
    studbookErro.value = (errorAtual as Error).message
  } finally {
    studbookImportandoRegistro.value = ''
  }
}

function adicionarCondicao() {
  const valor = novaCondicao.value.trim()
  if (!valor) return
  formLocal.condicoes_cobertura = [...formLocal.condicoes_cobertura, valor]
  novaCondicao.value = ''
}

function removerCondicao(index: number) {
  formLocal.condicoes_cobertura = formLocal.condicoes_cobertura.filter((_, i) => i !== index)
}

function fecharJanela() {
  window.close()
}

async function salvar() {
  erro.value = ''

  const informacoes = buildInformacoesAgregadas({
    raca: formLocal.raca,
    sexo: formLocal.sexo,
    pelagem: formLocal.pelagem,
    nascimento: formLocal.nascimento,
    altura: formLocal.altura,
    peso: formLocal.peso
  })

  const payload: AnimalCriarPayload = {
    ...formLocal,
    informacoes,
    condicoes_cobertura: [...formLocal.condicoes_cobertura]
  }

  if (!payload.lote.trim()) {
    erro.value = 'Informe o lote do animal'
    return
  }

  const erroLote = validarLote(payload.lote)
  if (erroLote) {
    erro.value = erroLote
    return
  }

  if (!payload.nome.trim()) {
    erro.value = 'Informe o nome do animal'
    return
  }

  if (payload.categoria === 'COBERTURAS' && payload.condicoes_cobertura.length === 0) {
    erro.value = 'Adicione ao menos uma condição para coberturas'
    return
  }

  salvando.value = true
  try {
    await fetchJson(`/sync/animal/${encodeURIComponent(animalId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lote: payload.lote,
        nome: payload.nome,
        categoria: payload.categoria,
        vendedor: payload.vendedor,
        condicoes_pagamento_especificas: payload.condicoes_pagamento_especificas,
        raca: payload.raca,
        sexo: payload.sexo,
        pelagem: payload.pelagem,
        nascimento: payload.nascimento,
        altura: payload.altura,
        peso: payload.peso,
        informacoes: payload.informacoes,
        genealogia: payload.genealogia,
        condicoes_cobertura: payload.condicoes_cobertura
      })
    })
    fecharJanela()
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
  } finally {
    salvando.value = false
  }
}

onMounted(() => {
  void carregar()
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 p-4">
    <div class="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
        <div class="text-lg font-bold">Editar Animal</div>
        <div v-if="titulo" class="mt-1 text-sm text-blue-100">{{ titulo }}</div>
      </div>

      <div class="px-6 py-6">
        <div v-if="carregando" class="text-sm text-slate-500">Carregando...</div>

        <div v-else>
          <div
            v-if="erro"
            class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {{ erro }}
          </div>

          <div class="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-slate-900">A.B.C.P.C.C.</div>
                <div class="text-xs text-slate-500">
                  Buscar e preencher nome, informações e genealogia automaticamente.
                </div>
              </div>
              <BaseButton variante="primario" @click="studbookAberto = !studbookAberto">
                Buscar na associação
              </BaseButton>
            </div>

            <Transition name="studbook-expand">
              <div v-if="studbookAberto" class="mt-4 space-y-4">
                <div class="flex gap-3">
                  <input
                    v-model="studbookTerm"
                    class="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    type="text"
                    @input="applyUppercaseInput($event, (value) => (studbookTerm = value))"
                    @keydown.enter.prevent="pesquisarStudbook"
                  />
                  <BaseButton :disabled="studbookLoading" variante="primario" @click="pesquisarStudbook">
                    {{ studbookLoading ? 'Pesquisando...' : 'Pesquisar' }}
                  </BaseButton>
                </div>

                <div
                  v-if="studbookErro"
                  class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
                >
                  {{ studbookErro }}
                </div>

                <div
                  v-if="studbookResults.length"
                  class="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <table class="min-w-full text-left text-sm text-slate-700">
                    <thead class="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th class="px-4 py-3">Nome</th>
                        <th class="px-4 py-3 text-center">Registro</th>
                        <th class="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 bg-white">
                      <tr v-for="result in studbookResults" :key="result.registro">
                        <td class="px-4 py-3">{{ result.nome }}</td>
                        <td class="px-4 py-3 text-center">{{ result.registro }}</td>
                        <td class="px-4 py-3 text-right">
                          <button
                            class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70"
                            type="button"
                            :disabled="studbookImportandoRegistro === result.registro"
                            @click="importarStudbook(result.registro)"
                          >
                            {{
                              studbookImportandoRegistro === result.registro ? 'Importando...' : 'Usar dados'
                            }}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Transition>
          </div>

          <div class="grid grid-cols-12 gap-5">
            <div class="col-span-12">
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Categoria
              </label>
              <div class="relative">
                <select
                  v-model="formLocal.categoria"
                  class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option v-for="categoria in CATEGORIAS_ANIMAL" :key="categoria" :value="categoria">
                    {{ categoria }}
                  </option>
                </select>
                <i
                  class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                />
              </div>
            </div>

            <div class="col-span-12 md:col-span-4">
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Lote *
              </label>
              <input
                v-model="formLocal.lote"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                type="text"
                @input="applyUppercaseInput($event, (value) => (formLocal.lote = value))"
              />
            </div>

            <div class="col-span-12 md:col-span-8">
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Nome *
              </label>
              <input
                v-model="formLocal.nome"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                type="text"
                @input="applyUppercaseInput($event, (value) => (formLocal.nome = value))"
              />
            </div>

            <div class="col-span-12 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Raça
                  </label>
                  <input
                    v-model="formLocal.raca"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="text"
                    @input="applyUppercaseInput($event, (value) => (formLocal.raca = value))"
                  />
                </div>

                <div class="md:order-3">
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Sexo
                  </label>
                  <input
                    v-model="formLocal.sexo"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="text"
                    @input="applyUppercaseInput($event, (value) => (formLocal.sexo = value))"
                  />
                </div>

                <div class="md:order-2">
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Pelagem
                  </label>
                  <input
                    v-model="formLocal.pelagem"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="text"
                  @input="applyUppercaseInput($event, (value) => (formLocal.pelagem = value))"
                />
              </div>
            </div>

            <div class="col-span-12 grid grid-cols-1 gap-5 md:grid-cols-3">
                <div>
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Nascimento
                  </label>
                  <input
                    v-model="formLocal.nascimento"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="text"
                    @input="applyUppercaseInput($event, (value) => (formLocal.nascimento = value))"
                  />
                </div>

                <div class="md:order-3">
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Peso
                  </label>
                  <input
                    v-model="formLocal.peso"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="text"
                    @input="applyUppercaseInput($event, (value) => (formLocal.peso = value))"
                  />
                </div>

                <div class="md:order-2">
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Altura
                  </label>
                  <input
                    v-model="formLocal.altura"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    type="text"
                  @input="applyUppercaseInput($event, (value) => (formLocal.altura = value))"
                />
              </div>
            </div>

            <div class="col-span-12">
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Genealogia
              </label>
              <input
                v-model="formLocal.genealogia"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                type="text"
                @input="applyUppercaseInput($event, (value) => (formLocal.genealogia = value))"
              />
            </div>

            <div v-if="formLocal.categoria === 'COBERTURAS'" class="col-span-12">
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Condições
              </label>

              <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div class="flex gap-2">
                  <input
                    v-model="novaCondicao"
                    class="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    type="text"
                    @input="applyUppercaseInput($event, (value) => (novaCondicao = value))"
                    @keydown.enter.prevent="adicionarCondicao"
                  />
                  <BaseButton variante="primario" @click="adicionarCondicao">Adicionar</BaseButton>
                </div>

                <div v-if="formLocal.condicoes_cobertura.length > 0" class="mt-3 flex flex-wrap gap-2">
                  <button
                    v-for="(condicao, index) in formLocal.condicoes_cobertura"
                    :key="`${condicao}-${index}`"
                    type="button"
                    class="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-800"
                    @click="removerCondicao(index)"
                  >
                    <span>{{ condicao }}</span>
                    <i class="fas fa-times text-xs" />
                  </button>
                </div>
              </div>
            </div>

            <div class="col-span-12">
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Vendedor
              </label>
              <input
                v-model="formLocal.vendedor"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                type="text"
                @input="applyUppercaseInput($event, (value) => (formLocal.vendedor = value))"
              />
            </div>

            <div class="col-span-12">
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Condições Específicas
              </label>
              <input
                v-model="formLocal.condicoes_pagamento_especificas"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                type="text"
                @input="
                  applyUppercaseInput($event, (value) => (formLocal.condicoes_pagamento_especificas = value))
                "
              />
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <BaseButton :disabled="salvando" @click="fecharJanela">Cancelar</BaseButton>
        <BaseButton variante="primario" :disabled="carregando || salvando" @click="salvar">
          {{ salvando ? 'Salvando...' : 'Salvar Alterações' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studbook-expand-enter-active,
.studbook-expand-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease,
    filter 220ms ease;
}

.studbook-expand-enter-from,
.studbook-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  filter: blur(6px);
}
</style>
