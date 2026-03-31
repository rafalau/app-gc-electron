import { ipcMain } from 'electron'
import { getStore } from '../store/store'

type VmixConfigIpc = {
  ativo: boolean
  ip: string
  porta: number
  inputSelecionado: {
    key: string
    number: string
    title: string
    type: string
  } | null
}

function normalizarConfigVmix(vmix?: Partial<VmixConfigIpc> | null): VmixConfigIpc {
  return {
    ativo: Boolean(vmix?.ativo),
    ip: String(vmix?.ip ?? '').trim(),
    porta: Number(vmix?.porta) || 8088,
    inputSelecionado: vmix?.inputSelecionado
      ? {
          key: String(vmix.inputSelecionado.key ?? '').trim(),
          number: String(vmix.inputSelecionado.number ?? '').trim(),
          title: String(vmix.inputSelecionado.title ?? '').trim(),
          type: String(vmix.inputSelecionado.type ?? '').trim()
        }
      : null
  }
}

function extrairAtributosXml(bloco: string) {
  const atributos: Record<string, string> = {}

  for (const match of bloco.matchAll(/(\w+)="([^"]*)"/g)) {
    atributos[match[1]] = match[2]
  }

  return atributos
}

async function listarInputsVmix(config: Partial<VmixConfigIpc>) {
  const vmix = normalizarConfigVmix(config)

  if (!vmix.ativo) {
    throw new Error('Ative o recurso do vMix para buscar os inputs.')
  }

  if (!vmix.ip) {
    throw new Error('Informe o IP do vMix para buscar os inputs.')
  }

  const response = await fetch(`http://${vmix.ip}:${vmix.porta}/api`)

  if (!response.ok) {
    throw new Error(`Falha ao consultar vMix API (${response.status}).`)
  }

  const xml = await response.text()
  const inputsMatch = xml.match(/<inputs[^>]*>([\s\S]*?)<\/inputs>/i)

  if (!inputsMatch) return []

  const inputs: Array<{ number: string; title: string; type: string; key: string }> = []

  for (const match of inputsMatch[1].matchAll(/<input\b([^>]*)\/?>/gi)) {
    const attrs = extrairAtributosXml(match[1])

    inputs.push({
      number: String(attrs.number ?? ''),
      title: String(attrs.title ?? ''),
      type: String(attrs.type ?? ''),
      key: String(attrs.key ?? '')
    })
  }

  return inputs
}

async function acionarOverlayVmix(config: Partial<VmixConfigIpc>) {
  const vmix = normalizarConfigVmix(config)

  if (!vmix.ativo) {
    throw new Error('O recurso do vMix está desativado.')
  }

  if (!vmix.ip) {
    throw new Error('Informe o IP do vMix.')
  }

  if (!vmix.inputSelecionado?.title) {
    throw new Error('Selecione um input do vMix.')
  }

  const url = new URL(`http://${vmix.ip}:${vmix.porta}/api/`)
  url.searchParams.set('Function', 'OverlayInput1')
  url.searchParams.set('Input', vmix.inputSelecionado.title)

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Falha ao acionar overlay do vMix (${response.status}).`)
  }

  return {
    ok: true
  }
}

export function registrarIpcConfig() {
  ipcMain.handle('config:setModo', async (_, modo: 'HOST' | 'REMOTO' | null) => {
    const store = await getStore()
    store.set('modo', modo)
  })

  ipcMain.handle('config:getModo', async () => {
    const store = await getStore()
    return store.get('modo')
  })

  ipcMain.handle('config:getVmix', async () => {
    const store = await getStore()
    return store.get('vmix')
  })

  ipcMain.handle('config:setVmix', async (_evt, vmix: Partial<VmixConfigIpc>) => {
    const store = await getStore()
    store.set('vmix', normalizarConfigVmix(vmix))
  })

  ipcMain.handle('config:listarInputsVmix', async (_evt, vmix: Partial<VmixConfigIpc>) => {
    return listarInputsVmix(vmix)
  })

  ipcMain.handle('config:acionarOverlayVmix', async (_evt, vmix: Partial<VmixConfigIpc>) => {
    return acionarOverlayVmix(vmix)
  })

  ipcMain.handle('config:getLayoutAnimais', async (_evt, leilaoId: string) => {
    const store = await getStore()
    const layouts = store.get('layoutAnimaisPorLeilao')
    return (
      layouts?.[leilaoId] ?? {
        modo: 'AGREGADAS',
        incluirRacaNasImportacoes: false
      }
    )
  })

  ipcMain.handle(
    'config:setLayoutAnimais',
    async (
      _evt,
      leilaoId: string,
      layout: { modo: 'AGREGADAS' | 'SEPARADAS'; incluirRacaNasImportacoes: boolean }
    ) => {
      const store = await getStore()
      const layouts = store.get('layoutAnimaisPorLeilao')
      store.set('layoutAnimaisPorLeilao', {
        ...layouts,
        [leilaoId]: layout
      })
    }
  )
}
