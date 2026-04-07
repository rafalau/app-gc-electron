export type AnimalInformacoesEstruturadas = {
  raca: string
  sexo: string
  pelagem: string
  nascimento: string
  altura: string
}

export function parseInformacoesAgregadas(informacoes: string): AnimalInformacoesEstruturadas {
  const partesBrutas = String(informacoes ?? '')
    .split('|')
    .map((parte) => parte.trim())
  let altura = ''
  const partes = partesBrutas.filter(Boolean).filter((parte) => {
    const matchAltura = parte.match(/^ALTURA\s*:\s*(.+)$/i)
    if (matchAltura) {
      altura = matchAltura[1].trim()
      return false
    }

    return !/^(INFO|LOCAL|CIDADE(?:\/UF)?|UF)\s*:/i.test(parte)
  })

  if (partesBrutas.length >= 4 || (partesBrutas.length > 1 && partesBrutas.some((parte) => parte === ''))) {
    const [raca = '', sexo = '', pelagem = '', nascimento = '', alturaPosicional = ''] = partesBrutas
    return {
      raca,
      sexo,
      pelagem,
      nascimento,
      altura: altura || alturaPosicional.trim()
    }
  }

  if (partes.length >= 5) {
    const [raca, sexo, pelagem, nascimento, alturaPosicional] = partes
    return { raca, sexo, pelagem, nascimento, altura: altura || alturaPosicional }
  }

  if (partes.length === 4) {
    const [raca, sexo, pelagem, nascimento] = partes
    return { raca, sexo, pelagem, nascimento, altura }
  }

  if (partes.length === 3) {
    const [sexo, pelagem, nascimento] = partes
    return { raca: '', sexo, pelagem, nascimento, altura }
  }

  if (partes.length === 2) {
    const [sexo, pelagem] = partes
    return { raca: '', sexo, pelagem, nascimento: '', altura }
  }

  if (partes.length === 1) {
    return { raca: '', sexo: partes[0], pelagem: '', nascimento: '', altura }
  }

  return { raca: '', sexo: '', pelagem: '', nascimento: '', altura }
}

export function buildInformacoesAgregadas({
  raca,
  sexo,
  pelagem,
  nascimento,
  altura
}: AnimalInformacoesEstruturadas) {
  const partes = [
    raca,
    sexo,
    pelagem,
    nascimento,
    altura ? `ALTURA: ${altura}` : ''
  ].map((parte) => String(parte ?? '').trim())
  return partes.some(Boolean) ? partes.join('   |   ') : ''
}

export function formatarInformacoesParaExibicao(informacoes: string) {
  return String(informacoes ?? '')
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join(' | ')
}
