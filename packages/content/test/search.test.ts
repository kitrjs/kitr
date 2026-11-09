import { describe, expect, it } from 'vitest'
import { defineConfig, type SearchEntry, search } from '../src'

const entry = (url: string, title: string, heading = '', text = ''): SearchEntry => ({
  url,
  title,
  section: 'Docs',
  heading,
  text,
})

const entries: SearchEntry[] = [
  entry('/docs/deploy', 'Deploy', '', 'Ship the static build to any host.'),
  entry('/docs/deploy#static', 'Deploy', 'Static hosts', 'Upload dist/site/client.'),
  entry('/docs/deploy#docker', 'Deploy', 'Docker', 'A static image with nginx.'),
  entry('/docs/deploy#fly', 'Deploy', 'Fly', 'Static files on fly.io.'),
  entry('/docs/writing', 'Writing pages', '', 'Frontmatter, callouts and static code captions.'),
  entry('/docs/writing#callouts', 'Writing pages', 'Callouts', 'Deploy notes as warnings.'),
  entry('/docs/cli', 'CLI', '', 'Every command.'),
]

describe('search', () => {
  it('ranks title over heading over text', () => {
    const hits = search(entries, 'deploy').map((e) => e.url)
    expect(hits[0]).toBe('/docs/deploy')
    expect(hits).toContain('/docs/writing#callouts')
  })

  it('needs every word to match', () => {
    expect(search(entries, 'static docker').map((e) => e.url)).toEqual(['/docs/deploy#docker'])
    expect(search(entries, 'static nothing')).toEqual([])
  })

  it('puts an exact title first', () => {
    expect(search(entries, 'cli')[0]!.url).toBe('/docs/cli')
    expect(search(entries, 'Writing pages')[0]!.url).toBe('/docs/writing')
  })

  it('returns at most two hits per page and respects the limit', () => {
    const hits = search(entries, 'static')
    expect(hits.filter((e) => e.url.startsWith('/docs/deploy'))).toHaveLength(2)
    expect(search(entries, 'static', 1)).toHaveLength(1)
  })

  it('returns nothing for an empty query', () => {
    expect(search(entries, '   ')).toEqual([])
  })
})

describe('defineConfig', () => {
  it('returns the config as written', () => {
    const config = defineConfig({ collections: { docs: { source: 'content/docs', url: '/docs' } } })
    expect(config.collections.docs.url).toBe('/docs')
  })
})
