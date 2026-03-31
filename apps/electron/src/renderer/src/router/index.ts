import { createRouter, createWebHashHistory } from 'vue-router'

import TelaModo from '../views/TelaModo.vue'
import TelaInicio from '../views/TelaInicio.vue'
import TelaConfiguracoes from '../views/TelaConfiguracoes.vue'
import TelaLeilao from '../views/TelaLeilao.vue'
import TelaOperacao from '../views/TelaOperacao.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/modo' },
    { path: '/modo', component: TelaModo },
    { path: '/inicio', component: TelaInicio },
    { path: '/configuracoes', component: TelaConfiguracoes },
    { path: '/leilao/:id', component: TelaLeilao },
    { path: '/operacao/:id', component: TelaOperacao }
  ]
})

router.beforeEach(async (to) => {
  const modo = await window.config.getModo()

  if (!modo && to.path !== '/modo') return '/modo'
  if (modo && to.path === '/modo') return '/inicio'
  return true
})
