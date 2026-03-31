export type AnimalInformacoesEstruturadas = {
  raca: string
  sexo: string
  pelagem: string
  nascimento: string
}

export function parseInformacoesAgregadas(informacoes: string): AnimalInformacoesEstruturadas {
  const partes = String(informacoes ?? '')
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean)

  if (partes.length >= 4) {
    const [raca, sexo, pelagem, ...resto] = partes
    return { raca, sexo, pelagem, nascimento: resto.join(' | ').trim() }
  }

  if (partes.length === 3) {
    const [sexo, pelagem, nascimento] = partes
    return { raca: '', sexo, pelagem, nascimento }
  }

  if (partes.length === 2) {
    const [sexo, pelagem] = partes
    return { raca: '', sexo, pelagem, nascimento: '' }
  }

  if (partes.length === 1) {
    return { raca: '', sexo: partes[0], pelagem: '', nascimento: '' }
  }

  return { raca: '', sexo: '', pelagem: '', nascimento: '' }
}

export function buildInformacoesAgregadas({
  raca,
  sexo,
  pelagem,
  nascimento
}: AnimalInformacoesEstruturadas) {
  return [raca, sexo, pelagem, nascimento]
    .map((parte) => String(parte ?? '').trim())
    .filter(Boolean)
    .join('   |   ')
}
