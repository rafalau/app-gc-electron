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

function getProjectRoot() {
  const compiledRoot = resolve(__dirname, '../../../../')
  const cwdRoot = process.cwd()
  const appRoot = app.getAppPath()

  const candidates = [compiledRoot, cwdRoot, appRoot]

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'package.json'))) return candidate
  }

  return cwdRoot
}

function getSchemaPath() {
  const projectRoot = getProjectRoot()

  // 1) DEV: a partir do código compilado em apps/electron/out/main
  // __dirname aqui vira .../apps/electron/out/main
  const devPath = resolve(__dirname, '../../prisma/schema.prisma')

  // 2) Fallback: quando rodar a partir do repo (alguns setups)
  const cwdPath = resolve(projectRoot, 'apps/electron/prisma/schema.prisma')

  // 3) (futuro) PROD empacotado: vamos ajustar quando empacotar
  const prodPath = resolve(app.getAppPath(), 'prisma/schema.prisma')

  if (existsSync(devPath)) return devPath
  if (existsSync(cwdPath)) return cwdPath
  return prodPath
}

function getConfigPath() {
  const projectRoot = getProjectRoot()
  const cwdPath = resolve(projectRoot, 'prisma.config.ts')
  const appPath = resolve(app.getAppPath(), 'prisma.config.ts')

  if (existsSync(cwdPath)) return cwdPath
  return appPath
}

function getPrismaCommand() {
  const projectRoot = getProjectRoot()
  const binaryName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
  const localBinary = resolve(projectRoot, 'node_modules', '.bin', binaryName)

  if (existsSync(localBinary)) {
    return {
      cmd: localBinary,
      cwd: projectRoot
    }
  }

  return {
    cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    cwd: projectRoot
  }
}

export async function migrateDeploy() {
  const databaseUrl = getRuntimeDatabaseUrl()
  const schemaPath = getSchemaPath()
  const configPath = getConfigPath()
  const { cmd, cwd } = getPrismaCommand()

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl
  }

  await new Promise<void>((resolvePromise, reject) => {
    const args = cmd.includes('node_modules')
      ? ['migrate', 'deploy', '--schema', schemaPath, '--config', configPath]
      : ['prisma', 'migrate', 'deploy', '--schema', schemaPath, '--config', configPath]

    const child = spawn(cmd, args, {
      cwd,
      env
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => {
      stdout += String(d)
    })

    child.stderr.on('data', (d) => {
      stderr += String(d)
    })

    child.on('exit', (code) => {
      if (code === 0) return resolvePromise()
      const detalhes = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
      reject(new Error(detalhes || `prisma migrate deploy falhou (code ${code})`))
    })
  })
}
