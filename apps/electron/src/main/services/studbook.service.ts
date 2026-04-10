import https from 'node:https'
import { URL } from 'node:url'

export type AssociationProvider = 'ABCPCC' | 'ABQM' | 'ABCCRM' | 'ABCCH'

export type StudbookSearchResult = {
  id: string
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

interface AbqmLoginResponse {
  fields?: {
    token?: string | null
  }
}

interface AbqmAnimalSearchItem {
  id_animal?: number | null
  nome_animal?: string | null
  registro_abqm?: string | null
}

interface AbqmAnimalSearchResponse {
  listDto?: AbqmAnimalSearchItem[]
}

interface AbqmAnimalDetailsItem {
  animal?: {
    nome_animal?: string | null
    registro_abqm?: string | null
    sexo?: string | null
    sexo_animal?: string | null
    ds_pelagem?: string | null
    pelagem?: string | null
    dt_nascimento?: string | null
    nascimento?: string | null
  } | null
  nome_animal?: string | null
  registro_abqm?: string | null
  sexo?: string | null
  sexo_animal?: string | null
  ds_pelagem?: string | null
  pelagem?: string | null
  dt_nascimento?: string | null
  nascimento?: string | null
}

interface AbqmAnimalDetailsResponse {
  listDto?: AbqmAnimalDetailsItem[]
}

interface AbqmGenealogyNode {
  id_animal?: number | null
  nome_animal?: string | null
  nome_pai?: string | null
  nome_mae?: string | null
  nome_pai_1?: string | null
  nome_mae_1?: string | null
  nome_pai_2?: string | null
  nome_mae_2?: string | null
  nome_pai_3?: string | null
  nome_mae_3?: string | null
  nome_pai_4?: string | null
  nome_mae_4?: string | null
  nome_pai_5?: string | null
  nome_mae_5?: string | null
  nome_pai_6?: string | null
  nome_mae_6?: string | null
  id_pai?: number | null
  id_mae?: number | null
}

interface AbqmGenealogyResponse {
  listDto?: AbqmGenealogyNode[]
}

interface AbqmPreRegistroData {
  id_animal?: number | null
  opcoes_nome?: string | null
  sexo_produto?: string | null
  dt_nascimento?: string | null
  pelagem_produto?: string | null
  grau_sangue?: string | null
  link?: string | null
  criador?: string | null
  solicitante?: string | null
  id_pai?: number | null
  id_mae?: number | null
}

interface AbqmPreRegistroResponse {
  success?: boolean
  data?: AbqmPreRegistroData | null
}

interface AbccrmSearchItem {
  AnimalID?: number | null
  Nome?: string | null
  NrRegistro?: string | null
}

interface AbccrmAnimalInfo {
  nome?: string | null
  sexo?: string | null
  dataNascimento?: string | null
  nrRegistro?: string | null
  nomeCriador?: string | null
  pelagemID?: number | null
}

interface AbccrmPelagemItem {
  pelagemID?: number | null
  nome?: string | null
}

interface AbccrmGenealogyNode {
  name?: string | null
  children?: AbccrmGenealogyNode[] | null
}

interface AbcchSearchItem {
  CdToken?: string | null
  NmAnimal?: string | null
  NrRegistration?: string | null
}

interface AbcchSearchResponse {
  data?: AbcchSearchItem[]
}

interface AbcchPedigreeNode {
  nmAnimal?: string | null
  sire?: AbcchPedigreeNode | null
  dam?: AbcchPedigreeNode | null
}

interface AbcchAnimalDetailsResponse {
  NmAnimal?: string | null
  NrRegistration?: string | null
  DtFoaledBr?: string | null
  DtFoaled?: string | null
  DsBreed?: string | null
  CdBreed?: string | null
  DsCoatColor?: string | null
  DsGender?: string | null
  NmAnimalSire?: string | null
  NmAnimalDam?: string | null
  lstPedigree?: AbcchPedigreeNode | null
}

const ASSOCIATION_ERROR_LABEL: Record<AssociationProvider, string> = {
  ABCPCC: 'A.B.C.P.C.C.',
  ABQM: 'ABQM',
  ABCCRM: 'ABCCRM',
  ABCCH: 'ABCCH'
}

const ASSOCIATION_RACA: Record<AssociationProvider, string> = {
  ABCPCC: 'PSI',
  ABQM: 'QM',
  ABCCRM: 'MANGALARGA',
  ABCCH: 'BH'
}

const ABQM_BASE_URL = 'https://intranet.abqm.com.br'
const ABQM_LOGIN_EMAIL = 'rafas.lau@gmail.com'
const ABQM_LOGIN_PASSWORD = 'Prop@785421#'
const ABCCRM_BASE_URL = 'https://capri-sgr-api.azurewebsites.net/api'
const ABCCH_BASE_URL = 'https://api.abcch.com.br'

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

function formatDateFlexible(dateValue?: string | null) {
  const value = String(dateValue ?? '').trim()
  if (!value) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value
  return formatDate(value)
}

function buildInformacoes({
  raca,
  sexo,
  pelagem,
  nascimento
}: {
  raca: string
  sexo: string
  pelagem: string
  nascimento: string
}) {
  return [raca, sexo, pelagem, nascimento].map((item) => item.trim()).filter(Boolean).join('   |   ')
}

function buildGenealogiaCurta(pai?: string | null, mae?: string | null, complemento?: string | null) {
  const paiFormatado = upper(pai)
  const maeFormatada = upper(mae)
  const complementoFormatado = upper(complemento)

  if (!paiFormatado && !maeFormatada) return ''
  return `${paiFormatado}   X   ${maeFormatada}${complementoFormatado ? `   (${complementoFormatado})` : ''}`.trim()
}

function normalizeAbqmSexo(value?: string | null) {
  const sexo = upper(value)
  if (sexo === 'M' || sexo === 'MACHO') return 'MACHO'
  if (sexo === 'F' || sexo === 'FEMEA' || sexo === 'FÊMEA') return 'FÊMEA'
  if (sexo === 'C' || sexo === 'CASTRADO') return 'CASTRADO'
  return sexo
}

function normalizeAbccrmSexo(value?: string | null) {
  const sexo = upper(value)
  if (sexo === 'M') return 'MACHO'
  if (sexo === 'F') return 'FÊMEA'
  return sexo
}

function formatAssociationError(provider: AssociationProvider, message: 'network' | 'invalid') {
  const label = ASSOCIATION_ERROR_LABEL[provider]
  return message === 'network'
    ? `Falha na comunicação com ${label}`
    : `Resposta inválida de ${label}`
}

function getNodeName(node?: AbccrmGenealogyNode | null) {
  return upper(node?.name)
}

function getChildNodeName(root: AbccrmGenealogyNode | null | undefined, parentIndex: number, childIndex: number) {
  const parent = root?.children?.[parentIndex]
  const child = parent?.children?.[childIndex]
  return getNodeName(child)
}

function buildAbccrmGenealogyMap(root?: AbccrmGenealogyNode | null) {
  return {
    pai: getNodeName(root?.children?.[0]),
    mae: getNodeName(root?.children?.[1]),
    avoPP: getChildNodeName(root, 0, 0),
    avoPM: getChildNodeName(root, 0, 1),
    avoMP: getChildNodeName(root, 1, 0),
    avoMM: getChildNodeName(root, 1, 1)
  }
}

export const studbookService = {
  async search(term: string, provider: AssociationProvider = 'ABCPCC'): Promise<StudbookSearchResult[]> {
    const query = term.trim()
    if (!query) return []

    if (provider === 'ABQM') {
      return searchAbqm(query)
    }

    if (provider === 'ABCCRM') {
      return searchAbccrm(query)
    }

    if (provider === 'ABCCH') {
      return searchAbcch(query)
    }

    const url = `https://studbook.com.br/api/animais/nomes?nome=${encodeURIComponent(query)}`
    const data = await requestJson<Array<{ nome?: string; registro?: string }>>(url, 'ABCPCC')
    return data.map((item) => {
      const registro = String(item.registro ?? '').trim()
      return {
        id: registro,
        nome: item.nome ?? '',
        registro
      }
    })
  },

  async importByRegistro(
    registroOuId: string,
    provider: AssociationProvider = 'ABCPCC'
  ): Promise<StudbookImportPayload> {
    const cleanValue = String(registroOuId ?? '').trim()
    if (!cleanValue) {
      throw new Error(provider === 'ABCPCC' ? 'Registro inválido.' : 'Identificador inválido.')
    }

    if (provider === 'ABQM') {
      return importAbqm(cleanValue)
    }

    if (provider === 'ABCCRM') {
      return importAbccrm(cleanValue)
    }

    if (provider === 'ABCCH') {
      return importAbcch(cleanValue)
    }

    const url = `https://studbook.com.br/api/animais?inscricao=${encodeURIComponent(cleanValue)}&pedigree=3`
    const data = await requestJson<StudbookAnimalResponse>(url, 'ABCPCC')
    const pedigree = data.pedigree ?? []

    return {
      nome: upper(data.nome),
      informacoes: buildInformacoes({
        raca: ASSOCIATION_RACA.ABCPCC,
        sexo: upper(data.sexo),
        pelagem: upper(data.pelagem),
        nascimento: formatDate(data.nascimento)
      }),
      genealogia: buildGenealogiaCurta(
        pedigree[0]?.male?.name,
        pedigree[0]?.female?.name,
        pedigree[4]?.male?.name
      )
    }
  }
}

async function loginAbqm() {
  const data = await requestJson<AbqmLoginResponse>(
    `${ABQM_BASE_URL}/apicorelogin/api/login`,
    'ABQM',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usuario: ABQM_LOGIN_EMAIL,
        senha: ABQM_LOGIN_PASSWORD
      })
    }
  )

  const token = String(data.fields?.token ?? '').trim()
  if (!token) {
    throw new Error('Não foi possível autenticar automaticamente na ABQM.')
  }

  return token
}

