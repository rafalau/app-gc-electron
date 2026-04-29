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
import { useTheme } from '@renderer/composables/useTheme'
import type { Leilao } from '@renderer/types/leilao'
import type { GcApiConfig, GcApiSyncSummary } from '@renderer/types/config'
import {
  obterConfiguracaoGcApi,
  obterModoConfig,
  salvarModoConfig,
  salvarConfiguracaoGcApi,
  testarConfiguracaoGcApi
} from '@renderer/services/config.service'
import { sincronizarGcApi } from '@renderer/services/gcSync.service'
import { obterConexaoOperacao } from '@renderer/services/operacao.service'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'

const router = useRouter()
const { tema, alternarTema } = useTheme()
const conexaoOperacao = ref<Awaited<ReturnType<typeof obterConexaoOperacao>> | null>(null)
const copiandoIp = ref(false)
const salvandoIpHost = ref(false)
const ipHostSelecionado = ref('')
const modoAtual = ref<'HOST' | 'REMOTO' | null>(null)
const gcApiSyncHabilitado = computed(() => Boolean(gcApiConfig.value.accessToken.trim()))
const ipHostPrincipal = computed(() => {
  if (!conexaoOperacao.value || conexaoOperacao.value.modo !== 'HOST') return ''
  return conexaoOperacao.value.hostIp
})
const ipsHostDisponiveis = computed(() => {
  if (!conexaoOperacao.value || conexaoOperacao.value.modo !== 'HOST') return []
  return Array.from(
    new Set([conexaoOperacao.value.hostIp, ...conexaoOperacao.value.ipsDisponiveis].filter(Boolean))
  )
})
const ipHostExibido = computed(() => ipHostSelecionado.value || ipHostPrincipal.value)

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
  if (!ipHostExibido.value) return
  await navigator.clipboard.writeText(ipHostExibido.value)
  copiandoIp.value = true
  window.setTimeout(() => {
    copiandoIp.value = false
  }, 1200)
}

async function definirIpHostPrincipal() {
  if (!ipHostSelecionado.value || ipHostSelecionado.value === ipHostPrincipal.value) return

  salvandoIpHost.value = true
  try {
    await salvarModoConfig({
      modo: 'HOST',
      hostIp: ipHostSelecionado.value,
      portaApp: conexaoOperacao.value?.porta ?? 18452
    })
    conexaoOperacao.value = await obterConexaoOperacao()
    ipHostSelecionado.value = conexaoOperacao.value.hostIp
  } finally {
    salvandoIpHost.value = false
  }
}

onMounted(async () => {
  const modoConfig = await obterModoConfig()
  modoAtual.value = modoConfig.modo
  conexaoOperacao.value = await obterConexaoOperacao()
  ipHostSelecionado.value = conexaoOperacao.value.hostIp
  gcApiConfig.value = await obterConfiguracaoGcApi()
})
</script>

<template>
  <div class="min-h-screen bg-blue-50 p-4 transition-colors dark:bg-slate-950 md:p-6 lg:p-8">
    <div
      v-if="conexaoOperacao?.modo === 'HOST' && ipHostPrincipal"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div class="flex flex-wrap items-center gap-2">
        <label
          class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
          for="ip-host-selecionado"
        >
          IP do Host
        </label>
        <select
          id="ip-host-selecionado"
          v-model="ipHostSelecionado"
          class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option v-for="ip in ipsHostDisponiveis" :key="ip" :value="ip">
            {{ ip }}
          </option>
        </select>
        <button
          v-if="ipHostSelecionado && ipHostSelecionado !== ipHostPrincipal"
          type="button"
          class="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
          :disabled="salvandoIpHost"
          @click="definirIpHostPrincipal"
        >
          {{ salvandoIpHost ? 'Salvando...' : 'Usar como principal' }}
        </button>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:bg-slate-700 dark:hover:text-blue-200"
        @click="copiarIpHost"
      >
        <i class="fas fa-copy text-xs" />
        {{ copiandoIp ? 'Copiado' : 'Copiar IP' }}
      </button>
    </div>

    <div
      v-else-if="conexaoOperacao?.modo === 'REMOTO'"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
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

    <!-- Cabeçalho com filtros e ações -->
    <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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

      <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <BaseButton variante="secundario" class="w-full md:w-auto" @click="alternarTema">
          <i :class="['fas mr-1', tema === 'dark' ? 'fa-sun' : 'fa-moon']" />
          {{ tema === 'dark' ? 'Modo claro' : 'Modo dark' }}
        </BaseButton>

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

    <!-- Busca -->
    <div class="relative mb-3 w-full">
      <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        v-model="busca"
        class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        type="text"
        @input="applyUppercaseInput($event, (value) => (busca = value))"
      />
    </div>

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
