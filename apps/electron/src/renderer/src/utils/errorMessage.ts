export function getFriendlyErrorMessage(error: unknown) {
  const rawMessage = (error as Error)?.message ?? String(error ?? '')

  let message = rawMessage.replace(/^Error invoking remote method '[^']+':\s*/i, '').trim()

  if (!message) {
    return 'Erro inesperado.'
  }

  if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
    return 'Erro: não foi possível conectar ao host.'
  }

  if (message.includes('Token da GC API inválido ou expirado.')) {
    return 'Erro: Token da GC API inválido ou expirado.'
  }

  if (message.includes('Falha ao consultar GC API')) {
    return `Erro: ${message}`
  }

  if (message.includes('A sincronização com a GC API só pode ser executada no HOST.')) {
    return 'Erro: a sincronização com o servidor só pode ser executada no host.'
  }

  if (message.startsWith('validation.')) {
    return 'Erro: dados inválidos para sincronização.'
  }

  if (message.startsWith('Falha HTTP ')) {
    return `Erro: ${message}`
  }

  if (/^(Erro:|Falha:)/i.test(message)) {
    return message
  }

  return `Erro: ${message}`
}
