import { describe, expect, it } from 'vitest'
import setup from '../src/kitr'

const page = setup.generators.page
const project = { rc: { directories: { app: 'app' }, packages: [], providers: [], platforms: {} } }

describe('make:page', () => {
  it('keeps a $param in the route and drops the $ from the file name', () => {
    expect(page.target('docs/$slug', project as any, {})).toEqual({
      file: 'app/pages/docs/slug.tsx',
      vars: { path: '/docs/$slug', name: 'DocsSlug', module: './pages/docs/slug' },
    })
  })

  it('reads a :param as a $param', () => {
    expect(page.target('/projects/:id/', project as any, {}).vars).toMatchObject({
      path: '/projects/$id',
      module: './pages/projects/id',
    })
  })

  it('says what it wrote and what it added to the route table', async () => {
    const lines: string[] = []
    const log = { success: (m: string) => lines.push(m), warn: (m: string) => lines.push(m) }
    const ctx = { ...project, log, routes: { addPage: () => true } }
    const { file, vars } = page.target('docs/$slug', project as any, {})
    await page.after!(ctx as any, { file, vars: { name: 'docs/$slug', ...vars } })
    expect(lines).toEqual([
      "wrote app/pages/docs/slug.tsx, added .page('/docs/$slug') to app/routes.ts",
    ])
  })

  it("shows the quoted form in its help, so the shell keeps the '$'", () => {
    expect(page.description).toContain("kitr make:page 'docs/$slug'")
  })
})
