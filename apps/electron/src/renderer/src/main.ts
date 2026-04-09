import './assets/main.css'
import '@fortawesome/fontawesome-free/css/all.css'

import { createApp } from 'vue'

function renderBootstrapError(error: unknown) {
  const target = document.getElementById('app')
  if (!target) return

  const message = error instanceof Error ? error.stack || error.message : String(error)
  target.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;color:#0f172a;font-family:system-ui,sans-serif">
      <div style="max-width:960px;width:100%;background:white;border:1px solid #fecaca;border-radius:24px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,0.08)">
        <div style="font-weight:800;font-size:20px;margin-bottom:12px;color:#991b1b">Falha ao carregar a janela</div>
        <pre style="white-space:pre-wrap;word-break:break-word;margin:0;color:#7f1d1d;font-size:13px;line-height:1.5">${message}</pre>
      </div>
    </div>
  `
}

async function bootstrap() {
  try {
    const searchParams = new URLSearchParams(window.location.search)
    const windowMode = searchParams.get('window')

    const app =
      windowMode === 'quick-edit'
        ? createApp((await import('./views/TelaEdicaoRapidaAnimais.vue')).default)
        : windowMode === 'operation-auction-editor'
          ? createApp((await import('./views/TelaOperacaoEditarLeilaoJanela.vue')).default)
        : windowMode === 'operation-animal-editor'
            ? createApp((await import('./views/TelaOperacaoEditarAnimalJanela.vue')).default)
            : windowMode === 'operation-vmix-editor'
              ? createApp((await import('./views/TelaOperacaoConfigurarVmixJanela.vue')).default)
              : windowMode === 'remote-auction-editor'
                ? createApp((await import('./views/TelaRemotoEditarLeilaoJanela.vue')).default)
                : windowMode === 'remote-animal-editor'
                  ? createApp((await import('./views/TelaOperacaoEditarAnimalJanela.vue')).default)
                  : windowMode === 'remote-animal-settings'
                    ? createApp((await import('./views/TelaRemotoConfiguracaoAnimaisJanela.vue')).default)
              : createApp((await import('./App.vue')).default)

    if (!windowMode) {
      const { router } = await import('./router')
      app.use(router)
    }

    app.mount('#app')
  } catch (error) {
    console.error(error)
    renderBootstrapError(error)
  }
}

window.addEventListener('error', (event) => {
  console.error(event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason)
})

void bootstrap()
