import { createRouter, createWebHashHistory } from 'vue-router'

import TelaInicio from '../views/TelaInicio.vue'
import TelaConfiguracoes from '../views/TelaConfiguracoes.vue'
import TelaLeilao from '../views/TelaLeilao.vue'
import TelaOperacao from '../views/TelaOperacao.vue'
import TelaConexaoRemota from '../views/TelaConexaoRemota.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/inicio' },
    { path: '/conexao', component: TelaConexaoRemota },
    { path: '/inicio', component: TelaInicio },
    { path: '/configuracoes', component: TelaConfiguracoes },
    { path: '/leilao/:id', component: TelaLeilao },
    { path: '/operacao/:id', component: TelaOperacao }
  ]
})

router.beforeEach(async (to) => {
  const modoConfig = await window.config.getModoConfig()

  if (modoConfig.modo === 'REMOTO') {
    if (!modoConfig.hostIp && to.path !== '/conexao') return '/conexao'
  }

  if (modoConfig.modo === 'HOST' && to.path === '/conexao') return '/inicio'
  return true
})
