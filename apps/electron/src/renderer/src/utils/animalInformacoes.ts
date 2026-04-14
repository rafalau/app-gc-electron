export type AnimalInformacoesEstruturadas = {
  raca: string
  sexo: string
  pelagem: string
  nascimento: string
  altura: string
  peso: string
}

function normalizarNascimentoTexto(value?: string | null) {
  const texto = String(value ?? '').trim()
  const matchIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matchIso) return texto

  const [, ano, mes, dia] = matchIso
  return `${dia}/${mes}/${ano}`
}

export function parseInformacoesAgregadas(informacoes: string): AnimalInformacoesEstruturadas {
  const partesBrutas = String(informacoes ?? '')
    .split('|')
    .map((parte) => parte.trim())
  let altura = ''
  let peso = ''
  const partes = partesBrutas.filter(Boolean).filter((parte) => {
    const matchAltura = parte.match(/^ALTURA\s*:\s*(.+)$/i)
    if (matchAltura) {
      altura = matchAltura[1].trim()
      return false
    }

    const matchPeso = parte.match(/^PESO\s*:\s*(.+)$/i)
    if (matchPeso) {
      peso = matchPeso[1].trim()
      return false
    }

    return !/^(INFO|LOCAL|CIDADE(?:\/UF)?|UF)\s*:/i.test(parte)
  })

  if (partesBrutas.length >= 4 || (partesBrutas.length > 1 && partesBrutas.some((parte) => parte === ''))) {
    const [raca = '', sexo = '', pelagem = '', nascimento = '', alturaPosicional = '', pesoPosicional = ''] = partesBrutas
    return {
      raca,
      sexo,
      pelagem,
      nascimento: normalizarNascimentoTexto(nascimento),
      altura: altura || alturaPosicional.trim(),
      peso: peso || pesoPosicional.trim()
    }
  }

  if (partes.length >= 6) {
    const [raca, sexo, pelagem, nascimento, alturaPosicional, pesoPosicional] = partes
    return {
      raca,
      sexo,
      pelagem,
      nascimento: normalizarNascimentoTexto(nascimento),
      altura: altura || alturaPosicional,
      peso: peso || pesoPosicional
    }
  }

  if (partes.length >= 5) {
    const [raca, sexo, pelagem, nascimento, alturaPosicional] = partes
    return {
      raca,
      sexo,
      pelagem,
      nascimento: normalizarNascimentoTexto(nascimento),
      altura: altura || alturaPosicional,
      peso
    }
  }

  if (partes.length === 4) {
    const [raca, sexo, pelagem, nascimento] = partes
    return { raca, sexo, pelagem, nascimento: normalizarNascimentoTexto(nascimento), altura, peso }
  }

  if (partes.length === 3) {
    const [sexo, pelagem, nascimento] = partes
    return { raca: '', sexo, pelagem, nascimento: normalizarNascimentoTexto(nascimento), altura, peso }
  }

  if (partes.length === 2) {
    const [sexo, pelagem] = partes
    return { raca: '', sexo, pelagem, nascimento: '', altura, peso }
  }

  if (partes.length === 1) {
    return { raca: '', sexo: partes[0], pelagem: '', nascimento: '', altura, peso }
  }

  return { raca: '', sexo: '', pelagem: '', nascimento: '', altura, peso }
}

export function buildInformacoesAgregadas({
  raca,
  sexo,
  pelagem,
  nascimento,
  altura,
  peso
}: AnimalInformacoesEstruturadas) {
  const partes = [
    raca,
    sexo,
    pelagem,
    nascimento,
    altura ? `ALTURA: ${altura}` : '',
    peso ? `PESO: ${peso}` : ''
  ].map((parte) => String(parte ?? '').trim())

  while (partes.length > 0 && !partes[partes.length - 1]) {
    partes.pop()
  }

  return partes.length > 0 ? partes.join('   |   ') : ''
}

export function formatarInformacoesParaExibicao(informacoes: string) {
  return String(informacoes ?? '')
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join('   |   ')
}

export function formatarGenealogiaParaExibicao(genealogia: string) {
  return String(genealogia ?? '')
    .replace(/\s+X\s+/g, '   X   ')
    .trim()
}
