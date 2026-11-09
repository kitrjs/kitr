import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { agentsSections } from '../src/commands/agents'
import { cleanup, copyExample, kitr, read, scratch } from './helpers'

afterAll(cleanup)

describe('kitr agents', () => {
  let dir: string
  beforeAll(() => {
    dir = copyExample('fullstack')
  })

  it('prints AGENTS.md', async () => {
    const run = await kitr(dir, 'agents')
    expect(run.code).toBeUndefined()
    expect(run.out).toBe(read(dir, 'AGENTS.md').trimEnd())
  })

  it('--list names the sections in file order', async () => {
    const run = await kitr(dir, 'agents', '--list')
    const names = run.out.split('\n')
    expect(names.slice(0, 3)).toEqual(['conventions', 'structure', 'router'])
    expect(names).toContain('server')
  })

  it('--section prints one section, heading included', async () => {
    const run = await kitr(dir, 'agents', '--section', 'structure')
    expect(run.out).toMatch(/^## kitr: structure\n\n- Every kind of file has one home/)
    expect(run.out).not.toMatch(/## kitr: router/)
    const prefixed = await kitr(dir, 'agents', '--section', 'kitr: structure')
    expect(prefixed.out).toBe(run.out)
  })

  it('names the sections when the one asked for is missing', async () => {
    const run = await kitr(dir, 'agents', '--section', 'billing')
    expect(run.code).toBe(1)
    expect(run.err).toMatch(/no "## kitr: billing" section\. It has: conventions, structure, /)
  })

  it('outside a project, names the file it looked for', async () => {
    const empty = scratch()
    const run = await kitr(empty, 'agents')
    expect(run.code).toBe(1)
    expect(run.err).toContain(`No AGENTS.md in ${empty}`)
  })
})

describe('agentsSections', () => {
  it('ends a section at the next ## heading, kitr or not', () => {
    const source =
      '# Agent guide\n\n## kitr: jobs\n\n- Jobs live in server/jobs.\n\n## Team notes\n\nAda reviews.\n\n## kitr: mail\n\n- Mail lives in server/mail.\n'
    expect(agentsSections(source)).toEqual([
      { name: 'jobs', text: '## kitr: jobs\n\n- Jobs live in server/jobs.' },
      { name: 'mail', text: '## kitr: mail\n\n- Mail lives in server/mail.' },
    ])
  })
})
