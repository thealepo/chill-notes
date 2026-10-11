import { chromium } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const publicDir = join(projectRoot, 'public')
const iconsDir = join(publicDir, 'icons')

const outputs = [
  { source: 'icon-source.svg', output: 'icon-192.png', size: 192, transparent: true },
  { source: 'icon-source.svg', output: 'icon-512.png', size: 512, transparent: true },
  { source: 'icon-maskable-source.svg', output: 'icon-maskable-192.png', size: 192 },
  { source: 'icon-maskable-source.svg', output: 'icon-maskable-512.png', size: 512 },
  { source: 'icon-maskable-source.svg', output: '../apple-touch-icon.png', size: 180 },
]

function pngDimensions(bytes) {
  const signature = bytes.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') throw new Error('Generated file is not a PNG.')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

await mkdir(iconsDir, { recursive: true })
const browser = await chromium.launch({ headless: true })

try {
  for (const item of outputs) {
    const page = await browser.newPage({
      viewport: { width: item.size, height: item.size },
      deviceScaleFactor: 1,
    })
    const svg = await readFile(join(iconsDir, item.source), 'utf8')
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`)
    const outputPath = join(iconsDir, item.output)
    await page.screenshot({ path: outputPath, omitBackground: item.transparent ?? false })
    await page.close()

    const dimensions = pngDimensions(await readFile(outputPath))
    if (dimensions.width !== item.size || dimensions.height !== item.size) {
      throw new Error(`${item.output} is ${dimensions.width}x${dimensions.height}; expected ${item.size}x${item.size}.`)
    }
    console.log(`Generated ${item.output} (${item.size}x${item.size})`)
  }
} finally {
  await browser.close()
}
