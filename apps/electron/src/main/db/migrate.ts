import { app } from 'electron'
import { spawn } from 'child_process'
import { join, resolve } from 'path'
import { existsSync } from 'fs'

function fileSqliteUrl(absolutePath: string) {
  const normalized = absolutePath.replace(/\\/g, '/')
  return `file:${normalized.startsWith('/') ? '' : '/'}${normalized}`
}

export function getRuntimeDatabaseUrl() {
  const userData = app.getPath('userData')
  const dbPath = join(userData, 'gc.sqlite')
  return fileSqliteUrl(dbPath)
}

function getSchemaPath() {
  // 1) DEV: a partir do código compilado em apps/electron/out/main
  // __dirname aqui vira .../apps/electron/out/main
  const devPath = resolve(__dirname, '../../prisma/schema.prisma')

  // 2) Fallback: quando rodar a partir do repo (alguns setups)
  const cwdPath = resolve(process.cwd(), 'apps/electron/prisma/schema.prisma')

  // 3) (futuro) PROD empacotado: vamos ajustar quando empacotar
  const prodPath = resolve(app.getAppPath(), 'prisma/schema.prisma')

  if (existsSync(devPath)) return devPath
  if (existsSync(cwdPath)) return cwdPath
  return prodPath
}

export async function migrateDeploy() {
  const databaseUrl = getRuntimeDatabaseUrl()
  const schemaPath = getSchemaPath()

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl
  }

  await new Promise<void>((resolvePromise, reject) => {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const child = spawn(cmd, ['prisma', 'migrate', 'deploy', '--schema', schemaPath], { env })

    let stderr = ''
    child.stderr.on('data', (d) => {
      stderr += String(d)
    })

    child.on('exit', (code) => {
      if (code === 0) return resolvePromise()
      reject(new Error(stderr || `prisma migrate deploy falhou (code ${code})`))
    })
  })
}
