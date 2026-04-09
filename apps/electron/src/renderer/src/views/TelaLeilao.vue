<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import BaseDropdown from '@renderer/components/ui/BaseDropdown.vue'
import BaseModal from '@renderer/components/ui/BaseModal.vue'
import AnimalTabela from '@renderer/components/animal/AnimalTabela.vue'
import AnimalModal from '@renderer/components/animal/AnimalModal.vue'
import ApiImportModal from '@renderer/components/animal/ApiImportModal.vue'
import ImportSummaryModal from '@renderer/components/animal/ImportSummaryModal.vue'
import { useAnimais } from '@renderer/composables/useAnimais'
import {
  obterApiImportProviders,
  obterModoConfig,
  salvarApiImportProviders
} from '@renderer/services/config.service'
import type { Animal } from '@renderer/types/animal'
import type { ApiImportProviderConfig } from '@renderer/types/importacao'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'

type DropdownItem = {
  label: string
  icon?: string
  color?: 'default' | 'danger'
  action: () => void
}

const router = useRouter()
const route = useRoute()
const leilaoId = route.params.id as string

const {
  carregando,
  leilao,
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
  carregarProvidersApi,
  salvarConfiguracaoLayout,
  salvarModal,
  excluir,
  limparTodos
} = useAnimais(leilaoId)

const tituloPagina = computed(() => leilao.value?.titulo_evento || 'Leilão')
const limparAberto = ref(false)
const configuracoesAbertas = ref(false)
const confirmacaoLimpar = ref('')
const layoutModoDraft = ref<'AGREGADAS' | 'SEPARADAS'>('AGREGADAS')
const incluirRacaDraft = ref(false)
const modoAtual = ref<'HOST' | 'REMOTO' | null>(null)
const apiProvidersDraft = ref<ApiImportProviderConfig[]>([])
const importItems = computed(() => {
  const items: DropdownItem[] = []

  if (modoAtual.value !== 'REMOTO') {
    items.push({
      label: 'Importar Excel',
      icon: 'fa-file-excel',
      action: () => {
        void importarPlanilhaExcel()
      }
    })
  }

  if (apiImportHasConfiguredProviders.value) {
    items.push({
      label: 'Importar API',
      icon: 'fa-cloud-download-alt',
      action: () => {
        void abrirImportacaoApi()
      }
    })
  }

  return items
})
const gerenciarItems = computed(() => {
  const items: DropdownItem[] = [
    {
      label: 'Configurações',
      icon: 'fa-sliders-h',
      action: () => {
        abrirConfiguracoes()
      }
    },
    {
      label: 'Modo Conferência',
      icon: 'fa-clipboard-check',
      action: () => {
        void abrirModoConferencia()
      }
    }
  ]

  if (leilao.value && leilao.value.total_animais > 0) {
    items.push(
      {
        label: 'Limpar',
        icon: 'fa-trash-alt',
        color: 'danger' as const,
        action: () => {
          abrirLimpar()
        }
      }
    )
  }

  return items
})

function voltar() {
  router.push('/inicio')
}

function formatarDataBR(iso?: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function abrirLimpar() {
  confirmacaoLimpar.value = ''
  limparAberto.value = true
}

function fecharLimpar() {
  if (limpandoTudo.value) return
  confirmacaoLimpar.value = ''
  limparAberto.value = false
}

async function confirmarLimpar() {
  await limparTodos()
  fecharLimpar()
}

function abrirConfiguracoes() {
  if (modoAtual.value === 'REMOTO') {
    void window.janela.abrirConfiguracaoAnimaisRemoto(leilaoId)
    return
  }

  layoutModoDraft.value = layoutInformacoesModo.value
  incluirRacaDraft.value = incluirRacaNasImportacoes.value
  void (async () => {
    apiProvidersDraft.value = await obterApiImportProviders()
    configuracoesAbertas.value = true
  })()
}

function fecharConfiguracoes() {
  configuracoesAbertas.value = false
}

async function salvarConfiguracoes() {
  await salvarApiImportProviders(apiProvidersDraft.value)
  await salvarConfiguracaoLayout(layoutModoDraft.value, incluirRacaDraft.value)
  await carregarProvidersApi()
  configuracoesAbertas.value = false
}

function adicionarApiProvider() {
  apiProvidersDraft.value = [
    ...apiProvidersDraft.value,
    {
      id: `api-${Date.now()}`,
      nome: '',
      url: ''
    }
  ]
}

function atualizarApiProvider(index: number, campo: 'nome' | 'url', valor: string) {
  apiProvidersDraft.value = apiProvidersDraft.value.map((provider, providerIndex) =>
    providerIndex === index ? { ...provider, [campo]: valor } : provider
  )
}

function removerApiProvider(index: number) {
  apiProvidersDraft.value = apiProvidersDraft.value.filter((_, providerIndex) => providerIndex !== index)
}

function moverApiProvider(index: number, direction: 'up' | 'down') {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= apiProvidersDraft.value.length) return

  const next = [...apiProvidersDraft.value]
  const [item] = next.splice(index, 1)
  next.splice(targetIndex, 0, item)
  apiProvidersDraft.value = next
}

