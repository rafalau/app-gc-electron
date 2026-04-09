import * as XLSX from 'xlsx'
import { randomUUID } from 'crypto'
import { getPrisma } from '../db/prisma'

export type AnimalImportInput = {
  lote: string
  nome: string
  raca?: string
  sexo?: string
  pelagem?: string
  nascimento?: string
  altura?: string
  peso?: string
  pai?: string
  mae?: string
  avo_materno?: string
  cidade?: string
  uf?: string
  cidade_uf?: string
  vendedor?: string
  informacoes: string
  genealogia: string
  categoria?: string
  condicoes_cobertura?: string[]
}

export type ImportSummary = {
  totalRead: number
  imported: number
  updated: number
  skipped: number
  invalid: number
  errors: string[]
}

type ImportAnimaisOptions = {
  incluirRacaNasInformacoes?: boolean
}

const headerAliases: Record<string, keyof AnimalImportInput> = {
  lote: 'lote',
  nome: 'nome',
  raca: 'raca',
  sexo: 'sexo',
  pelagem: 'pelagem',
  nascimento: 'nascimento',
  datanascimento: 'nascimento',
  nascimentoanimal: 'nascimento',
  altura: 'altura',
  peso: 'peso',
  pai: 'pai',
  mae: 'mae',
  avo3: 'avo_materno',
  ped05: 'avo_materno',
  avomaterno: 'avo_materno',
  cidade: 'cidade',
  cidadeuf: 'cidade_uf',
  municipio: 'cidade',
  uf: 'uf',
  estado: 'uf',
  vendedor: 'vendedor',
  proprietario: 'vendedor',
  informacoes: 'informacoes',
  informacao: 'informacoes',
  genealogia: 'genealogia',
  categoria: 'categoria'
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function joinNonEmpty(parts: Array<string | undefined>, separator: string) {
  return parts.map((item) => normalizeString(item)).filter(Boolean).join(separator)
}

function normalizeCidadeUf(value: string) {
  const normalized = normalizeString(value).toUpperCase()
  if (!normalized) return ''

  const collapsed = normalized.replace(/\s+/g, ' ').trim()
  const slashMatch = collapsed.match(/^(.+?)\s*\/\s*([A-Z]{2})$/)
  if (slashMatch) {
    return `${slashMatch[1].trim()}/${slashMatch[2].trim()}`
  }

  const dashMatch = collapsed.match(/^(.+?)\s*-\s*([A-Z]{2})$/)
  if (dashMatch) {
    return `${dashMatch[1].trim()}/${dashMatch[2].trim()}`
  }

  return collapsed
}

function buildVendedorLabel(input: AnimalImportInput) {
  const vendedor = normalizeString(input.vendedor).toUpperCase()
  const cidade = normalizeString(input.cidade).toUpperCase()
  const uf = normalizeString(input.uf).toUpperCase()
  const cidadeUf = normalizeCidadeUf(input.cidade_uf ?? '')
  const local = cidadeUf || joinNonEmpty([cidade, uf], '/')

  if (vendedor.startsWith('VENDEDOR:') || vendedor.startsWith('ALOJAMENTO:')) {
    return vendedor
  }

  if (vendedor) {
    return `VENDEDOR: ${joinNonEmpty([vendedor, local], ' - ')}`
  }

  if (local) {
    return `ALOJAMENTO: ${local}`
  }

  return ''
}

function buildGenealogia(input: AnimalImportInput) {
  const genealogia = normalizeString(input.genealogia).toUpperCase()
  if (genealogia) return genealogia

  const pai = normalizeString(input.pai).toUpperCase()
  const mae = normalizeString(input.mae).toUpperCase()
  const avoMaterno = normalizeString(input.avo_materno).toUpperCase()
  const base = joinNonEmpty([pai, mae], '   X   ')

  return `${base}${avoMaterno ? `   (${avoMaterno})` : ''}`.trim()
}

function normalizeInput(input: AnimalImportInput, options: ImportAnimaisOptions = {}): AnimalImportInput {
  const raca = normalizeString(input.raca).toUpperCase()
  const sexo = normalizeString(input.sexo).toUpperCase()
  const pelagem = normalizeString(input.pelagem).toUpperCase()
  const nascimento = normalizeString(input.nascimento).toUpperCase()
  const altura = normalizeString(input.altura).toUpperCase()
  const peso = normalizeString(input.peso).toUpperCase()
  const pai = normalizeString(input.pai).toUpperCase()
  const mae = normalizeString(input.mae).toUpperCase()
  const avo_materno = normalizeString(input.avo_materno).toUpperCase()
  const cidade = normalizeString(input.cidade).toUpperCase()
  const uf = normalizeString(input.uf).toUpperCase()
  const cidade_uf = normalizeCidadeUf(input.cidade_uf ?? '')
  const informacoes = normalizeString(input.informacoes).toUpperCase()
  const genealogia = buildGenealogia(input)

  return {
    lote: normalizeString(input.lote).toUpperCase(),
    nome: normalizeString(input.nome).toUpperCase(),
    raca,
    sexo,
    pelagem,
    nascimento,
    altura,
    peso,
    pai,
    mae,
    avo_materno,
    cidade,
    uf,
    cidade_uf,
    vendedor: buildVendedorLabel(input),
    informacoes: [
      options.incluirRacaNasInformacoes ? raca : '',
      sexo,
      pelagem,
      nascimento,
      altura ? `ALTURA: ${altura}` : '',
      peso ? `PESO: ${peso}` : '',
      informacoes ? `INFO: ${informacoes}` : ''
    ]
      .filter(Boolean)
      .join('   |   '),
    genealogia,
    categoria: normalizeString(input.categoria || 'ANIMAIS').toUpperCase(),
    condicoes_cobertura: Array.isArray(input.condicoes_cobertura)
      ? input.condicoes_cobertura.map((item) => normalizeString(item).toUpperCase()).filter(Boolean)
      : []
  }
}

function isSameAnimal(a: AnimalImportInput, b: AnimalImportInput) {
  return (
    a.lote === b.lote &&
    a.nome === b.nome &&
    (a.raca || '') === (b.raca || '') &&
    (a.sexo || '') === (b.sexo || '') &&
    (a.pelagem || '') === (b.pelagem || '') &&
    (a.nascimento || '') === (b.nascimento || '') &&
    (a.altura || '') === (b.altura || '') &&
    (a.peso || '') === (b.peso || '') &&
    (a.vendedor || '') === (b.vendedor || '') &&
    a.informacoes === b.informacoes &&
    a.genealogia === b.genealogia &&
    (a.categoria || 'ANIMAIS') === (b.categoria || 'ANIMAIS') &&
    JSON.stringify(a.condicoes_cobertura ?? []) === JSON.stringify(b.condicoes_cobertura ?? [])
  )
}

function mapRow(rawRow: Record<string, unknown>): Partial<AnimalImportInput> {
  const mapped: Partial<AnimalImportInput> = {}

  for (const [key, value] of Object.entries(rawRow)) {
    const alias = headerAliases[normalizeHeader(key)]
    if (!alias) continue
    mapped[alias] = normalizeString(value) as never
  }

  return mapped
}

export async function importAnimais(
  leilaoId: string,
  inputs: AnimalImportInput[],
  options: ImportAnimaisOptions = {}
): Promise<ImportSummary> {
  const prisma = await getPrisma()

  const summary: ImportSummary = {
    totalRead: inputs.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    invalid: 0,
    errors: []
  }

  for (const [index, rawInput] of inputs.entries()) {
    try {
      const input = normalizeInput(rawInput, options)

      if (!input.lote || !input.nome) {
        summary.invalid += 1
        summary.errors.push(`Linha ${index + 1}: lote e nome sao obrigatorios.`)
        continue
      }

      const [existing] = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT id, lote, nome, categoria, raca, sexo, pelagem, nascimento, altura, peso, proprietario, informacoes, genealogia, condicoes_cobertura
          FROM Animal
          WHERE leilao_id = ? AND lote = ?
          LIMIT 1
        `,
        leilaoId,
        input.lote
      )

      if (!existing) {
        await prisma.$executeRawUnsafe(
          `
            INSERT INTO Animal (
              id,
              leilao_id,
              lote,
              nome,
              categoria,
              raca,
              sexo,
              pelagem,
              nascimento,
              altura,
              peso,
              proprietario,
              informacoes,
              genealogia,
              condicoes_cobertura,
              criado_em,
              atualizado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          randomUUID(),
          leilaoId,
          input.lote,
          input.nome,
          input.categoria ?? 'ANIMAIS',
          input.raca ?? '',
          input.sexo ?? '',
          input.pelagem ?? '',
          input.nascimento ?? '',
          input.altura ?? '',
          input.peso ?? '',
          input.vendedor ?? '',
          input.informacoes,
          input.genealogia,
          JSON.stringify(input.condicoes_cobertura ?? []),
          new Date().toISOString(),
          new Date().toISOString()
        )
        summary.imported += 1
        continue
      }

      const existingComparable = normalizeInput(
        {
          lote: existing.lote,
          nome: existing.nome,
          categoria: existing.categoria,
          raca: existing.raca,
          sexo: existing.sexo,
          pelagem: existing.pelagem,
          nascimento: existing.nascimento,
          altura: existing.altura,
          peso: existing.peso,
          vendedor: existing.proprietario,
          informacoes: existing.informacoes,
          genealogia: existing.genealogia,
          condicoes_cobertura: JSON.parse(existing.condicoes_cobertura ?? '[]')
        },
        options
      )

      if (isSameAnimal(existingComparable, input)) {
        summary.skipped += 1
        continue
      }

      await prisma.$executeRawUnsafe(
        `
          UPDATE Animal
          SET
            nome = ?,
            categoria = ?,
            raca = ?,
            sexo = ?,
            pelagem = ?,
            nascimento = ?,
            altura = ?,
            peso = ?,
            proprietario = ?,
            informacoes = ?,
            genealogia = ?,
            condicoes_cobertura = ?,
            atualizado_em = ?
          WHERE id = ?
        `,
        input.nome,
        input.categoria ?? 'ANIMAIS',
        input.raca ?? '',
        input.sexo ?? '',
        input.pelagem ?? '',
        input.nascimento ?? '',
        input.altura ?? '',
        input.peso ?? '',
        input.vendedor ?? '',
        input.informacoes,
        input.genealogia,
        JSON.stringify(input.condicoes_cobertura ?? []),
        new Date().toISOString(),
        existing.id
      )
      summary.updated += 1
    } catch (error) {
      summary.invalid += 1
      summary.errors.push(`Linha ${index + 1}: ${(error as Error).message}`)
    }
  }

  return summary
}

export async function importAnimaisFromWorkbook(
  leilaoId: string,
  filePath: string,
  options: ImportAnimaisOptions = {}
): Promise<ImportSummary> {
  const workbook = XLSX.readFile(filePath, {
    cellDates: false,
    cellText: true
  })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('A planilha nao possui abas validas.')
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false
  })

  const inputs = rows.map((row) => mapRow(row) as AnimalImportInput)
  return importAnimais(leilaoId, inputs, options)
}
