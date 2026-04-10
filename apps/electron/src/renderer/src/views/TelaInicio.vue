<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LeilaoTabela from '@renderer/components/leilao/LeilaoTabela.vue'
import LeilaoModal from '@renderer/components/leilao/LeilaoModal.vue'
import BaseModal from '@renderer/components/ui/BaseModal.vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import BaseDropdown from '@renderer/components/ui/BaseDropdown.vue'
import BaseToast from '@renderer/components/ui/BaseToast.vue'
import { useLeiloes } from '@renderer/composables/useLeiloes'
import type { Leilao } from '@renderer/types/leilao'
import type { GcApiConfig, GcApiSyncSummary } from '@renderer/types/config'
import {
  obterConfiguracaoGcApi,
  obterModoConfig,
  salvarConfiguracaoGcApi,
  testarConfiguracaoGcApi
} from '@renderer/services/config.service'
import { sincronizarGcApi } from '@renderer/services/gcSync.service'
import { obterConexaoOperacao } from '@renderer/services/operacao.service'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'

const router = useRouter()
const conexaoOperacao = ref<Awaited<ReturnType<typeof obterConexaoOperacao>> | null>(null)
const copiandoIp = ref(false)
const modoAtual = ref<'HOST' | 'REMOTO' | null>(null)
const gcApiSyncHabilitado = computed(() => Boolean(gcApiConfig.value.accessToken.trim()))
const ipHostPrincipal = computed(() => {
  if (!conexaoOperacao.value || conexaoOperacao.value.modo !== 'HOST') return ''
  return conexaoOperacao.value.hostIp
})

const {
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
  excluir,
  carregar
} = useLeiloes()

const gcApiModalAberto = ref(false)
const gcApiErro = ref('')
const gcApiSucesso = ref('')
const gcApiTestando = ref(false)
const gcApiSalvando = ref(false)
const gcApiSincronizando = ref(false)
const toastRef = ref<InstanceType<typeof BaseToast> | null>(null)
const gcApiConfig = ref<GcApiConfig>({
  baseUrl: 'https://api-app-gc.remate360.com.br',
  accessToken: '',
  deviceName: 'gc-desktop',
  lastPulledAt: null
})

function irAnimais(leilao: Leilao) {
  router.push(`/leilao/${leilao.id}`)
}

function irOperacao(leilao: Leilao) {
  router.push(`/operacao/${leilao.id}`)
}

async function voltarSelecaoModo() {
  if (modoAtual.value === 'REMOTO') {
    router.replace('/conexao')
  }
}

function desconectarRemoto() {
  router.replace('/conexao')
}

function abrirConfiguracaoGcApi() {
  gcApiErro.value = ''
  gcApiSucesso.value = ''
  gcApiModalAberto.value = true
}

function abrirEdicaoLeilao(leilao: Leilao) {
  if (modoAtual.value === 'REMOTO') {
    void window.janela.abrirEditorLeilaoRemoto(leilao.id)
    return
  }

  abrirEditar(leilao)
}

function fecharConfiguracaoGcApi() {
  gcApiModalAberto.value = false
}

function showToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  duration = 4000
) {
  toastRef.value?.addToast(message, type, duration)
}

function pluralizar(valor: number, singular: string, plural = `${singular}s`) {
  return `${valor} ${valor === 1 ? singular : plural}`
}

function formatarResumoSync(resumo: GcApiSyncSummary) {
  const destaques = [
    resumo.updated > 0 ? pluralizar(resumo.updated, 'atualização') : null,
    resumo.created > 0 ? pluralizar(resumo.created, 'cadastro') : null,
    resumo.deleted > 0 ? pluralizar(resumo.deleted, 'exclusão') : null
  ].filter(Boolean)

  const fluxo = [
    resumo.pushed > 0 ? `${pluralizar(resumo.pushed, 'envio')} ao servidor` : null,
    resumo.pulled > 0 ? `${pluralizar(resumo.pulled, 'retorno')} do servidor` : null
  ].filter(Boolean)

  const ignorados = resumo.skipped > 0 ? `${pluralizar(resumo.skipped, 'registro')} ignorado${resumo.skipped === 1 ? '' : 's'}` : null

  const partes = [
    destaques.length > 0 ? `Sincronização concluída com ${destaques.join(', ')}` : 'Sincronização concluída sem alterações',
    fluxo.length > 0 ? fluxo.join(' e ') : null,
    ignorados
  ].filter(Boolean)

  return `${partes.join('. ')}.`
}

