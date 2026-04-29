import { ref } from 'vue'

type TemaPreferido = 'light' | 'dark'

const STORAGE_KEY = 'app-gc-tema'
const tema = ref<TemaPreferido>(getTemaSalvo())

function getTemaSalvo(): TemaPreferido {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function aplicarTema(temaPreferido = getTemaSalvo()) {
  tema.value = temaPreferido
  document.documentElement.classList.toggle('dark', temaPreferido === 'dark')
}

export function inicializarTema() {
  aplicarTema()

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      aplicarTema(event.newValue === 'dark' ? 'dark' : 'light')
    }
  })
}

export function useTheme() {
  function alternarTema() {
    const proximoTema: TemaPreferido = tema.value === 'dark' ? 'light' : 'dark'
    window.localStorage.setItem(STORAGE_KEY, proximoTema)
    aplicarTema(proximoTema)
  }

  return {
    tema,
    alternarTema
  }
}
