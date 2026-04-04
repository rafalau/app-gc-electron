import https from 'node:https'
import type { AnimalImportInput, ImportSummary } from './animalImport.service'
import { importAnimais } from './animalImport.service'

export type TbsAuctionOption = {
  id: number
  titulo: string
  dataHora: string
  totalAnimais: number
}

interface TbsAuctionAnimal {
  nome?: string | null
  raca?: string | null
  vendedor?: string | null
  lote?: string | number | null
  sexo?: string | null
  pelagem?: string | null
  nascimento?: string | null
  ped01?: string | null
  ped02?: string | null
  ped05?: string | null
  cidade_alojamento?: string | null
  altura?: string | null
  peso?: string | null
  pivot?: { lote?: string | number | null } | null
  [key: string]: unknown
}

interface TbsAuctionResponse {
  id?: number | string | null
  titulo?: string | null
  data_hora?: string | null
  animais?: TbsAuctionAnimal[] | null
}

function upper(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

function joinNonEmpty(parts: Array<string | null | undefined>, separator: string) {
  return parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(separator)
}

function getAuctionAnimalLote(animal: TbsAuctionAnimal) {
  return String(animal.lote ?? animal.pivot?.lote ?? '').trim()
}

function getAuctionAnimalVendedor(animal: TbsAuctionAnimal) {
  const direct = upper(animal.vendedor)
  const cidade = upper(animal.cidade_alojamento)

  if (direct) {
    return cidade ? `${direct} - ${cidade}` : direct
  }

  for (const [key, value] of Object.entries(animal)) {
    if (!key.toLowerCase().includes('vendedor')) continue
    const normalized = upper(typeof value === 'string' ? value : null)
    if (normalized) return cidade ? `${normalized} - ${cidade}` : normalized
  }

  return cidade ? `ALOJAMENTO: ${cidade}` : ''
}

function asAuctionOption(auction: TbsAuctionResponse): TbsAuctionOption {
  return {
    id: Number(auction.id ?? 0),
    titulo: String(auction.titulo ?? '').trim(),
    dataHora: String(auction.data_hora ?? '').trim(),
    totalAnimais: Array.isArray(auction.animais) ? auction.animais.length : 0
  }
}

function toAnimalInput(animal: TbsAuctionAnimal): AnimalImportInput {
  const avoMaterno = upper(animal.ped05)
  return {
    lote: getAuctionAnimalLote(animal),
    nome: upper(animal.nome),
    raca: upper(animal.raca),
    sexo: upper(animal.sexo),
    pelagem: upper(animal.pelagem),
    nascimento: String(animal.nascimento ?? '').trim().toUpperCase(),
    categoria: 'ANIMAIS',
    vendedor: getAuctionAnimalVendedor(animal),
    informacoes: joinNonEmpty(
      [
        animal.altura ? `ALTURA: ${upper(animal.altura)}` : '',
        animal.peso ? `PESO: ${upper(animal.peso)}` : ''
      ],
      '   |   '
    ),
    genealogia: `${upper(animal.ped01)}   X   ${upper(animal.ped02)}${
      avoMaterno ? `   (${avoMaterno})` : ''
    }`.trim(),
    condicoes_cobertura: []
  }
}

export const tbsService = {
  async listActiveAuctionsByUrl(url: string): Promise<TbsAuctionOption[]> {
    const data = await requestJson<TbsAuctionResponse[]>(url)
    return data.map(asAuctionOption).filter((auction) => auction.id > 0 && auction.titulo)
  },

  async listActiveAuctions(): Promise<TbsAuctionOption[]> {
    return this.listActiveAuctionsByUrl('https://agenciatbs.net.br/api/leiloes-ativos')
  },

  async importAuction(
    leilaoId: string,
    auctionId: number,
    incluirRacaNasInformacoes = false
  ): Promise<ImportSummary> {
    return this.importAuctionByUrl(
      leilaoId,
      auctionId,
      incluirRacaNasInformacoes,
      'https://agenciatbs.net.br/api/leiloes-ativos'
    )
  },

  async importAuctionByUrl(
    leilaoId: string,
    auctionId: number,
    incluirRacaNasInformacoes = false,
    url: string
  ): Promise<ImportSummary> {
    const data = await requestJson<TbsAuctionResponse[]>(url)
    const selectedAuction = data.find((auction) => Number(auction.id ?? 0) === Number(auctionId))

    if (!selectedAuction) {
      throw new Error('Leilão TBS não encontrado.')
    }

    const animals = Array.isArray(selectedAuction.animais) ? selectedAuction.animais : []
    return importAnimais(leilaoId, animals.map(toAnimalInput), { incluirRacaNasInformacoes })
  }
}

function requestJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { rejectUnauthorized: false }, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error('Falha na comunicação com a TBS.'))
        response.resume()
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body) as T)
        } catch {
          reject(new Error('Resposta inválida da TBS.'))
        }
      })
    })

    request.on('error', () => {
      reject(new Error('Falha na comunicação com a TBS.'))
    })
  })
}