async function salvarGcApi() {
  gcApiErro.value = ''
  gcApiSucesso.value = ''

  if (!gcApiConfig.value.baseUrl.trim()) {
    gcApiErro.value = 'Informe a URL da GC API.'
    return
  }

  if (!gcApiConfig.value.accessToken.trim()) {
    gcApiErro.value = 'Informe o token da GC API.'
    return
  }

  gcApiSalvando.value = true

  try {
    await salvarConfiguracaoGcApi(gcApiConfig.value)
    gcApiSucesso.value = 'Configuração salva.'
    showToast('Configuração de sync salva.', 'success', 3000)
  } catch (error) {
    gcApiErro.value = (error as Error).message
    showToast(gcApiErro.value, 'error', 6500)
  } finally {
    gcApiSalvando.value = false
  }
}

async function testarGcApi() {
  gcApiErro.value = ''
  gcApiSucesso.value = ''
  gcApiTestando.value = true

  try {
    const resultado = await testarConfiguracaoGcApi(gcApiConfig.value)
    gcApiSucesso.value = resultado.user
      ? `Conectado como ${resultado.user.name} (${resultado.user.email}).`
      : 'Conexão validada.'
    showToast(gcApiSucesso.value, 'success', 3500)
  } catch (error) {
    gcApiErro.value = (error as Error).message
    showToast(gcApiErro.value, 'error', 6500)
  } finally {
    gcApiTestando.value = false
  }
}

async function sincronizarComGcApi() {
  gcApiErro.value = ''
  gcApiSucesso.value = ''

  if (!gcApiConfig.value.baseUrl.trim() || !gcApiConfig.value.accessToken.trim()) {
    gcApiErro.value = 'Configure a GC API antes de sincronizar.'
    gcApiModalAberto.value = true
    showToast(gcApiErro.value, 'warning', 5000)
    return
  }

  gcApiSincronizando.value = true

  try {
    const resumo = await sincronizarGcApi()
    gcApiConfig.value = await obterConfiguracaoGcApi()
    await carregar()
    showToast(formatarResumoSync(resumo), 'success', 5500)
  } catch (error) {
    gcApiErro.value = (error as Error).message
    showToast(gcApiErro.value, 'error', 7000)
  } finally {
    gcApiSincronizando.value = false
  }
}

async function copiarIpHost() {
  if (!ipHostPrincipal.value) return
  await navigator.clipboard.writeText(ipHostPrincipal.value)
  copiandoIp.value = true
  window.setTimeout(() => {
    copiandoIp.value = false
  }, 1200)
}

