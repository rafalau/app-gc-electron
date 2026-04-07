<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseButton from '../ui/BaseButton.vue'
import { CATEGORIAS_ANIMAL, type AnimalCriarPayload } from '@renderer/types/animal'
import type {
  LayoutInformacoesAnimais,
  ModalAnimalModo
} from '@renderer/composables/useAnimais'
import type { StudbookSearchResult } from '@renderer/types/importacao'
import { buscarStudbook, importarAnimalStudbook } from '@renderer/services/importacao.service'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'
import {
  buildInformacoesAgregadas,
  parseInformacoesAgregadas
} from '@renderer/utils/animalInformacoes'

const props = defineProps<{
  aberto: boolean
  modo: ModalAnimalModo
  layoutModo: LayoutInformacoesAnimais
  form: AnimalCriarPayload
  erro: string
}>()

const emit = defineEmits<{
  (e: 'fechar'): void
  (e: 'salvar', payload: AnimalCriarPayload): void
}>()

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

function sincronizarForm() {
  formLocal.leilao_id = props.form.leilao_id
  formLocal.lote = props.form.lote
  formLocal.nome = props.form.nome
  formLocal.categoria = props.form.categoria
  formLocal.vendedor = props.form.vendedor
  formLocal.condicoes_pagamento_especificas = props.form.condicoes_pagamento_especificas
  formLocal.raca = props.form.raca
  formLocal.sexo = props.form.sexo
  formLocal.pelagem = props.form.pelagem
  formLocal.nascimento = props.form.nascimento
  formLocal.altura = props.form.altura
  formLocal.informacoes = props.form.informacoes
  formLocal.genealogia = props.form.genealogia
  formLocal.condicoes_cobertura = [...props.form.condicoes_cobertura]

  if (
    props.layoutModo === 'SEPARADAS' &&
    !formLocal.raca &&
    !formLocal.sexo &&
    !formLocal.pelagem &&
    !formLocal.nascimento &&
    !formLocal.altura
  ) {
    const parsed = parseInformacoesAgregadas(props.form.informacoes)
    formLocal.raca = parsed.raca
    formLocal.sexo = parsed.sexo
    formLocal.pelagem = parsed.pelagem
    formLocal.nascimento = parsed.nascimento
    formLocal.altura = parsed.altura
  }

  novaCondicao.value = ''
  studbookTerm.value = ''
  studbookResults.value = []
  studbookErro.value = ''
  studbookAberto.value = false
}

watch(
  () => props.form,
  () => sincronizarForm(),
  { deep: true, immediate: true }
)

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) sincronizarForm()
  }
)

function salvar() {
  const informacoes =
    props.layoutModo === 'SEPARADAS'
      ? buildInformacoesAgregadas({
          raca: formLocal.raca,
          sexo: formLocal.sexo,
          pelagem: formLocal.pelagem,
          nascimento: formLocal.nascimento,
          altura: formLocal.altura
        })
      : formLocal.informacoes

  emit('salvar', {
    ...formLocal,
    informacoes,
    condicoes_cobertura: [...formLocal.condicoes_cobertura]
  })
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
  } catch (error) {
    studbookErro.value = (error as Error).message
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
    if (props.layoutModo === 'SEPARADAS') {
      const parsed = parseInformacoesAgregadas(payload.informacoes)
      formLocal.raca = parsed.raca
      formLocal.sexo = parsed.sexo
      formLocal.pelagem = parsed.pelagem
      formLocal.nascimento = parsed.nascimento
      formLocal.altura = parsed.altura
    }
    studbookAberto.value = false
  } catch (error) {
    studbookErro.value = (error as Error).message
  } finally {
    studbookImportandoRegistro.value = ''
  }
}
</script>

<template>
  <BaseModal
    :aberto="aberto"
    :titulo="modo === 'CRIAR' ? 'Novo Animal' : 'Editar Animal'"
    @fechar="emit('fechar')"
  >
    <div
      v-if="erro"
      class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
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
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
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
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
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
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Nome *
        </label>
        <input
          v-model="formLocal.nome"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          type="text"
          @input="applyUppercaseInput($event, (value) => (formLocal.nome = value))"
        />
      </div>

      <div v-if="layoutModo === 'AGREGADAS'" class="col-span-12">
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Informações
        </label>
        <input
          v-model="formLocal.informacoes"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          type="text"
          @input="applyUppercaseInput($event, (value) => (formLocal.informacoes = value))"
        />
      </div>

      <template v-else>
        <div class="col-span-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
              Raça
            </label>
            <input
              v-model="formLocal.raca"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="text"
              @input="applyUppercaseInput($event, (value) => (formLocal.raca = value))"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
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
            <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
              Sexo
            </label>
            <input
              v-model="formLocal.sexo"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="text"
              @input="applyUppercaseInput($event, (value) => (formLocal.sexo = value))"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
              Nascimento
            </label>
            <input
              v-model="formLocal.nascimento"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="text"
              @input="applyUppercaseInput($event, (value) => (formLocal.nascimento = value))"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
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
      </template>

      <div class="col-span-12">
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
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
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
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
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
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
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
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

    <template #footer>
      <BaseButton @click="emit('fechar')"> Cancelar </BaseButton>
      <BaseButton variante="primario" @click="salvar">
        {{ modo === 'CRIAR' ? 'Criar Animal' : 'Salvar Alterações' }}
      </BaseButton>
    </template>
  </BaseModal>
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




