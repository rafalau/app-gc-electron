import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

let prisma: PrismaClient | null = null
let initPromise: Promise<PrismaClient> | null = null

function fileSqliteUrl(absolutePath: string) {
  const normalized = absolutePath.replace(/\\/g, '/')
  return `file:${normalized.startsWith('/') ? '' : '/'}${normalized}`
}

function sqlitePathFromInput(input: string) {
  if (!input.startsWith('file:')) return input

  const normalized = input.slice('file:'.length)

  if (process.platform === 'win32' && /^\/[A-Za-z]:\//.test(normalized)) {
    return normalized.slice(1)
  }

  return normalized
}

function ensureDatabaseUrl() {
  // Se já existir (ex: em testes), respeita.
  if (process.env.DATABASE_URL) return

  const userData = app.getPath('userData')
  mkdirSync(userData, { recursive: true })
  const dbPath = join(userData, 'gc.sqlite')
  process.env.DATABASE_URL = fileSqliteUrl(dbPath)
}

export async function getPrisma() {
  if (prisma) return prisma
  if (initPromise) return initPromise

  initPromise = (async () => {
    ensureDatabaseUrl()
    const sqlitePath = sqlitePathFromInput(process.env.DATABASE_URL!)

    const adapter = new PrismaBetterSqlite3({
      url: sqlitePath
    })

    const p = new PrismaClient({
      adapter
    })

    prisma = p
    return p
  })()

  return initPromise
}