onMounted(async () => {
  const modoConfig = await obterModoConfig()
  modoAtual.value = modoConfig.modo
  conexaoOperacao.value = await obterConexaoOperacao()
  gcApiConfig.value = await obterConfiguracaoGcApi()
})
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 min-h-screen bg-blue-50">
    <div v-if="modoAtual === 'REMOTO'" class="mb-4">
      <button
        class="text-sm text-blue-700 hover:text-blue-900 font-medium"
        type="button"
        @click="voltarSelecaoModo"
      >
        ← Alterar IP do host
      </button>
    </div>

    <div
      v-if="conexaoOperacao?.modo === 'HOST' && ipHostPrincipal"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-sm"
    >
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">IP do Host</div>
        <div class="mt-1 text-lg font-bold text-slate-900">{{ ipHostPrincipal }}</div>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        @click="copiarIpHost"
      >
        <i class="fas fa-copy text-xs" />
        {{ copiandoIp ? 'Copiado' : 'Copiar IP' }}
      </button>
    </div>

    <div
      v-else-if="conexaoOperacao?.modo === 'REMOTO'"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Host conectado</div>
        <div class="mt-1 text-base font-semibold text-slate-900">{{ conexaoOperacao.hostIp }}</div>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
        @click="desconectarRemoto"
      >
        <i class="fas fa-plug-circle-xmark text-xs" />
        Desconectar
      </button>
    </div>

    <!-- Cabeçalho com Busca e Botão -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
      <div class="flex-1 w-full md:max-w-md relative">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="busca"
          class="w-full border bg-white border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          type="text"
          @input="applyUppercaseInput($event, (value) => (busca = value))"
        />
      </div>

      <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row">
        <BaseDropdown
          v-if="modoAtual !== 'REMOTO'"
          label="Sincronização"
          variante="sucesso"
          :items="[
            {
              label: 'Config. Sinc.',
              icon: 'fa-plug',
              action: abrirConfiguracaoGcApi
            },
            {
              label: gcApiSincronizando ? 'Sincronizando...' : 'Sinc. Servidor',
              icon: gcApiSincronizando ? 'fa-spinner fa-spin' : 'fa-rotate-right',
              disabled: !gcApiSyncHabilitado || gcApiSincronizando,
              action: sincronizarComGcApi
            }
          ]"
        />

        <BaseButton variante="primario" class="w-full md:w-auto" @click="abrirCriar">
          <i class="fas fa-plus mr-1" />
          Novo Evento
        </BaseButton>
      </div>
    </div>

    <!-- Espaço entre busca e abas -->
    <div class="mb-3" />

    <!-- Abas -->
    <div class="flex gap-2 mb-3">
      <BaseButton :variante="aba === 'ATIVOS' ? 'primario' : 'secundario'" @click="aba = 'ATIVOS'">
        <i class="fas fa-check mr-1" />
        Ativos
      </BaseButton>

      <BaseButton
        :variante="aba === 'ARQUIVADOS' ? 'primario' : 'secundario'"
        @click="aba = 'ARQUIVADOS'"
      >
        <i class="fas fa-archive mr-1" />
        Arquivados
      </BaseButton>
    </div>

    <!-- Espaço entre abas e tabela -->
    <div class="mb-3" />

    <!-- Tabela -->
    <LeilaoTabela
      :leiloes="leiloesFiltrados"
      @editar="abrirEdicaoLeilao"
      @excluir="excluir"
      @animais="irAnimais"
      @operacao="irOperacao"
    />

    <!-- Modal -->
    <LeilaoModal
      :aberto="modalAberto"
      :modo="modalModo"
      :form="form"
      :erro="erroModal"
      @fechar="fecharModal"
      @salvar="salvarModal"
    />

    <BaseModal :aberto="gcApiModalAberto" titulo="Configuração da GC API" @fechar="fecharConfiguracaoGcApi">
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            URL Base
          </label>
          <input
            v-model="gcApiConfig.baseUrl"
            type="text"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="https://api-app-gc.remate360.com.br"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Token
          </label>
          <textarea
            v-model="gcApiConfig.accessToken"
            class="min-h-[110px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Cole aqui o token Bearer da GC API"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Dispositivo
          </label>
          <input
            v-model="gcApiConfig.deviceName"
            type="text"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="gc-desktop"
          />
        </div>

        <div
          v-if="gcApiSucesso"
          class="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          {{ gcApiSucesso }}
        </div>

        <div
          v-if="gcApiErro"
          class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ gcApiErro }}
        </div>

        <div v-if="gcApiConfig.lastPulledAt" class="text-xs text-slate-500">
          Último pull: {{ gcApiConfig.lastPulledAt }}
        </div>
      </div>

      <template #footer>
        <BaseButton variante="secundario" @click="fecharConfiguracaoGcApi">Fechar</BaseButton>
        <BaseButton variante="secundario" :disabled="gcApiTestando" @click="testarGcApi">
          <i :class="['fas mr-1', gcApiTestando ? 'fa-spinner fa-spin' : 'fa-flask']" />
          {{ gcApiTestando ? 'Testando...' : 'Testar' }}
        </BaseButton>
        <BaseButton variante="primario" :disabled="gcApiSalvando" @click="salvarGcApi">
          <i :class="['fas mr-1', gcApiSalvando ? 'fa-spinner fa-spin' : 'fa-save']" />
          {{ gcApiSalvando ? 'Salvando...' : 'Salvar' }}
        </BaseButton>
      </template>
    </BaseModal>

    <BaseToast ref="toastRef" />
  </div>
</template>
