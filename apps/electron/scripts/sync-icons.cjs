const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const electronRoot = path.resolve(__dirname, '..')
const iconsRoot = path.join(repoRoot, 'icones')
const resourcesRoot = path.join(electronRoot, 'resources')
const buildRoot = path.join(electronRoot, 'build')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readPngSize(buffer, sourcePath) {
  const pngSignature = '89504e470d0a1a0a'
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`Arquivo nao e PNG valido: ${sourcePath}`)
  }

  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)

  if (!width || !height) {
    throw new Error(`PNG invalido sem dimensoes: ${sourcePath}`)
  }

  return { width, height }
}

function pngToIco(pngBuffer, sourcePath) {
  const { width, height } = readPngSize(pngBuffer, sourcePath)
  const header = Buffer.alloc(22)

  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(width >= 256 ? 0 : width, 6)
  header.writeUInt8(height >= 256 ? 0 : height, 7)
  header.writeUInt8(0, 8)
  header.writeUInt8(0, 9)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(pngBuffer.length, 14)
  header.writeUInt32LE(22, 18)

  return Buffer.concat([header, pngBuffer])
}

function copyFile(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath))
  fs.copyFileSync(sourcePath, targetPath)
  console.log(`[sync-icons] Copiado ${path.relative(repoRoot, targetPath)}`)
}

function writeFile(targetPath, content) {
  ensureDir(path.dirname(targetPath))
  fs.writeFileSync(targetPath, content)
  console.log(`[sync-icons] Gerado ${path.relative(repoRoot, targetPath)}`)
}

function syncVariant(sourceName, resourceName, buildName) {
  const sourcePath = path.join(iconsRoot, sourceName)
  const pngBuffer = fs.readFileSync(sourcePath)

  copyFile(sourcePath, path.join(resourcesRoot, `${resourceName}.png`))
  copyFile(sourcePath, path.join(buildRoot, `${buildName}.png`))
  writeFile(path.join(buildRoot, `${buildName}.ico`), pngToIco(pngBuffer, sourcePath))
}

syncVariant('ICONE-HOST.png', 'icon-host', 'icon-host')
syncVariant('ICONE-REMOTO.png', 'icon-remoto', 'icon-remoto')

// Mantem o icone padrao alinhado ao host para execucoes sem APP_MODE.
copyFile(path.join(iconsRoot, 'ICONE-HOST.png'), path.join(resourcesRoot, 'icon.png'))
copyFile(path.join(iconsRoot, 'ICONE-HOST.png'), path.join(buildRoot, 'icon.png'))
writeFile(
  path.join(buildRoot, 'icon.ico'),
  pngToIco(fs.readFileSync(path.join(iconsRoot, 'ICONE-HOST.png')), path.join(iconsRoot, 'ICONE-HOST.png'))
)
