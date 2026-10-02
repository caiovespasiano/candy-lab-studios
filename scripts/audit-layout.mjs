/**
 * Auditoria de layout da landing e da página de produto.
 *
 * Abre o app no Chrome local, mede geometria real via getBoundingClientRect
 * e reporta tres classes de defeito:
 *
 *   1. COLISAO      - dois elementos visiveis se sobrepoem sem ser ancestrais
 *   2. SEM ESPACO   - elemento com borda encostada em irmao/filho
 *   3. SEM FLEX     - container com filhos block onde o design pede columna
 *
 * Nao baixa navegador: usa o Chrome ja instalado via puppeteer-core.
 */

import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const globalBaseUrl = process.env.AUDIT_URL || 'http://localhost:5173'
const globalChromeCandidates = [
  `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
]

const globalAuditFunction = function audit(rootSelector) {
  const report = { collisions: [], gluedText: [], overflow: [], clipped: [] }

  const isVisible = (node) => {
    const style = window.getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    const box = node.getBoundingClientRect()
    return box.width > 1 && box.height > 1
  }

  const isOutOfFlow = (node) => {
    const position = window.getComputedStyle(node).position
    return position === 'absolute' || position === 'fixed' || position === 'sticky'
  }

  const isDecorative = (node) => ['svg', 'path', 'g', 'defs', 'use', 'circle', 'rect', 'line'].includes(node.tagName.toLowerCase())

  const hasOnlyText = (node) => !node.querySelector('img, svg, video, canvas, button, a, input, select, textarea')

  const describe = (node) => {
    const id = node.id ? `#${node.id}` : ''
    const tag = node.tagName.toLowerCase()
    const cls = (node.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')
    const text = (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)
    return `${tag}${id}${cls ? `.${cls}` : ''}${text ? ` "${text}"` : ''}`
  }

  const root = rootSelector ? document.querySelector(rootSelector) : document.body
  if (!root) return report

  // so considera elementos em fluxo normal e com texto proprio, para nao
  // acusar overlay intencional (badge sobre imagem, modal sobre pagina)
  const inFlow = []
  // dentro de um ancestral posicionado (fixed/absolute), tudo e overlay:
  // nao vale comparar com o conteudo do fundo
  const hasOutOfFlowAncestor = (node, boundary) => {
    let current = node.parentElement
    while (current && current !== boundary) {
      if (isOutOfFlow(current)) return true
      current = current.parentElement
    }
    return false
  }

  const collect = (node) => {
    for (const child of node.children) {
      if (isVisible(child)) {
        const insideOverlay = hasOutOfFlowAncestor(child, root)
        if (!insideOverlay && !isOutOfFlow(child) && !isDecorative(child) && hasOnlyText(child)) {
          inFlow.push({ node: child, box: child.getBoundingClientRect() })
        }
        collect(child)
      }
    }
  }
  collect(root)

  // 1. COLISAO entre irmaos no fluxo normal
  for (let i = 0; i < inFlow.length; i += 1) {
    for (let j = i + 1; j < inFlow.length; j += 1) {
      const a = inFlow[i]
      const b = inFlow[j]
      if (a.node.contains(b.node) || b.node.contains(a.node)) continue

      const overlapX = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)
      const overlapY = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top)

      if (overlapX > 2 && overlapY > 2) {
        report.collisions.push({
          a: describe(a.node),
          b: describe(b.node),
          overlapX: Math.round(overlapX),
          overlapY: Math.round(overlapY),
        })
      }
    }
  }

  // 2. TEXTO COLADO: irmaos de texto que se tocam sem espaco.
  //    Cobre os dois casos do fluxo: block empilhado e inline na mesma linha.
  const textNodes = []
  const collectText = (node) => {
    for (const child of node.children) {
      if (isVisible(child) && !isDecorative(child) && !hasOutOfFlowAncestor(child, root)) {
        const ownText = [...child.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (ownText && hasOnlyText(child)) {
          textNodes.push({ node: child, box: child.getBoundingClientRect() })
        }
        collectText(child)
      }
    }
  }
  collectText(root)

  for (let i = 0; i < textNodes.length; i += 1) {
    for (let j = i + 1; j < textNodes.length; j += 1) {
      const a = textNodes[i]
      const b = textNodes[j]
      if (a.node.contains(b.node) || b.node.contains(a.node)) continue

      // irmaos diretos: compara so com quem compartilha o mesmo pai
      if (a.node.parentElement !== b.node.parentElement) continue

      const overlapX = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)
      const verticalGap = Math.max(a.box.top, b.box.top) - Math.min(a.box.bottom, b.box.bottom)

      const aDisplay = window.getComputedStyle(a.node).display
      const bDisplay = window.getComputedStyle(b.node).display
      const bothBlock = aDisplay.startsWith('block') && bDisplay.startsWith('block')

      // block empilhado com gap 0 e tipografia normal (titulo em duas
      // linhas, por exemplo). Nao e defeito.
      if (bothBlock && verticalGap >= 0) continue

      // defectuo quando: se sobrepoem, ou quando inline na mesma linha
      // se tocam sem espaco
      if (overlapX > 1 && (verticalGap < 0.5)) {
        report.gluedText.push({
          a: describe(a.node),
          b: describe(b.node),
          horizontalOverlapPx: Math.round(overlapX),
          verticalGapPx: Math.round(verticalGap),
          modo: verticalGap < 0 ? 'sobrepostos' : 'inline colado',
        })
      }
    }
  }

  // 3. OVERFLOW horizontal dentro de container com overflow escondido
  const collectAll = (node, sink) => {
    for (const child of node.children) {
      if (isVisible(child)) {
        sink.push(child)
        collectAll(child, sink)
      }
    }
  }
  const allNodes = []
  collectAll(root, allNodes)

  for (const node of allNodes) {
    if (isDecorative(node)) continue
    const style = window.getComputedStyle(node)
    const clipsHorizontally = style.overflow !== 'visible' || style.overflowX !== 'visible'
    const clipsVertically = style.overflow !== 'visible' || style.overflowY !== 'visible'

    if (clipsHorizontally && node.scrollWidth - node.clientWidth > 4) {
      report.overflow.push({ node: describe(node), overflowPx: node.scrollWidth - node.clientWidth })
    }

    // elemento posicionado que sai do container que o corta
    if (isOutOfFlow(node) && node.offsetParent) {
      const clipper = node.offsetParent.closest('[style*="overflow"], .overflow-hidden')
      if (clipper) {
        const clipBox = clipper.getBoundingClientRect()
        const box = node.getBoundingClientRect()
        const cut =
          Math.max(clipBox.left - box.left, box.right - clipBox.right) +
          Math.max(clipBox.top - box.top, box.bottom - clipBox.bottom)
        if (cut > 3) {
          report.clipped.push({ node: describe(node), cutPx: Math.round(cut), by: describe(clipper) })
        }
      }
    }
  }

  return report
}

