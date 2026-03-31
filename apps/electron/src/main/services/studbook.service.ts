import https from 'node:https'

export type StudbookSearchResult = {
  nome: string
  registro: string
}

export type StudbookImportPayload = {
  nome: string
  informacoes: string
  genealogia: string
}

interface StudbookPedigreeNode {
  male?: { name?: string | null }
  female?: { name?: string | null }
}

interface StudbookAnimalResponse {
  nome?: string | null
  sexo?: string | null
  pelagem?: string | null
  nascimento?: string | null
  pedigree?: StudbookPedigreeNode[]
}

function upper(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue).trim()
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = String(date.getUTCFullYear())
  return `${day}/${month}/${year}`
}

export const studbookService = {
  async search(term: string): Promise<StudbookSearchResult[]> {
    const query = term.trim()
    if (!query) return []

    const url = `https://studbook.com.br/api/animais/nomes?nome=${encodeURIComponent(query)}`
    const data = await requestJson<Array<{ nome?: string; registro?: string }>>(url)
    return data.map((item) => ({
      nome: item.nome ?? '',
      registro: item.registro ?? ''
    }))
  },

  async importByRegistro(registro: string): Promise<StudbookImportPayload> {
    const cleanRegistro = String(registro ?? '').trim()
    if (!cleanRegistro) {
      throw new Error('Registro inválido.')
    }

    const url = `https://studbook.com.br/api/animais?inscricao=${encodeURIComponent(cleanRegistro)}&pedigree=3`
    const data = await requestJson<StudbookAnimalResponse>(url)
    const pedigree = data.pedigree ?? []

    const pai = upper(pedigree[0]?.male?.name)
    const mae = upper(pedigree[0]?.female?.name)
    const avoMaterno = upper(pedigree[4]?.male?.name)

    return {
      nome: upper(data.nome),
      informacoes: `${upper(data.sexo)}   |   ${upper(data.pelagem)}   |   ${formatDate(
        data.nascimento
      )}`.trim(),
      genealogia: `${pai}   X   ${mae}${avoMaterno ? `   (${avoMaterno})` : ''}`.trim()
    }
  }
}

function requestJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { rejectUnauthorized: false }, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error('Falha na comunicação com a A.B.C.P.C.C.'))
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
          reject(new Error('Resposta inválida da A.B.C.P.C.C.'))
        }
      })
    })

    request.on('error', () => {
      reject(new Error('Falha na comunicação com a A.B.C.P.C.C.'))
    })
  })
}
