// Open Graph images (1200x630) and the apple-touch-icon, rendered at build time with
// satori (layout to SVG) and resvg (SVG to PNG). Glyphs and category colours are read from
// app/lib/catalog.ts so the images always match the site.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import * as hugeicons from '@hugeicons/core-free-icons'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import satori from 'satori'

const require = createRequire(import.meta.url)
const font = (pkg, file) => readFileSync(require.resolve(`@fontsource/${pkg}/files/${file}`))

const fonts = [
  {
    name: 'Instrument Sans',
    data: font('instrument-sans', 'instrument-sans-latin-500-normal.woff'),
    weight: 500,
  },
  {
    name: 'Instrument Sans',
    data: font('instrument-sans', 'instrument-sans-latin-700-normal.woff'),
    weight: 700,
  },
  {
    name: 'JetBrains Mono',
    data: font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'),
    weight: 500,
  },
  { name: 'Asimovian', data: font('asimovian', 'asimovian-latin-400-normal.woff'), weight: 400 },
]

let ready
const init = () => {
  ready ??= initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')))
  return ready
}

const h = (type, style, ...children) => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
})
const img = (src, style) => ({ type: 'img', props: { src, style } })
const svgData = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

/** A Hugeicons icon (array of [tag, attrs]) as an SVG string in one colour. */
function iconSvg(name, color, stroke = 1.5) {
  // biome-ignore lint/performance/noDynamicNamespaceImportAccess: build script, icon chosen by name
  const nodes = hugeicons[name] ?? hugeicons.Package01Icon
  const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
  const body = nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => {
          if (k === 'strokeWidth') v = stroke
          if (v === 'currentColor') v = color
          return `${kebab(k)}="${v}"`
        })
        .join(' ')
      return `<${tag} ${a}/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">${body}</svg>`
}

/** glyph and category colour per package, parsed from the site's catalog. */
export function readCatalog(site) {
  const src = readFileSync(join(site, 'app/lib/catalog.ts'), 'utf8')
  const glyphBlock = src.slice(src.indexOf('const glyphs'), src.indexOf('export const glyph'))
  const glyphs = Object.fromEntries(
    [...glyphBlock.matchAll(/^\s+'?([\w.-]+)'?: (\w+Icon),$/gm)].map((m) => [m[1], m[2]]),
  )
  const colors = Object.fromEntries(
    [...src.matchAll(/^\s+'?([\w-]+)'?: \{ label: '([^']+)', color: '(#[0-9A-Fa-f]{6})' \}/gm)].map(
      (m) => [m[1], { label: m[2], color: m[3] }],
    ),
  )
  return { glyphs, colors }
}

const INK = '#0B121C'
const BLUE = '#2368EE'

/**
 * One card. `kind` is the small label above the title (Docs, Package...), `tile` an optional
 * { icon, color } drawn on the right like the package tiles on the site.
 */
export async function ogImage({ title, description, kind, tile, display = false }, site) {
  await init()
  const lockup = readFileSync(join(site, 'app/assets/lockup.svg'), 'utf8').replace(/#0F1B2B/gi, INK)
  const desc =
    description && description.length > 150 ? `${description.slice(0, 147)}…` : description
  const titleSize = display ? 76 : title.length > 34 ? 60 : 72
  const tree = h(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      background: '#FFFFFF',
      fontFamily: 'Instrument Sans',
      color: INK,
      position: 'relative',
    },
    // brand stripe along the bottom
    h(
      'div',
      { position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, display: 'flex' },
      h('div', { flex: 1, background: BLUE }, ''),
      h('div', { flex: 1, background: '#208046' }, ''),
      h('div', { flex: 1, background: '#D62D2C' }, ''),
    ),
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px 84px',
        width: tile ? 820 : 1200,
      },
      img(svgData(lockup), { height: 56, width: (56 * 311) / 120 }),
      h(
        'div',
        { display: 'flex', flexDirection: 'column', gap: 20 },
        kind
          ? h(
              'div',
              {
                fontFamily: 'JetBrains Mono',
                fontSize: 24,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: '#556273',
              },
              kind,
            )
          : null,
        h(
          'div',
          {
            fontSize: titleSize,
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: -1.5,
            ...(display ? { fontFamily: 'Asimovian', fontWeight: 400, letterSpacing: 0 } : {}),
          },
          title,
        ),
        desc ? h('div', { fontSize: 30, lineHeight: 1.35, color: '#556273' }, desc) : null,
      ),
      h('div', { fontFamily: 'JetBrains Mono', fontSize: 24, color: '#556273' }, 'kitr.dev'),
    ),
    tile
      ? h(
          'div',
          { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: 340 },
          h(
            'div',
            {
              width: 280,
              height: 280,
              borderRadius: 96,
              background: tile.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
            img(svgData(iconSvg(tile.icon, INK, 1.4)), { width: 160, height: 160 }),
          ),
        )
      : null,
  )
  const svg = await satori(tree, { width: 1200, height: 630, fonts })
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}

/** 180px apple-touch-icon: the mark on white with breathing room. */
export async function touchIcon(site) {
  await init()
  const mark = readFileSync(join(site, 'app/assets/mark.svg'), 'utf8')
    .replace('viewBox="0 0 120 120"', 'viewBox="-24 -24 168 168"')
    .replace('<svg ', '<svg width="180" height="180" ')
  const svg = mark.replace(
    /(<svg[^>]*>)/,
    '$1<rect x="-24" y="-24" width="168" height="168" fill="#FFFFFF"/>',
  )
  return new Resvg(svg, { fitTo: { mode: 'width', value: 180 } }).render().asPng()
}
