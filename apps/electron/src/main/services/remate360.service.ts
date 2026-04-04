import https from 'node:https'
import type { AnimalImportInput, ImportSummary } from './animalImport.service'
import { importAnimais } from './animalImport.service'

const REMATE360_EVENTS_URL =
  'https://api-integrador.remate360.com.br/api/public/NnngF8tD8xIPVLQe1UK3fI0MHHqbKmdIZtgECOGiJR7IvFSHjSjWhbBm3yuaYpNH/eventos'

export function isRemate360Url(url: string) {
  return String(url ?? '').includes('api-integrador.remate360.com.br')
}

export type Remate360EventOption = {
  id: number
  titulo: string
  dataHora: string
  totalAnimais: number
}

interface Remate360Genealogia {
  pai?: string | null
  mae?: string | null
  avo3?: string | null
}

interface Remate360Animal {
  id?: number | string | null
  lote?: string | number | null
  nome_animal?: string | null
  raca?: string | null
  sexo?: string | null
  pelagem?: string | null
  nascimento?: string | null
  nome_proprietario?: string | null
  vendedor?: string | null
  genealogia?: Remate360Genealogia | null
}

interface Remate360EventResponse {
  id?: number | string | null
  nome?: string | null
  data?: string | null
  total_animais?: number | null
  animais?: Remate360Animal[] | null
}

interface Remate360EventsResponse {
  eventos?: Remate360EventResponse[] | null
  error?: string | null
  message?: string | null
}

function upper(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

function joinNonEmpty(parts: Array<string | null | undefined>, separator: string) {
  return parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(separator)
}

function asEventOption(event: Remate360EventResponse): Remate360EventOption {
  const totalAnimaisApi = Number(event.total_animais ?? 0)
  const totalAnimaisLista = Array.isArray(event.animais) ? event.animais.length : 0

  return {
    id: Number(event.id ?? 0),
    titulo: String(event.nome ?? '').trim(),
    dataHora: String(event.data ?? '').trim(),
    totalAnimais: totalAnimaisApi > 0 ? totalAnimaisApi : totalAnimaisLista
  }
}

function buildGenealogia(genealogia?: Remate360Genealogia | null) {
  const pai = upper(genealogia?.pai)
  const mae = upper(genealogia?.mae)
  const avoMaterno = upper(genealogia?.avo3)
  const base = joinNonEmpty([pai, mae], '   X   ')
  return `${base}${avoMaterno ? `   (${avoMaterno})` : ''}`.trim()
}

function toAnimalInput(animal: Remate360Animal): AnimalImportInput {
  return {
    lote: String(animal.lote ?? '').trim(),
    nome: upper(animal.nome_animal),
    raca: upper(animal.raca),
    sexo: upper(animal.sexo),
    pelagem: upper(animal.pelagem),
    nascimento: String(animal.nascimento ?? '').trim().toUpperCase(),
    categoria: 'ANIMAIS',
    vendedor: upper(animal.vendedor ?? animal.nome_proprietario),
    informacoes: '',
    genealogia: buildGenealogia(animal.genealogia),
    condicoes_cobertura: []
  }
}

export const remate360Service = {
  async listEvents(): Promise<Remate360EventOption[]> {
    const data = await requestJson<Remate360EventsResponse>(REMATE360_EVENTS_URL)
    ensureValidRemate360Response(data)
    const eventos = Array.isArray(data.eventos) ? data.eventos : []
    return eventos.map(asEventOption).filter((event) => event.id > 0 && event.titulo)
  },

  async importEvent(
    leilaoId: string,
    eventId: number,
    incluirRacaNasInformacoes = false
  ): Promise<ImportSummary> {
    const data = await requestJson<Remate360EventsResponse>(REMATE360_EVENTS_URL)
    ensureValidRemate360Response(data)
    const eventos = Array.isArray(data.eventos) ? data.eventos : []
    const selectedEvent = eventos.find((event) => Number(event.id ?? 0) === Number(eventId))

    if (!selectedEvent) {
      throw new Error('Evento do Remate360 não encontrado.')
    }

    const animais = Array.isArray(selectedEvent.animais) ? selectedEvent.animais : []
    return importAnimais(leilaoId, animais.map(toAnimalInput), { incluirRacaNasInformacoes })
  },

  async listEventsByUrl(url: string): Promise<Remate360EventOption[]> {
    const data = await requestJson<Remate360EventsResponse>(url)
    ensureValidRemate360Response(data)
    const eventos = Array.isArray(data.eventos) ? data.eventos : []
    return eventos.map(asEventOption).filter((event) => event.id > 0 && event.titulo)
  },

  async importEventByUrl(
    leilaoId: string,
    eventId: number,
    incluirRacaNasInformacoes = false,
    url: string
  ): Promise<ImportSummary> {
    const data = await requestJson<Remate360EventsResponse>(url)
    ensureValidRemate360Response(data)
    const eventos = Array.isArray(data.eventos) ? data.eventos : []
    const selectedEvent = eventos.find((event) => Number(event.id ?? 0) === Number(eventId))

    if (!selectedEvent) {
      throw new Error('Evento do Remate360 não encontrado.')
    }

    const animais = Array.isArray(selectedEvent.animais) ? selectedEvent.animais : []
    return importAnimais(leilaoId, animais.map(toAnimalInput), { incluirRacaNasInformacoes })
  }
}

function ensureValidRemate360Response(data: Remate360EventsResponse) {
  const error = String(data.error ?? '').trim()
  const message = String(data.message ?? '').trim()
  const hasEventos = Array.isArray(data.eventos)

  if (!hasEventos && (error || message)) {
    throw new Error(joinNonEmpty([error, message], ': '))
  }
}

function requestJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { rejectUnauthorized: false }, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error('Falha na comunicação com o Remate360.'))
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
          reject(new Error('Resposta inválida do Remate360.'))
        }
      })
    })

    request.on('error', () => {
      reject(new Error('Falha na comunicação com o Remate360.'))
    })
  })
}