function abrirModoOperacao(animal?: Animal) {
  router.push({
    path: `/operacao/${leilaoId}`,
    query: animal ? { animalId: animal.id } : {}
  })
}

async function abrirModoConferencia(animal?: Animal) {
  await window.janela.abrirEdicaoRapida(leilaoId, animal?.id)
}

function abrirEdicaoAnimal(animal: Animal) {
  if (modoAtual.value === 'REMOTO') {
    void window.janela.abrirEditorAnimalRemoto(leilaoId, animal.id)
    return
  }

  abrirEditar(animal)
}

onMounted(async () => {
  const modoConfig = await obterModoConfig()
  modoAtual.value = modoConfig.modo
})
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 min-h-screen bg-blue-50">
    <div class="flex flex-col gap-4 mb-5">
      <div>
        <button
          class="text-sm text-blue-700 hover:text-blue-900 font-medium"
          type="button"
          @click="voltar"
        >
          ← Voltar para leilões
        </button>

        <h1 class="text-2xl font-bold text-gray-900 mt-2">{{ tituloPagina }}</h1>

        <div v-if="leilao" class="flex flex-wrap gap-2 mt-3">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full bg-white border border-blue-200 text-sm font-medium text-blue-800"
          >
            Data: {{ formatarDataBR(leilao.data) }}
          </span>
          <span
            class="inline-flex items-center px-3 py-1 rounded-full bg-white border border-green-200 text-sm font-medium text-green-700"
          >
            {{ leilao.total_animais }} animal(is)
          </span>
          <span
            class="inline-flex items-center px-3 py-1 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700"
          >
            Multiplicador: {{ leilao.multiplicador }}
          </span>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2 max-[640px]:flex-col max-[640px]:items-stretch">
        <button
          v-if="leilao && leilao.total_animais > 0"
          type="button"
          class="botao-ao-vivo inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-rose-300/70 transition hover:border-rose-200 hover:bg-rose-500 max-[640px]:w-full"
          @click="abrirModoOperacao()"
        >
          <span class="h-2 w-2 rounded-full bg-white/95" />
          Modo Operação
        </button>
        <div class="actions-dropdown max-[640px]:w-full">
          <BaseDropdown :items="importItems" label="Importar" />
        </div>
        <div class="actions-dropdown max-[640px]:w-full">
          <BaseDropdown :items="gerenciarItems" label="Gerenciar" />
        </div>
        <BaseButton variante="primario" class="w-full sm:w-auto" @click="abrirCriar">
          <i class="fas fa-plus mr-1" />
          Novo Animal
        </BaseButton>
      </div>

      <div class="w-full">
        <div class="relative w-full">
          <i
            class="fas fa-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
          />
          <input
            v-model="busca"
            class="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            type="text"
            placeholder="Buscar por lote, nome, raça, informações ou genealogia..."
            @input="applyUppercaseInput($event, (value) => (busca = value))"
          />
        </div>
      </div>
    </div>

    <div
      v-if="carregando"
      class="border rounded-2xl p-10 bg-white text-center text-gray-500 shadow-sm"
    >
      Carregando animais...
    </div>

    <div
      v-else-if="!leilao"
      class="border rounded-2xl p-10 bg-white text-center text-gray-500 shadow-sm"
    >
      Leilão não encontrado.
    </div>

    <AnimalTabela
      v-else
      :animais="animaisFiltrados"
      :layout-modo="layoutInformacoesModo"
      :excluindo-animal-id="excluindoAnimalId"
      @editar="abrirEdicaoAnimal"
      @excluir="excluir"
    />

    <AnimalModal
      :aberto="modalAberto"
      :modo="modalModo"
      :layout-modo="layoutInformacoesModo"
      :form="form"
      :erro="erroModal"
      @fechar="fecharModal"
      @salvar="salvarModal"
    />

    <ApiImportModal
      :aberto="apiImportAberto"
      :providers="apiImportProviders"
      :provider-id="apiImportSelectedProviderId"
      :leiloes="apiImportLeiloes"
      :loading="apiImportLoading"
      :importing="apiImportImportando"
      :selected-auction-id="apiImportSelectedAuctionId"
      :erro="apiImportErro"
      @fechar="fecharImportacaoApi"
      @select-provider="selecionarProviderApi"
      @select-auction="selecionarLeilaoApi"
      @importar="importarDaApi"
    />

    <ImportSummaryModal :aberto="resumoAberto" :resumo="resumoImportacao" @fechar="fecharResumo" />

    <BaseModal :aberto="configuracoesAbertas" titulo="Configurações dos Animais" @fechar="fecharConfiguracoes">
      <div class="space-y-5">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="text-sm font-semibold text-slate-900">Layout das informações</div>
          <div class="mt-1 text-xs text-slate-500">
            Escolha como a tabela e o formulário dos animais devem ser exibidos neste leilão.
          </div>

          <div class="mt-4 grid gap-3">
            <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40">
              <input v-model="layoutModoDraft" type="radio" value="AGREGADAS" class="mt-1 h-4 w-4" />
              <div>
                <div class="text-sm font-semibold text-slate-900">Informações agregadas</div>
                <div class="text-xs text-slate-500">
                  Mantém o bloco único de informações, como já funciona hoje.
                </div>
              </div>
            </label>

            <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40">
              <input v-model="layoutModoDraft" type="radio" value="SEPARADAS" class="mt-1 h-4 w-4" />
              <div>
                <div class="text-sm font-semibold text-slate-900">Informações separadas</div>
                <div class="text-xs text-slate-500">
                  Mostra raça, sexo, pelagem e nascimento em campos e colunas distintas.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div
          v-if="layoutModoDraft === 'AGREGADAS'"
          class="rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <label class="flex cursor-pointer items-start gap-3">
            <input v-model="incluirRacaDraft" type="checkbox" class="mt-1 h-4 w-4 rounded" />
            <div>
              <div class="text-sm font-semibold text-slate-900">Incluir raça nas importações</div>
              <div class="text-xs text-slate-500">
                Vale só para importação. Quando marcado, a raça entra no começo de
                <span class="font-semibold">Informações</span>.
              </div>
            </div>
          </label>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-semibold text-slate-900">APIs no padrão TBS</div>
              <div class="mt-1 text-[11px] leading-4 text-slate-500">
                Cadastre e ordene as APIs do menu <span class="font-semibold">Importar API</span>.
              </div>
            </div>

            <BaseButton variante="secundario" class="shrink-0" @click="adicionarApiProvider">
              <i class="fas fa-plus mr-1" />
              Nova API
            </BaseButton>
          </div>

          <div class="mt-4 space-y-3">
            <div
              v-for="(provider, index) in apiProvidersDraft"
              :key="provider.id"
              class="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                <div>
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Nome
                  </label>
                  <input
                    :value="provider.nome"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    @input="
                      atualizarApiProvider(
                        index,
                        'nome',
                        ($event.target as HTMLInputElement).value
                      )
                    "
                  />
                </div>

                <div>
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    URL
                  </label>
                  <input
                    :value="provider.url"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    @input="
                      atualizarApiProvider(
                        index,
                        'url',
                        ($event.target as HTMLInputElement).value
                      )
                    "
                  />
                </div>

                <div class="flex items-end gap-2">
                  <BaseButton
                    variante="secundario"
                    :disabled="index === 0"
                    @click="moverApiProvider(index, 'up')"
                  >
                    ↑
                  </BaseButton>
                  <BaseButton
                    variante="secundario"
                    :disabled="index === apiProvidersDraft.length - 1"
                    @click="moverApiProvider(index, 'down')"
                  >
                    ↓
                  </BaseButton>
                  <BaseButton variante="perigo" @click="removerApiProvider(index)">
                    Apagar
                  </BaseButton>
                </div>
              </div>
            </div>

            <div
              v-if="apiProvidersDraft.length === 0"
              class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500"
            >
              Nenhuma API cadastrada.
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <BaseButton variante="secundario" @click="fecharConfiguracoes">Cancelar</BaseButton>
        <BaseButton variante="primario" @click="salvarConfiguracoes">Salvar</BaseButton>
      </template>
    </BaseModal>

    <BaseModal :aberto="limparAberto" titulo="Limpar animais" @fechar="fecharLimpar">
      <div class="space-y-4">
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Isso vai apagar todos os animais deste leilão. Essa ação não pode ser desfeita.
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Digite <span class="text-red-600">LIMPAR</span> para confirmar
          </label>
          <input
            v-model="confirmacaoLimpar"
            type="text"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            @input="applyUppercaseInput($event, (value) => (confirmacaoLimpar = value))"
          />
        </div>
      </div>

      <template #footer>
        <BaseButton variante="secundario" @click="fecharLimpar">Cancelar</BaseButton>
        <BaseButton
          variante="perigo"
          :disabled="confirmacaoLimpar !== 'LIMPAR' || limpandoTudo"
          @click="confirmarLimpar"
        >
          {{ limpandoTudo ? 'Apagando...' : 'Apagar todos' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.botao-ao-vivo {
  animation: pulsar-ao-vivo 1.1s ease-in-out infinite;
}

@media (max-width: 640px) {
  .actions-dropdown :deep(> div) {
    display: block;
    width: 100%;
  }

  .actions-dropdown :deep(button) {
    display: flex;
    width: 100%;
    justify-content: center;
  }
}

@keyframes pulsar-ao-vivo {
  0%,
  100% {
    box-shadow:
      0 0 0 0 rgba(244, 63, 94, 0.52),
      0 10px 24px rgba(244, 63, 94, 0.28);
    filter: saturate(1);
  }

  50% {
    box-shadow:
      0 0 0 10px rgba(244, 63, 94, 0),
      0 14px 30px rgba(190, 24, 93, 0.42);
    filter: saturate(1.15);
  }
}
</style>