async function searchAbqm(term: string): Promise<StudbookSearchResult[]> {
  const token = await loginAbqm()
  const normalizedTerm = term.trim()
  const numericTerm = normalizedTerm.replace(/\D/g, '')

  const [data, preRegistroResponse] = await Promise.all([
    searchAbqmAnimals(normalizedTerm, token),
    numericTerm
      ? requestJson<AbqmPreRegistroResponse>(
          `${ABQM_BASE_URL}/ABQM.API/api/ServicosOnline/studbook/consultapedidoregistro?num_preregistro=${encodeURIComponent(
            numericTerm
          )}`,
          'ABQM',
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        ).catch(() => null)
      : Promise.resolve(null)
  ])

  const mapped = new Map<string, StudbookSearchResult>()

  for (const item of data.listDto ?? []) {
    const id = String(item.id_animal ?? '').trim()
    if (!id) continue
    mapped.set(id, {
      id,
      nome: upper(item.nome_animal),
      registro: upper(item.registro_abqm)
    })
  }

  if (preRegistroResponse?.success && preRegistroResponse.data) {
    mapped.set(`PRE:${numericTerm}`, {
      id: `PRE:${numericTerm}`,
      nome: upper(preRegistroResponse.data.opcoes_nome),
      registro: `PRÉ-${numericTerm}`
    })
  }

  return [...mapped.values()]
}

