import { app } from 'electron'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | null = null
let initPromise: Promise<PrismaClient> | null = null

function fileSqliteUrl(absolutePath: string) {
  const normalized = absolutePath.replace(/\\/g, '/')
  return `file:${normalized.startsWith('/') ? '' : '/'}${normalized}`
}

function ensureDatabaseUrl() {
  // Se já existir (ex: em testes), respeita.
  if (process.env.DATABASE_URL) return

  const userData = app.getPath('userData')
  const dbPath = join(userData, 'gc.sqlite')
  process.env.DATABASE_URL = fileSqliteUrl(dbPath)
}

export async function getPrisma() {
  if (prisma) return prisma
  if (initPromise) return initPromise

  initPromise = (async () => {
    ensureDatabaseUrl()

    const p = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL!
        }
      }
    })

    prisma = p
    return p
  })()

  return initPromise
}
