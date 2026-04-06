<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { obterModoConfig, salvarModoConfig } from '@renderer/services/config.service'

type Modo = 'HOST' | 'REMOTO'

const router = useRouter()
const modo = ref<Modo | null>(null)
const ipHost = ref('127.0.0.1')
const ipRemoto = ref('')
const erro = ref('')

const selecionar = (m: Modo) => {
  modo.value = m
  erro.value = ''
}

const continuar = async () => {
  if (!modo.value) return

  if (modo.value === 'REMOTO' && !ipRemoto.value.trim()) {
    erro.value = 'Informe o IP do HOST para continuar.'
    return
  }

  await salvarModoConfig({
    modo: modo.value,
    hostIp: modo.value === 'HOST' ? ipHost.value.trim() || '127.0.0.1' : ipRemoto.value.trim(),
    portaApp: 18452
  })

  router.replace('/inicio')
}

onMounted(async () => {
  const config = await obterModoConfig()
  modo.value = config.modo
  ipHost.value = config.modo === 'HOST' ? config.hostIp || '127.0.0.1' : '127.0.0.1'
  ipRemoto.value = config.modo === 'REMOTO' ? config.hostIp : ''
})
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-b from-slate-100 to-slate-300 flex items-center justify-center p-4"
  >
    <div class="w-full max-w-5xl mx-auto">
      <div class="mx-auto w-full max-w-5xl">
        <div class="text-center">
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">
            Configurar Modo de Operação
          </h1>
          <p class="mt-2 text-slate-600">Escolha como este computador vai operar na sua rede</p>
          <br />
        </div>

        <div class="bg-white rounded-3xl shadow-lg border border-slate-200 mt-8 overflow-hidden">
          <div class="p-6 sm:p-8 md:p-10">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- HOST -->
              <button
                type="button"
                :class="[
                  'group relative rounded-2xl border-2 p-6 md:p-7 text-left transition-all duration-300 cursor-pointer',
                  modo === 'HOST'
                    ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-blue-50/50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                ]"
                @click="selecionar('HOST')"
              >
                <div v-if="modo === 'HOST'" class="absolute top-4 right-4">
                  <div class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600">
                    <i class="fas fa-check text-white text-xs"></i>
                  </div>
                </div>

                <div class="mb-4">
                  <div
                    class="inline-flex items-center justify-center w-12 h-12 rounded-xl"
                    :class="
                      modo === 'HOST' ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-slate-200'
                    "
                  >
                    <i
                      class="fas fa-server text-xl"
                      :class="modo === 'HOST' ? 'text-blue-600' : 'text-slate-600'"
                    ></i>
                  </div>
                </div>

                <h3 class="text-lg font-semibold text-slate-900">HOST</h3>

                <p class="mt-2 text-sm text-slate-600 leading-relaxed">
                  Este PC será o servidor central e manterá o banco de dados local
                </p>

                <ul class="mt-4 space-y-2">
                  <li class="flex items-start gap-2 text-xs text-slate-600">
                    <i
                      class="fas fa-check-circle mt-0.5 flex-shrink-0"
                      :class="modo === 'HOST' ? 'text-blue-600' : 'text-slate-400'"
                    ></i>
                    <span>Gerencia dados centralizados</span>
                  </li>

                  <li class="flex items-start gap-2 text-xs text-slate-600">
                    <i
                      class="fas fa-check-circle mt-0.5 flex-shrink-0"
                      :class="modo === 'HOST' ? 'text-blue-600' : 'text-slate-400'"
                    ></i>
                    <span>Maior controle e segurança</span>
                  </li>
                </ul>
              </button>

              <!-- REMOTO -->
              <button
                type="button"
                :class="[
                  'group relative rounded-2xl border-2 p-6 md:p-7 text-left transition-all duration-300 cursor-pointer',
                  modo === 'REMOTO'
                    ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-blue-50/50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                ]"
                @click="selecionar('REMOTO')"
              >
                <div v-if="modo === 'REMOTO'" class="absolute top-4 right-4">
                  <div class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600">
                    <i class="fas fa-check text-white text-xs"></i>
                  </div>
                </div>

                <div class="mb-4">
                  <div
                    class="inline-flex items-center justify-center w-12 h-12 rounded-xl"
                    :class="
                      modo === 'REMOTO' ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-slate-200'
                    "
                  >
                    <i
                      class="fas fa-desktop text-xl"
                      :class="modo === 'REMOTO' ? 'text-blue-600' : 'text-slate-600'"
                    ></i>
                  </div>
                </div>

                <h3 class="text-lg font-semibold text-slate-900">REMOTO</h3>

                <p class="mt-2 text-sm text-slate-600 leading-relaxed">
                  Este PC conectará em um HOST via LAN ou ZeroTier
                </p>

                <ul class="mt-4 space-y-2">
                  <li class="flex items-start gap-2 text-xs text-slate-600">
                    <i
                      class="fas fa-check-circle mt-0.5 flex-shrink-0"
                      :class="modo === 'REMOTO' ? 'text-blue-600' : 'text-slate-400'"
                    ></i>
                    <span>Acesso remoto flexível</span>
                  </li>

                  <li class="flex items-start gap-2 text-xs text-slate-600">
                    <i
                      class="fas fa-check-circle mt-0.5 flex-shrink-0"
                      :class="modo === 'REMOTO' ? 'text-blue-600' : 'text-slate-400'"
                    ></i>
                    <span>Sincronização automática</span>
                  </li>
                </ul>
              </button>
            </div>

            <div v-if="modo === 'HOST'" class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                IP do Host
              </label>
              <input
                v-model="ipHost"
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="text"
                placeholder="Ex.: 192.168.0.10"
              />
              <div class="mt-2 text-xs text-slate-500">
                Esse IP será usado no endereço fixo do JSON e nas conexões do host.
              </div>
            </div>

            <div v-if="modo === 'REMOTO'" class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                IP do Host
              </label>
              <input
                v-model="ipRemoto"
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                type="text"
                placeholder="Ex.: 172.30.38.22"
              />
              <div class="mt-2 text-xs text-slate-500">
                Esse IP será usado para conectar no APP host, no vMix e no SRT.
              </div>
            </div>

            <div v-if="erro" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ erro }}
            </div>
          </div>

          <div
            class="border-t border-slate-200 bg-slate-50/50 px-6 sm:px-8 md:px-10 py-6 flex justify-between items-center"
          >
            <p class="text-sm text-slate-600">
              <span v-if="!modo" class="text-slate-500"> Selecione um modo para continuar </span>

              <span v-else class="text-blue-600 font-medium">
                Modo <strong>{{ modo }}</strong> selecionado
              </span>
            </p>

            <button
              type="button"
              :disabled="!modo"
              :class="[
                'px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2',
                modo
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              ]"
              @click="continuar"
            >
              Continuar
              <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button {
  -webkit-tap-highlight-color: transparent;
}
</style>
