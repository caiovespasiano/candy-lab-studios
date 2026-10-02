/**
 * Screenshot do app em pontos definidos.
 *
 * Complementa o audit:layout: o script de auditoria mede e aponta numeros,
 * este da para ver. Útil em sessao sem navegador de escritorio, onde nao ha
 * como inspecionar o resultado visual de outra forma.
 *
 * Usa o Chrome ja instalado via puppeteer-core, sem baixar navegador.
 *
 *   npm run shot              todas as telas
 *   npm run shot -- admin     so uma tela
 */

import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const globalBaseUrl = process.env.SHOT_URL || 'http://localhost:5173'
const globalOutputDir = path.resolve('scripts/shots')
const globalAdminCredentials = { username: 'admin', password: 'admin123', verificationCode: '2026' }

const globalChromeCandidates = [
  `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
]

const globalWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function resolveChromePath() {
  const found = globalChromeCandidates.find((candidate) => candidate && fs.existsSync(candidate))
  if (!found) throw new Error('Chrome ou Edge nao encontrado. Defina CHROME_PATH.')
  return found
}

async function openAdminPanel(page) {
  await page.goto(`${globalBaseUrl}/#/painel-admin-interno`, { waitUntil: 'networkidle2' })
  await globalWait(400)

  const needsLogin = await page.$('input[name="username"]')
  if (!needsLogin) return

  await page.type('input[name="username"]', globalAdminCredentials.username)
  await page.type('input[name="password"]', globalAdminCredentials.password)
  await page.type('input[name="verificationCode"]', globalAdminCredentials.verificationCode)
  await page.evaluate(() => {
    const submit = [...document.querySelectorAll('button[type="submit"]')].pop()
    if (submit) submit.click()
  })
  await globalWait(1200)
}

async function openProductModal(page) {
  await page.goto(`${globalBaseUrl}/`, { waitUntil: 'networkidle2' })
  await globalWait(500)
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('button')].find((node) =>
      /abrir detalhes|open details/i.test(node.getAttribute('aria-label') || '')
    )
    if (card) card.click()
  })
  await globalWait(1300)
}

const globalScenes = {
  async landing(page) {
    await page.goto(`${globalBaseUrl}/`, { waitUntil: 'networkidle2' })
    await globalWait(600)
    return { name: 'landing', fullPage: true }
  },

  async login(page) {
    await page.goto(`${globalBaseUrl}/#/painel-admin-interno`, { waitUntil: 'networkidle2' })
    await globalWait(500)
    return { name: 'login' }
  },

  async admin(page) {
    await openAdminPanel(page)
    return { name: 'admin', fullPage: true }
  },

  async articles(page) {
    await openAdminPanel(page)
    return { name: 'admin-artigos', fullPage: true }
  },

  async editor(page) {
    await openAdminPanel(page)
    await page.evaluate(() => {
      const open = [...document.querySelectorAll('button')].find((node) => /novo artigo/i.test(node.textContent))
      if (open) open.click()
    })
    await globalWait(700)
    return { name: 'editor-artigo' }
  },

  async product(page) {
    await openProductModal(page)
    return { name: 'produto', fullPage: false }
  },
}

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))
const sceneNames = requested.length > 0 ? requested : Object.keys(globalScenes)

fs.mkdirSync(globalOutputDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: resolveChromePath(),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  for (const sceneName of sceneNames) {
    const scene = globalScenes[sceneName]
    if (!scene) {
      console.log(`  cena desconhecida: ${sceneName} (disponiveis: ${Object.keys(globalScenes).join(', ')})`)
      continue
    }

    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })

    const shot = await scene(page)
    const filePath = path.join(globalOutputDir, `${shot.name}.png`)
    await page.screenshot({ path: filePath, fullPage: Boolean(shot.fullPage) })

    console.log(`  ${shot.name} -> ${filePath}`)
    await page.close()
  }
} finally {
  await browser.close()
}

console.log(`\n${sceneNames.length} imagem(ns) em ${globalOutputDir}\n`)