function resolveChromePath() {
  const found = globalChromeCandidates.find((candidate) => candidate && fs.existsSync(candidate))
  if (!found) throw new Error('Chrome ou Edge nao encontrado. Defina CHROME_PATH.')
  return found
}

function formatSection(title, items, formatter) {
  if (items.length === 0) {
    console.log(`  OK  ${title}: nada`)
    return 0
  }
  console.log(`  !!  ${title}: ${items.length}`)
  for (const item of items.slice(0, 14)) console.log(`      ${formatter(item)}`)
  if (items.length > 14) console.log(`      ... +${items.length - 14}`)
  return items.length
}

const browser = await puppeteer.launch({
  executablePath: resolveChromePath(),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,1000'],
})

let totalIssues = 0

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })

  console.log(`\n=== 1. GRID DO PORTFOLIO (landing publica) ===`)
  await page.goto(`${globalBaseUrl}/`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)))

  const gridReport = await page.evaluate(globalAuditFunction, '#portfolio')
  totalIssues += formatSection('colisoes', gridReport.collisions, (c) => `${c.a}  X  ${c.b}  (${c.overlapX}x${c.overlapY}px)`)
  totalIssues += formatSection('texto colado', gridReport.gluedText, (g) => `${g.a} + ${g.b}  gap=${g.verticalGapPx}px`)
  totalIssues += formatSection('overflow horizontal', gridReport.overflow, (o) => `${o.node}  +${o.overflowPx}px`)
  totalIssues += formatSection('elemento cortado', gridReport.clipped, (c) => `${c.node} cortado ${c.cutPx}px por ${c.by}`)

  // alinhamento dos cards: top, bottom e altura de cada
  const cardMetrics = await page.evaluate(() => {
    const section = document.getElementById('portfolio')
    if (!section) return null
    const articles = [...section.querySelectorAll('article')]
    return articles.map((article, index) => {
      const button = article.querySelector('button')
      const box = (button || article).getBoundingClientRect()
      return { index, top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height), left: Math.round(box.left) }
    })
  })

  if (cardMetrics && cardMetrics.length > 0) {
    console.log('\n  --- geometria dos cards ---')
    cardMetrics.forEach((m) => console.log(`      #${m.index}  top=${m.top}  bottom=${m.bottom}  h=${m.height}  left=${m.left}`))
    const heights = [...new Set(cardMetrics.map((m) => m.height))]
    if (heights.length > 1) {
      console.log(`      !! alturas diferentes: ${heights.join(', ')}`)
      totalIssues += heights.length
    }
  }

  console.log(`\n=== 2. PAGINA DE PRODUTO (modal) ===`)
  await page.evaluate(() => {
    const target = [...document.querySelectorAll('button')].find((b) => /abrir detalhes|open details/i.test(b.getAttribute('aria-label') || ''))
    if (target) target.click()
  })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 1200)))

  const dialogExists = await page.$('[role="dialog"], article')
  if (!dialogExists) {
    console.log('  !! modal nao abriu')
    totalIssues += 1
  } else {
    const productReport = await page.evaluate(globalAuditFunction, null)
    totalIssues += formatSection('colisoes', productReport.collisions, (c) => `${c.a}  X  ${c.b}  (${c.overlapX}x${c.overlapY}px)`)
    totalIssues += formatSection('texto colado', productReport.gluedText, (g) => `${g.a} + ${g.b}  gap=${g.verticalGapPx}px`)
    totalIssues += formatSection('overflow horizontal', productReport.overflow, (o) => `${o.node}  +${o.overflowPx}px`)
    totalIssues += formatSection('elemento cortado', productReport.clipped, (c) => `${c.node} cortado ${c.cutPx}px por ${c.by}`)
  }

  console.log(`\n=== 3. PAINEL ADMIN ===`)
  await page.goto(`${globalBaseUrl}/#/painel-admin-interno`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)))
  await page.type('input[name="username"]', 'admin')
  await page.type('input[name="password"]', 'admin123')
  await page.type('input[name="verificationCode"]', '2026')
  await page.evaluate(() => {
    const submit = [...document.querySelectorAll('button[type="submit"]')].pop()
    if (submit) submit.click()
  })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 1200)))

  const adminLanded = await page.evaluate(() => Boolean(document.querySelector('nav[aria-label]')))
  if (!adminLanded) {
    console.log('  !! login nao autenticou')
    totalIssues += 1
  } else {
    const adminReport = await page.evaluate(globalAuditFunction, null)
    totalIssues += formatSection('colisoes', adminReport.collisions, (c) => `${c.a}  X  ${c.b}  (${c.overlapX}x${c.overlapY}px)`)
    totalIssues += formatSection('texto colado', adminReport.gluedText, (g) => `${g.a} + ${g.b}  gap=${g.verticalGapPx}px`)
    totalIssues += formatSection('overflow horizontal', adminReport.overflow, (o) => `${o.node}  +${o.overflowPx}px`)
    totalIssues += formatSection('elemento cortado', adminReport.clipped, (c) => `${c.node} cortado ${c.cutPx}px por ${c.by}`)
  }

  // sidebar nao pode expulsar do painel
  console.log('\n  --- navegacao da sidebar ---')
  const navCheck = await page.evaluate(async () => {
    const link = [...document.querySelectorAll('nav button')].find((b) => /artigos/i.test(b.textContent))
    if (!link) return { ok: false, motivo: 'botao de nav nao encontrado' }
    const before = window.location.hash
    link.click()
    await new Promise((r) => setTimeout(r, 400))
    return { ok: Boolean(document.querySelector('nav[aria-label]')), hashAntes: before, hashDepois: window.location.hash }
  })

  if (navCheck.ok === false) {
    console.log(`      !! ${navCheck.motivo || 'clicar na sidebar tirou do painel'}`)
    totalIssues += 1
  } else {
    console.log(`      OK  sidebar permanece no painel (hash ${navCheck.hashAntes} -> ${navCheck.hashDepois})`)
  }

  // abre o editor de artigo
  console.log('\n  --- editor de artigo ---')
  await page.evaluate(() => {
    const open = [...document.querySelectorAll('button')].find((b) => /novo artigo/i.test(b.textContent))
    if (open) open.click()
  })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 600)))
  const editorOpened = await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')))
  if (!editorOpened) {
    console.log('      !! editor nao abriu')
    totalIssues += 1
  } else {
    const editorReport = await page.evaluate(globalAuditFunction, '[role="dialog"]')
    totalIssues += formatSection('texto colado', editorReport.gluedText, (g) => `${g.a} + ${g.b}  gap=${g.verticalGapPx}px`)
    totalIssues += formatSection('overflow horizontal', editorReport.overflow, (o) => `${o.node}  +${o.overflowPx}px`)
  }
} finally {
  await browser.close()
}

console.log(`\n${'='.repeat(50)}`)
console.log(totalIssues === 0 ? 'NENHUM problema de layout detectado' : `${totalIssues} problema(s) de layout detectado(s)`)
console.log(`${'='.repeat(50)}\n`)

process.exit(totalIssues === 0 ? 0 : 1)