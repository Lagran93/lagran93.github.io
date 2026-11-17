#!/usr/bin/env node
// Mirror the authoritative manuals from the Lagran source repository into
// docs/reference/ so the site can never drift into stale copies or dead links.
//
// Source priority:
//   1. LAGRAN_SOURCE_DIR (CI checkout of Lagran93/Lagran)
//   2. ../lagran                         (default local layout)
//
// The source docs use plain relative Markdown links (../README.md, images in
// the same folder), which the site cannot serve. Only whitelisted manuals are
// copied; every other relative link is rewritten to a stable GitHub URL so a
// reader always lands on the file that matches the source commit.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = resolve(HERE, '..')
const OUT_DIR = join(SITE_ROOT, 'docs', 'reference')

const REPO = 'Lagran93/Lagran'
const BRANCH = 'main'

function resolveSource() {
  const candidates = [
    process.env.LAGRAN_SOURCE_DIR,
    resolve(SITE_ROOT, '..', 'lagran'),
  ].filter(Boolean)
  for (const dir of candidates) {
    if (existsSync(join(dir, 'docs'))) return dir
  }
  return null
}

const source = resolveSource()
if (!source) {
  console.error('[docs:sync] Lagran source repository not found.')
  console.error('[docs:sync] Set LAGRAN_SOURCE_DIR=/path/to/Lagran and retry.')
  process.exit(1)
}

const docsDir = join(source, 'docs')
const copied = []

function frontmatterWarning(title) {
  return `---\ntitle: ${JSON.stringify(title)}\n---\n\n::: tip 自动同步\n本页由 \`scripts/sync-reference.mjs\` 从主仓库 \`${REPO}/docs\` 同步生成，请勿在此手工修改。\n修改请提交到主仓库后重新执行 \`npm run docs:sync\`。\n:::\n`
}

// Rewrite relative Markdown/image links to GitHub URLs.
function rewriteLinks(markdown) {
  const githubBase = `https://github.com/${REPO}/blob/${BRANCH}/docs/`
  const rawBase = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/docs/`

  return markdown.replace(/(!?)\[([^\]]*)\]\((\.{0,2}\/?[^)\s]+)\)/g, (match, bang, text, target) => {
    if (/^(https?:|mailto:|#|\/)/.test(target)) return match
    const [path, anchor = ''] = target.split('#')
    const suffix = anchor ? `#${anchor}` : ''
    if (path.startsWith('../')) {
      return `${bang}[${text}](https://github.com/${REPO}/blob/${BRANCH}/${path.replace(/^\.\.\//, '')}${suffix})`
    }
    const base = bang ? rawBase : githubBase
    return `${bang}[${text}](${base}${path.replace(/^\.\//, '')}${suffix})`
  })
}

mkdirSync(OUT_DIR, { recursive: true })

// 1. Copy the whitelisted manuals with link rewriting.
//
// `todo-bug.md`, `security-review-*.md` and `reviews/` are internal engineering
// notes (roadmaps, unfixed findings, benchmark scratch files). They are linked
// from GitHub on purpose and must not be republished as user-facing docs.
const manuals = [
  ['manual.md', '使用与调试手册'],
  ['deployment.md', '完整部署手册'],
  ['development.md', '开发指南'],
  ['architecture.md', '架构说明'],
  ['geodns.md', 'GeoDNS 流程'],
  ['alerting.md', '告警建议'],
  ['request-pipeline-migration.md', '请求流水线迁移'],
  ['Origin Shield配置.md', 'Origin Shield 配置'],
]

for (const [file, title] of manuals) {
  const src = join(docsDir, file)
  if (!existsSync(src)) {
    console.warn(`[docs:sync] skip missing ${file}`)
    continue
  }
  const body = rewriteLinks(readFileSync(src, 'utf8'))
  writeFileSync(join(OUT_DIR, file), `${frontmatterWarning(title)}\n${body}`)
  copied.push(file)
}

// 2. Copy images referenced by the manuals so they render locally.
const images = readdirSync(docsDir).filter((name) => /\.(png|jpe?g|svg|gif|webp)$/i.test(name))
for (const image of images) {
  copyFileSync(join(docsDir, image), join(OUT_DIR, image))
  copied.push(image)
}

console.log(`[docs:sync] source: ${docsDir}`)
console.log(`[docs:sync] copied ${copied.length} file(s) to docs/reference/`)
