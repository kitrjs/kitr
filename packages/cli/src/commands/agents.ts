import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineCommand } from 'citty'
import { findProjectRoot } from '../context'

/** One `## kitr: <name>` section of AGENTS.md: its name and its text, heading included. */
export interface AgentsSection {
  name: string
  text: string
}

/** The `## kitr: <name>` sections of an AGENTS.md, in file order. Other `##` headings end one. */
export function agentsSections(source: string): AgentsSection[] {
  const sections: AgentsSection[] = []
  const lines = source.split('\n')
  let current: { name: string; lines: string[] } | undefined
  const close = () => {
    if (current) sections.push({ name: current.name, text: current.lines.join('\n').trimEnd() })
    current = undefined
  }
  for (const line of lines) {
    if (line.startsWith('## ')) {
      close()
      const match = line.match(/^## kitr: (.+?)\s*$/)
      if (match) current = { name: match[1]!, lines: [line] }
    } else current?.lines.push(line)
  }
  close()
  return sections
}

export const agents = defineCommand({
  meta: {
    name: 'agents',
    description:
      "Print the project's AGENTS.md: the rules kitr packages wrote for coding agents. --list names the sections; --section <name> prints one.",
  },
  args: {
    section: { type: 'string', description: 'Print one `## kitr: <name>` section, such as jobs' },
    list: { type: 'boolean', description: 'List the section names' },
  },
  run({ args }) {
    const root = findProjectRoot()
    const file = join(root, 'AGENTS.md')
    if (!existsSync(file))
      throw new Error(
        `No AGENTS.md in ${root}. kitr new writes one, and kitr add adds each package's rules to it.`,
      )
    const source = readFileSync(file, 'utf8')
    if (!args.list && !args.section) {
      console.log(source.trimEnd())
      return
    }
    const sections = agentsSections(source)
    if (args.list) {
      for (const s of sections) console.log(s.name)
      return
    }
    const wanted = String(args.section).replace(/^kitr:\s*/, '')
    const found = sections.find((s) => s.name === wanted)
    if (!found)
      throw new Error(
        `AGENTS.md has no "## kitr: ${wanted}" section. It has: ${sections.map((s) => s.name).join(', ') || 'none'}.`,
      )
    console.log(found.text)
  },
})
