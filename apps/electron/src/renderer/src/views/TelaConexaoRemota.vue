<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { obterModoConfig, salvarModoConfig } from '@renderer/services/config.service'

const router = useRouter()
const route = useRoute()
const ipHost = ref('')
const erro = ref('')

async function continuar() {
  const ip = ipHost.value.trim()

  if (!ip) {
    erro.value = 'Informe o IP do HOST para continuar.'
    return
  }

  await salvarModoConfig({
    modo: 'REMOTO',
    hostIp: ip,
    portaApp: 18452
  })

  router.replace('/inicio')
}

onMounted(async () => {
  const config = await obterModoConfig()
  ipHost.value = config.hostIp

  if (route.query.erro === 'nao-foi-possivel-conectar-ao-host') {
    erro.value = 'Não foi possível conectar ao host. Verifique o IP e se o host está aberto.'
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-300 p-4">
    <div class="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-lg">
      <div class="p-8">
        <div class="text-center">
          <h1 class="text-3xl font-bold tracking-tight text-slate-900">Conectar ao Host</h1>
          <p class="mt-2 text-slate-600">
            Informe o IP da máquina principal. Esse IP será usado para APP, vMix e SRT.
          </p>
        </div>

        <div class="mt-8">
          <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            IP do Host
          </label>
          <input
            v-model="ipHost"
            class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            type="text"
            placeholder="Ex.: 172.30.38.22"
            @keydown.enter.prevent="continuar"
          />
        </div>

        <div v-if="erro" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ erro }}
        </div>
      </div>

      <div class="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-8 py-5">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          @click="continuar"
        >
          Continuar
          <i class="fas fa-arrow-right text-xs" />
        </button>
      </div>
    </div>
  </div>
</template>
