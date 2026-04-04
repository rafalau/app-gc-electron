import { app } from 'electron'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { spawn } from 'child_process'
import { createHash, randomUUID } from 'crypto'
import { join, resolve } from 'path'

function fileSqliteUrl(absolutePath: string) {
  const normalized = absolutePath.replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:${normalized}`
  }
  return `file:${normalized.startsWith('/') ? '' : '/'}${normalized}`
}

function getRuntimeDatabasePath() {
  const userData = app.getPath('userData')
  mkdirSync(userData, { recursive: true })
  return join(userData, 'gc.sqlite')
}

export function getRuntimeDatabaseUrl() {
  return fileSqliteUrl(getRuntimeDatabasePath())
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
  const devPath = resolve(__dirname, '../../prisma/schema.prisma')
  const cwdPath = resolve(projectRoot, 'apps/electron/prisma/schema.prisma')
  const prodPath = resolve(app.getAppPath(), 'prisma/schema.prisma')

  if (existsSync(devPath)) return devPath
  if (existsSync(cwdPath)) return cwdPath
  return prodPath
}

function getMigrationsPath() {
  const projectRoot = getProjectRoot()
  const devPath = resolve(__dirname, '../../prisma/migrations')
  const cwdPath = resolve(projectRoot, 'apps/electron/prisma/migrations')
  const prodPath = resolve(app.getAppPath(), 'prisma/migrations')

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
  const prismaScript = resolve(projectRoot, 'node_modules', 'prisma', 'build', 'index.js')
  const nodeExecutable =
    process.env.npm_node_execpath ||
    process.env.NODE ||
    (process.platform === 'win32' ? 'node.exe' : 'node')

  if (existsSync(prismaScript)) {
    return {
      cmd: nodeExecutable,
      args: [prismaScript],
      cwd: projectRoot
    }
  }

  return {
    cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['prisma'],
    cwd: projectRoot
  }
}

async function migrateDeployWithCli() {
  const databaseUrl = getRuntimeDatabaseUrl()
  const schemaPath = getSchemaPath()
  const configPath = getConfigPath()
  const { cmd, args, cwd } = getPrismaCommand()

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl
  }

  await new Promise<void>((resolvePromise, reject) => {
    const baseArgs = [...args, 'migrate', 'deploy', '--schema', schemaPath, '--config', configPath]

    const child =
      process.platform === 'win32' && cmd.toLowerCase().endsWith('.cmd')
        ? spawn(cmd, baseArgs, {
            cwd,
            env,
            shell: true
          })
        : spawn(cmd, baseArgs, {
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

function ensureMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `)
}

function migrateDeployPackaged() {
  const dbPath = getRuntimeDatabasePath()
  const migrationsPath = getMigrationsPath()

  const db = new Database(dbPath)

  try {
    ensureMigrationsTable(db)

    const migrationDirs = readdirSync(migrationsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    for (const migrationName of migrationDirs) {
      const alreadyApplied = db
        .prepare(
          `
            SELECT 1
            FROM "_prisma_migrations"
            WHERE "migration_name" = ?
              AND "finished_at" IS NOT NULL
              AND "rolled_back_at" IS NULL
            LIMIT 1
          `
        )
        .get(migrationName)

      if (alreadyApplied) continue

      const migrationPath = join(migrationsPath, migrationName, 'migration.sql')
      const sql = readFileSync(migrationPath, 'utf8')
      const checksum = createHash('sha256').update(sql).digest('hex')
      const startedAt = new Date().toISOString()
      const id = randomUUID()

      try {
        db.exec('BEGIN')
        db.exec(sql)
        db.prepare(
          `
            INSERT INTO "_prisma_migrations" (
              "id",
              "checksum",
              "finished_at",
              "migration_name",
              "logs",
              "rolled_back_at",
              "started_at",
              "applied_steps_count"
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        ).run(id, checksum, new Date().toISOString(), migrationName, '', null, startedAt, 1)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        db.prepare(
          `
            INSERT INTO "_prisma_migrations" (
              "id",
              "checksum",
              "finished_at",
              "migration_name",
              "logs",
              "rolled_back_at",
              "started_at",
              "applied_steps_count"
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        ).run(
          id,
          checksum,
          null,
          migrationName,
          error instanceof Error ? error.stack ?? error.message : String(error),
          null,
          startedAt,
          0
        )
        throw error
      }
    }
  } finally {
    db.close()
  }
}

export async function migrateDeploy() {
  if (app.isPackaged || process.env.APP_GC_PORTABLE === '1') {
    migrateDeployPackaged()
    return
  }

  try {
    await migrateDeployWithCli()
  } catch (error) {
    console.warn(
      '[migrate] prisma CLI falhou no dev; aplicando migrations locais por SQL.',
      error
    )
    migrateDeployPackaged()
  }
}