async function searchAbqmAnimals(term: string, token: string): Promise<AbqmAnimalSearchResponse> {
  const attempts: Array<number | ''> = [0, '']

  for (const tipoAnimal of attempts) {
    try {
      const response = await requestJson<AbqmAnimalSearchResponse>(
        `${ABQM_BASE_URL}/ABQM.API/api/site/animal/consultaanimalpornomeregistrochiptoken/`,
        'ABQM',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${token}`
          },
          body: JSON.stringify({
            parametro: term.toLowerCase(),
            tipo_pessoa: 'pf',
            tipoAnimal
          })
        }
      )

      if ((response.listDto ?? []).length > 0 || tipoAnimal === '') {
        return response
      }
    } catch (error) {
      if (tipoAnimal === '') throw error
    }
  }

  return { listDto: [] }
}

async function importAbqm(animalId: string): Promise<StudbookImportPayload> {
  const token = await loginAbqm()
  const preRegistro = animalId.startsWith('PRE:') ? animalId.slice(4) : ''

  if (preRegistro) {
    const response = await requestJson<AbqmPreRegistroResponse>(
      `${ABQM_BASE_URL}/ABQM.API/api/ServicosOnline/studbook/consultapedidoregistro?num_preregistro=${encodeURIComponent(
        preRegistro
      )}`,
      'ABQM',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    if (!response.success || !response.data) {
      throw new Error('Pré-registro não encontrado na ABQM.')
    }

    const data = response.data
    const genealogia = data.id_pai && data.id_mae ? await buildAbqmFullGenealogy(data.id_pai, data.id_mae) : null

    return {
      nome: upper(data.opcoes_nome),
      informacoes: buildInformacoes({
        raca: ASSOCIATION_RACA.ABQM,
        sexo: normalizeAbqmSexo(data.sexo_produto),
        pelagem: upper(data.pelagem_produto),
        nascimento: formatDateFlexible(data.dt_nascimento)
      }),
      genealogia: buildGenealogiaCurta(genealogia?.pai, genealogia?.mae, genealogia?.avo3)
    }
  }

  const [detailsResponse, genealogyResponse] = await Promise.all([
    requestJson<AbqmAnimalDetailsResponse>(
      `${ABQM_BASE_URL}/ABQM.API/api/site/animal/consultaanimalporidanimal`,
      'ABQM',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id_animal: animalId })
      }
    ),
    requestJson<AbqmGenealogyResponse>(
      `${ABQM_BASE_URL}/ABQM.API/api/site/genealogia/genealogia`,
      'ABQM',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_animal: Number(animalId) })
      }
    )
  ])

  const detailsItem = detailsResponse.listDto?.[0]
  const details = detailsItem?.animal ?? detailsItem ?? {}
  const genealogy = genealogyResponse.listDto?.[0]
  const fullGenealogy =
    genealogy?.id_pai && genealogy?.id_mae
      ? await buildAbqmFullGenealogy(genealogy.id_pai, genealogy.id_mae)
      : extractAbqmGenealogy(genealogy)

  return {
    nome: upper(details.nome_animal),
    informacoes: buildInformacoes({
      raca: ASSOCIATION_RACA.ABQM,
      sexo: normalizeAbqmSexo(details.sexo ?? details.sexo_animal),
      pelagem: upper(details.ds_pelagem ?? details.pelagem),
      nascimento: formatDateFlexible(details.dt_nascimento ?? details.nascimento)
    }),
    genealogia: buildGenealogiaCurta(fullGenealogy?.pai, fullGenealogy?.mae, fullGenealogy?.avo3)
  }
}

async function searchAbccrm(term: string): Promise<StudbookSearchResult[]> {
  const data = await requestJson<AbccrmSearchItem[]>(
    `${ABCCRM_BASE_URL}/animais/buscar?termo=${encodeURIComponent(term)}`,
    'ABCCRM'
  )

  return data.map((item) => ({
    id: String(item.AnimalID ?? ''),
    nome: upper(item.Nome),
    registro: upper(item.NrRegistro)
  })).filter((item) => item.id)
}

async function importAbccrm(animalId: string): Promise<StudbookImportPayload> {
  const [info, pelagens, genealogyRoot] = await Promise.all([
    requestJson<AbccrmAnimalInfo>(`${ABCCRM_BASE_URL}/animais/${encodeURIComponent(animalId)}`, 'ABCCRM'),
    requestJson<AbccrmPelagemItem[]>(`${ABCCRM_BASE_URL}/pelagens`, 'ABCCRM'),
    requestJson<AbccrmGenealogyNode>(
      `${ABCCRM_BASE_URL}/animais/genealogia?animalId=${encodeURIComponent(animalId)}&maxDepth=5`,
      'ABCCRM'
    )
  ])

  const genealogia = buildAbccrmGenealogyMap(genealogyRoot)
  const pelagem = pelagens.find((item) => Number(item.pelagemID) === Number(info.pelagemID))

  return {
    nome: upper(info.nome),
    informacoes: buildInformacoes({
      raca: ASSOCIATION_RACA.ABCCRM,
      sexo: normalizeAbccrmSexo(info.sexo),
      pelagem: upper(pelagem?.nome),
      nascimento: formatDateFlexible(info.dataNascimento)
    }),
    genealogia: buildGenealogiaCurta(genealogia.pai, genealogia.mae, genealogia.avoMP)
  }
}

async function searchAbcch(term: string): Promise<StudbookSearchResult[]> {
  const data = await requestJson<AbcchSearchResponse>(
    `${ABCCH_BASE_URL}/animais?limit=30&search=&page=1&tipo=1&ano=0&nome=${encodeURIComponent(term)}`,
    'ABCCH'
  )

  return (data.data ?? [])
    .map((item) => ({
      id: String(item.CdToken ?? '').trim(),
      nome: upper(item.NmAnimal),
      registro: upper(item.NrRegistration)
    }))
    .filter((item) => item.id)
}

async function importAbcch(token: string): Promise<StudbookImportPayload> {
  const data = await requestJson<AbcchAnimalDetailsResponse>(
    `${ABCCH_BASE_URL}/animais/${encodeURIComponent(token)}`,
    'ABCCH'
  )

  const avoMaterno = data.lstPedigree?.dam?.sire?.nmAnimal
  const raca = upper(data.CdBreed) || upper(data.DsBreed) || ASSOCIATION_RACA.ABCCH

  return {
    nome: upper(data.NmAnimal),
    informacoes: buildInformacoes({
      raca,
      sexo: normalizeAbqmSexo(data.DsGender),
      pelagem: upper(data.DsCoatColor),
      nascimento: formatDateFlexible(data.DtFoaledBr ?? data.DtFoaled)
    }),
    genealogia: buildGenealogiaCurta(data.NmAnimalSire, data.NmAnimalDam, avoMaterno)
  }
}

async function buildAbqmFullGenealogy(idPai: number, idMae: number) {
  const [paiResponse, maeResponse] = await Promise.all([
    requestJson<AbqmGenealogyResponse>(
      `${ABQM_BASE_URL}/ABQM.API/api/site/genealogia/genealogia`,
      'ABQM',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_animal: idPai })
      }
    ),
    requestJson<AbqmGenealogyResponse>(
      `${ABQM_BASE_URL}/ABQM.API/api/site/genealogia/genealogia`,
      'ABQM',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_animal: idMae })
      }
    )
  ])

  const pai = paiResponse.listDto?.[0]
  const mae = maeResponse.listDto?.[0]

  return {
    pai: upper(pai?.nome_animal),
    mae: upper(mae?.nome_animal),
    avo3: upper(mae?.nome_pai)
  }
}

function extractAbqmGenealogy(genealogy?: AbqmGenealogyNode | null) {
  if (!genealogy) return null
  return {
    pai: upper(genealogy.nome_pai),
    mae: upper(genealogy.nome_mae),
    avo3: upper(genealogy.nome_pai_2)
  }
}

function requestJson<T>(
  url: string,
  provider: AssociationProvider,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
  } = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const request = https.request(
      target,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
        rejectUnauthorized: false
      },
      (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(formatAssociationError(provider, 'network')))
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
          reject(new Error(formatAssociationError(provider, 'invalid')))
        }
      })
      }
    )

    request.on('error', () => {
      reject(new Error(formatAssociationError(provider, 'network')))
    })

    if (options.body) {
      request.write(options.body)
    }

    request.end()
  })
}
