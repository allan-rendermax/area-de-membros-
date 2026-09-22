// Technical image delivery only: resize to approved dimensions and encode WebP.
// Usage: node scripts/prepare-architecture-assets.mjs SOURCE_DIRECTORY
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const source = process.argv[2]
if (!source) throw new Error('Informe a pasta das artes originais.')
const target = resolve('public/themes/arquitetura')
await mkdir(target, { recursive: true })
const assets = [
  ['exec-ecf2fe52-5240-49b1-971b-760a17881684.png', 'hero.webp', 2100, 900],
  ['exec-a28f6b66-c067-4e42-b0dc-9cd36599c773.png', 'atlas.webp', 1000, 1500],
  ['exec-9c380abb-5580-46f0-a1d1-dba569508345.png', 'bonus.webp', 1000, 1500],
]
for (const [filename, output, width, height] of assets) {
  const info = await sharp(resolve(source, filename)).resize(width, height, { fit: 'fill' }).webp({ quality: 90 }).toFile(resolve(target, output))
  console.log(output, info.width, info.height, Math.round(info.size / 1024) + ' KB')
}
