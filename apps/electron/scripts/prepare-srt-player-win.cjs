const { existsSync, copyFileSync, mkdirSync, readdirSync, rmSync } = require('node:fs')
const { join, dirname, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = resolve(__dirname, '..')
const sourcePath = join(projectRoot, 'native', 'srt_player_win.cpp')
const outputDir = join(projectRoot, 'resources', 'bin')
const outputExe = join(outputDir, 'srt-player-win.exe')
const runtimeDllCandidates = [
  'libwinpthread-1.dll',
  'libgcc_s_seh-1.dll',
  'libstdc++-6.dll',
  'libc++.dll',
  'libunwind.dll'
]

function fail(message) {
  console.error(`[prepare-srt-player-win] ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    ...options
  })

  if (result.error) {
    fail(`Falha ao executar ${command}: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${command} terminou com código ${result.status}.${details ? `\n${details}` : ''}`)
  }

  return result
}

function tryRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    ...options
  })

  return result
}

function locateCompiler() {
  const envCompiler = process.env.MINGW_GXX
  if (envCompiler && existsSync(envCompiler)) return envCompiler

  const where = spawnSync('where.exe', ['x86_64-w64-mingw32-g++.exe'], {
    stdio: 'pipe',
    encoding: 'utf8'
  })

  if (where.status === 0) {
    const first = where.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)

    if (first) return first
  }

  const localAppData = process.env.LOCALAPPDATA
  if (localAppData) {
    const wingetPackages = join(localAppData, 'Microsoft', 'WinGet', 'Packages')
    if (existsSync(wingetPackages)) {
      for (const entry of readdirSync(wingetPackages, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith('MartinStorsjo.LLVM-MinGW.UCRT')) continue

        const packageDir = join(wingetPackages, entry.name)
        for (const child of readdirSync(packageDir, { withFileTypes: true })) {
          if (!child.isDirectory() || !child.name.includes('ucrt-x86_64')) continue

          const candidate = join(packageDir, child.name, 'bin', 'x86_64-w64-mingw32-g++.exe')
          if (existsSync(candidate)) return candidate
        }
      }
    }
  }

  fail('x86_64-w64-mingw32-g++.exe não encontrado no PATH.')
}

function parseImportedDlls(compilerDir) {
  const objdump = join(compilerDir, 'x86_64-w64-mingw32-objdump')
  if (!existsSync(objdump)) {
    return []
  }

  const result = spawnSync(objdump, ['-p', outputExe], {
    stdio: 'pipe',
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    return []
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^DLL Name:\s+(.+)$/i)
      return match ? match[1] : null
    })
    .filter(Boolean)
}

function copyRuntimeDlls(compilerPath) {
  const compilerDir = dirname(compilerPath)
  const imported = new Set(parseImportedDlls(compilerDir).map((name) => name.toLowerCase()))
  const selected = runtimeDllCandidates.filter((name) => {
    if (imported.size === 0) return existsSync(join(compilerDir, name))
    return imported.has(name.toLowerCase())
  })

  for (const file of runtimeDllCandidates) {
    const target = join(outputDir, file)
    if (existsSync(target) && !selected.includes(file)) {
      rmSync(target, { force: true })
    }
  }

  for (const file of selected) {
    const source = join(compilerDir, file)
    const target = join(outputDir, file)
    if (!existsSync(source)) {
      fail(`DLL requerida não encontrada: ${source}`)
    }
    copyFileSync(source, target)
    console.log(`[prepare-srt-player-win] Copiada ${file}`)
  }
}

if (process.platform !== 'win32') {
  console.log('[prepare-srt-player-win] Ignorado fora do Windows.')
  process.exit(0)
}

if (!existsSync(sourcePath)) {
  fail(`Fonte não encontrado: ${sourcePath}`)
}

mkdirSync(outputDir, { recursive: true })

const compilerPath = locateCompiler()
const compileResult = tryRun(compilerPath, [
  '-std=c++17',
  '-O2',
  '-static-libgcc',
  '-static-libstdc++',
  sourcePath,
  '-o',
  outputExe,
  '-lgdi32',
  '-luser32'
])

if (compileResult.error || compileResult.status !== 0) {
  if (!existsSync(outputExe)) {
    const details = [
      compileResult.stdout,
      compileResult.stderr,
      compileResult.error ? compileResult.error.message : ''
    ]
      .filter(Boolean)
      .join('\n')
      .trim()
    fail(`Não foi possível compilar o helper e não existe binário prévio.\n${details}`)
  }

  const details = [
    compileResult.stdout,
    compileResult.stderr,
    compileResult.error ? compileResult.error.message : ''
  ]
    .filter(Boolean)
    .join('\n')
    .trim()
  console.warn(
    `[prepare-srt-player-win] Compilação ignorada; usando binário existente em ${outputExe}.${details ? `\n${details}` : ''}`
  )
} else {
  console.log(`[prepare-srt-player-win] Compilado ${outputExe}`)
}

copyRuntimeDlls(compilerPath)
