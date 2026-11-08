import { dirname, relative } from 'node:path'
import * as vscode from 'vscode'
import { knownPackages, platformTypes } from './catalog'
import {
  type Finding,
  findingLocation,
  type GeneratorRow,
  type KitrInfo,
  lineOf,
  parseFindings,
  parseGenerators,
  parseInfo,
  parseMakeOutput,
  parsePlatformsList,
  parseRoutesList,
  summarizeFindings,
} from './cli'
import { generatorNodes, packageNodes, platformNodes, providerNodes, routeNodes } from './model'
import { Project } from './project'
import { parsePageRoutes } from './routes'
import { NodeTree } from './views'

const viewIds = ['platforms', 'packages', 'providers', 'routes', 'generators'] as const
type ViewId = (typeof viewIds)[number]

/** Everything the extension holds while a kitr project is open. */
class Kitr implements vscode.Disposable {
  private project: Project | undefined
  private info: KitrInfo | undefined
  private generators: GeneratorRow[] = []
  private readonly trees = new Map<ViewId, NodeTree>()
  private readonly views = new Map<ViewId, vscode.TreeView<unknown>>()
  private readonly disposables: vscode.Disposable[] = []
  private readonly output = vscode.window.createOutputChannel('kitr')
  private readonly diagnostics = vscode.languages.createDiagnosticCollection('kitr')
  private readonly status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50)
  private watchers: vscode.Disposable[] = []
  private refreshTimer: ReturnType<typeof setTimeout> | undefined
  private refreshing: Promise<void> | undefined

  constructor() {
    for (const id of viewIds) {
      const tree = new NodeTree(() => this.project?.root)
      const view = vscode.window.createTreeView(`kitr.${id}`, {
        treeDataProvider: tree,
        showCollapseAll: id === 'routes',
      })
      this.trees.set(id, tree)
      this.views.set(id, view as vscode.TreeView<unknown>)
      this.disposables.push(tree, view)
    }
    this.status.command = 'kitr.doctor'
    this.status.text = '$(sync~spin) kitr'
    this.disposables.push(this.output, this.diagnostics, this.status)
  }

  /** Pick the project: the folder of the shallowest kitrrc.ts, or the one the user chose. */
  async locate(preferred?: string): Promise<boolean> {
    const found = await vscode.workspace.findFiles('**/kitrrc.ts', '**/node_modules/**', 50)
    const roots = found
      .map((u) => dirname(u.fsPath))
      .sort((a, b) => a.split(/[\\/]/).length - b.split(/[\\/]/).length || a.localeCompare(b))
    const root = preferred && roots.includes(preferred) ? preferred : roots[0]
    await vscode.commands.executeCommand('setContext', 'kitr.projects', roots.length)
    if (!root) return false
    if (this.project?.root !== root) {
      this.project?.dispose()
      this.project = new Project(root, this.output)
      this.watch(root)
    }
    return true
  }

  private watch(root: string): void {
    for (const w of this.watchers) w.dispose()
    this.watchers = []
    const globs = ['kitrrc.ts', 'config/**', 'app/routes.ts', 'server/routes.ts', 'package.json']
    for (const glob of globs) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(root), glob),
      )
      const later = () => this.scheduleRefresh()
      watcher.onDidChange(later)
      watcher.onDidCreate(later)
      watcher.onDidDelete(later)
      this.watchers.push(watcher)
    }
  }

  scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    this.refreshTimer = setTimeout(() => void this.refresh(), 400)
  }

  /** Reload every tree from the CLI and the routes file. */
  refresh(): Promise<void> {
    this.refreshing ??= this.load().finally(() => {
      this.refreshing = undefined
    })
    return this.refreshing
  }

  private async load(): Promise<void> {
    const project = this.project
    if (!project) return
    const infoRun = await project.run(['info'])
    let info: KitrInfo
    try {
      info = parseInfo(infoRun.stdout)
    } catch (error) {
      this.info = undefined
      const reason = infoRun.stderr.trim().split('\n').pop() || (error as Error).message
      for (const id of viewIds) this.trees.get(id)!.set([])
      this.views.get('platforms')!.message =
        `kitr info failed: ${reason}. Is kitr installed (${project.pm} install)?`
      this.status.text = '$(warning) kitr'
      this.status.tooltip = `kitr info failed in ${project.root}. See the kitr output channel.`
      this.status.show()
      return
    }
    this.info = info
    this.views.get('platforms')!.message = undefined
    const hasApi = info.packages.includes('@kitr/api')
    const [makeRun, platformsRun, routesRun] = await Promise.all([
      project.run(['make', '--json']),
      Object.keys(info.platforms).length ? project.run(['platforms']) : undefined,
      hasApi ? project.run(['routes:list']) : undefined,
    ])
    try {
      this.generators = parseGenerators(makeRun.stdout)
    } catch {
      this.generators = []
    }
    const appDir = info.directories.app ?? 'app'
    const routesSource = project.read(`${appDir}/routes.ts`)
    this.trees
      .get('platforms')!
      .set(platformNodes(info, platformsRun ? parsePlatformsList(platformsRun.stdout) : []))
    this.trees.get('packages')!.set(packageNodes(info, project.find))
    this.trees.get('providers')!.set(providerNodes(info, project.read('kitrrc.ts')))
    this.trees.get('routes')!.set(
      routeNodes({
        pages: routesSource ? parsePageRoutes(routesSource) : [],
        api: routesRun && routesRun.code === 0 ? parseRoutesList(routesRun.stdout) : [],
        appDir,
        serverDir: info.directories.server ?? 'server',
        find: project.find,
      }),
    )
    this.trees.get('generators')!.set(generatorNodes(this.generators))
    this.views.get('routes')!.message =
      routesSource || hasApi ? undefined : 'No app/routes.ts and no API routes yet.'
    this.updateStatus()
  }

  private lastFindings: Finding[] | undefined

  private updateStatus(): void {
    if (!this.info) return
    const summary = this.lastFindings ? summarizeFindings(this.lastFindings) : undefined
    this.status.text = `${summary?.errors ? '$(error)' : '$(layers)'} kitr ${this.info.kitr}`
    this.status.color = summary?.errors
      ? new vscode.ThemeColor('statusBarItem.errorForeground')
      : undefined
    this.status.backgroundColor = summary?.errors
      ? new vscode.ThemeColor('statusBarItem.errorBackground')
      : undefined
    this.status.tooltip = `kitr ${this.info.kitr} in ${this.project?.root}\n${
      summary ? `Doctor: ${summary.text}` : 'Click to run kitr doctor'
    }`
    this.status.show()
  }

  // Commands -----------------------------------------------------------------------------------

  private need(): Project | undefined {
    if (!this.project) void vscode.window.showWarningMessage('No kitrrc.ts in this workspace.')
    return this.project
  }

  async open(rel: string, line?: number): Promise<void> {
    const project = this.need()
    if (!project) return
    const doc = await vscode.workspace.openTextDocument(project.path(rel))
    const editor = await vscode.window.showTextDocument(doc, { preview: true })
    if (line !== undefined) {
      const pos = new vscode.Position(line, 0)
      editor.selection = new vscode.Selection(pos, pos)
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter)
    }
  }

  async make(arg?: unknown): Promise<void> {
    const project = this.need()
    if (!project) return
    if (!this.generators.length) await this.refresh()
    let kind = kindOf(arg)
    if (!kind) {
      const pick = await vscode.window.showQuickPick(
        this.generators.map((g) => ({
          label: `make:${g.kind}`,
          description: g.pattern,
          detail: g.definition ?? g.description,
          generator: g.kind,
        })),
        { placeHolder: 'What to make', matchOnDescription: true, matchOnDetail: true },
      )
      kind = pick?.generator
    }
    if (!kind) return
    const row = this.generators.find((g) => g.kind === kind)
    const name = await vscode.window.showInputBox({
      title: `kitr make:${kind}`,
      prompt: row
        ? `Writes ${row.pattern}. A nested name (billing/invoices) makes a feature folder.`
        : undefined,
      placeHolder: '<name>',
      validateInput: (v) => (v.trim() ? undefined : 'A name is required'),
    })
    if (!name?.trim()) return
    const run = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: `kitr make:${kind} ${name}` },
      () => project.run([`make:${kind}`, name.trim()]),
    )
    this.output.appendLine(run.stdout.trimEnd())
    const result = parseMakeOutput(`${run.stdout}\n${run.stderr}`)
    if (run.code !== 0 || !result) {
      void this.fail(`kitr make:${kind} failed`, run.stderr || run.stdout)
      return
    }
    if (result.existed)
      void vscode.window.showWarningMessage(`${result.file} already exists; opened it unchanged.`)
    await this.open(result.file)
    this.scheduleRefresh()
  }

  async addPackage(): Promise<void> {
    const project = this.need()
    if (!project) return
    const installed = new Set(this.info?.packages ?? [])
    const items: Array<vscode.QuickPickItem & { name?: string }> = knownPackages
      .filter((p) => !installed.has(`@kitr/${p.name}`))
      .map((p) => ({ label: p.name, description: p.description, name: p.name }))
    items.push({
      label: 'Other npm package…',
      description: 'Any package that ships a kitr setup module',
    })
    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'kitr add <package>' })
    if (!pick) return
    const name =
      pick.name ??
      (await vscode.window.showInputBox({
        prompt: 'npm package name',
        placeHolder: '@acme/stripe',
      }))
    if (!name?.trim()) return
    project.terminal('kitr', ['add', name.trim()])
  }

  async addPlatform(): Promise<void> {
    const project = this.need()
    if (!project) return
    const pick = await vscode.window.showQuickPick(
      platformTypes.map((p) => ({ label: p.type, description: p.description, platform: p })),
      { placeHolder: 'kitr add <type> <name>' },
    )
    if (!pick) return
    const taken = Object.keys(this.info?.platforms ?? {})
    const name = await vscode.window.showInputBox({
      title: `kitr add ${pick.label}`,
      prompt: 'The platform name: kitr dev <name> runs it',
      value: taken.includes(pick.platform.name) ? '' : pick.platform.name,
      validateInput: (v) =>
        !/^[a-z][\w-]*$/.test(v.trim())
          ? 'Lowercase letters, digits and dashes'
          : taken.includes(v.trim())
            ? `${v.trim()} already exists`
            : undefined,
    })
    if (!name?.trim()) return
    project.terminal('kitr', ['add', pick.label, name.trim()])
  }

  async platformTask(task: 'dev' | 'build' | 'start', arg?: unknown): Promise<void> {
    const project = this.need()
    if (!project) return
    let name = platformOf(arg)
    const names = Object.keys(this.info?.platforms ?? {})
    if (!name && names.length > 1) {
      const pick = await vscode.window.showQuickPick(['(all)', ...names], {
        placeHolder: `kitr ${task} <platform>`,
      })
      if (!pick) return
      name = pick === '(all)' ? undefined : pick
    } else if (!name) name = names[0]
    project.terminal(`kitr ${task}${name ? ` ${name}` : ''}`, name ? [task, name] : [task])
  }

  async doctor(quiet = false): Promise<void> {
    const project = this.need()
    if (!project) return
    const run = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'kitr doctor' },
      () => project.run(['doctor', '--json']),
    )
    let findings: Finding[]
    try {
      findings = parseFindings(run.stdout)
    } catch {
      if (!quiet) void this.fail('kitr doctor failed', run.stderr || run.stdout)
      return
    }
    this.lastFindings = findings
    this.publish(project, findings)
    this.updateStatus()
    if (quiet) return
    const summary = summarizeFindings(findings)
    const show = summary.errors
      ? vscode.window.showErrorMessage
      : summary.warnings
        ? vscode.window.showWarningMessage
        : vscode.window.showInformationMessage
    const action = await show(
      `kitr doctor: ${summary.text}`,
      ...(findings.length ? ['Show Problems'] : []),
    )
    if (action) await vscode.commands.executeCommand('workbench.actions.view.problems')
  }

  /** Doctor findings as diagnostics on the file each one names, else on kitrrc.ts. */
  private publish(project: Project, findings: Finding[]): void {
    this.diagnostics.clear()
    const byFile = new Map<string, vscode.Diagnostic[]>()
    for (const f of findings) {
      const at = findingLocation(f)
      const file = at.file && project.exists(at.file) ? at.file : 'kitrrc.ts'
      const line = lineOf(project.read(file) ?? '', at.file ? undefined : at.needle)
      const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)
      const severity =
        f.level === 'error'
          ? vscode.DiagnosticSeverity.Error
          : f.level === 'warn'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information
      const d = new vscode.Diagnostic(
        range,
        f.fix ? `${f.message}\nfix: ${f.fix}` : f.message,
        severity,
      )
      d.source = 'kitr doctor'
      byFile.set(file, [...(byFile.get(file) ?? []), d])
    }
    for (const [file, list] of byFile)
      this.diagnostics.set(vscode.Uri.file(project.path(file)), list)
  }

  async types(): Promise<void> {
    const project = this.need()
    if (!project) return
    const run = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'kitr types' },
      () => project.run(['types']),
    )
    this.output.appendLine(run.stdout.trimEnd())
    if (run.code !== 0) void this.fail('kitr types failed', run.stderr || run.stdout)
    else void vscode.window.showInformationMessage('kitr types: .kitr/ is up to date')
  }

  async openAgents(): Promise<void> {
    const project = this.need()
    if (!project) return
    if (!project.exists('AGENTS.md')) {
      void vscode.window.showWarningMessage('This project has no AGENTS.md. kitr new writes one.')
      return
    }
    await this.open('AGENTS.md')
  }

  async selectProject(): Promise<void> {
    const found = await vscode.workspace.findFiles('**/kitrrc.ts', '**/node_modules/**', 50)
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
    const pick = await vscode.window.showQuickPick(
      found.map((u) => ({
        label: relative(folder, dirname(u.fsPath)) || '.',
        root: dirname(u.fsPath),
      })),
      { placeHolder: 'Which kitr project' },
    )
    if (!pick) return
    await this.locate(pick.root)
    await this.refresh()
  }

  private async fail(title: string, detail: string): Promise<void> {
    this.output.appendLine(detail.trimEnd())
    const last = detail.trim().split('\n').filter(Boolean).pop() ?? ''
    const action = await vscode.window.showErrorMessage(
      `${title}${last ? `: ${last}` : ''}`,
      'Show Output',
    )
    if (action) this.output.show()
  }

  dispose(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    for (const w of this.watchers) w.dispose()
    this.project?.dispose()
    for (const d of this.disposables) d.dispose()
  }
}

/** A generator kind from a command argument: a kind string or a Generators tree node. */
function kindOf(arg: unknown): string | undefined {
  if (typeof arg === 'string') return arg
  const id = (arg as { id?: unknown } | undefined)?.id
  return typeof id === 'string' && id.startsWith('generator:')
    ? id.slice('generator:'.length)
    : undefined
}

/** A platform name from a command argument: a name or a Platforms tree node. */
function platformOf(arg: unknown): string | undefined {
  if (typeof arg === 'string') return arg
  const id = (arg as { id?: unknown } | undefined)?.id
  return typeof id === 'string' && id.startsWith('platform:')
    ? id.slice('platform:'.length)
    : undefined
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const kitr = new Kitr()
  context.subscriptions.push(kitr)
  const command = (id: string, fn: (...args: any[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn))
  command('kitr.open', (rel: string, line?: number) => kitr.open(rel, line))
  command('kitr.make', (arg?: unknown) => kitr.make(arg))
  command('kitr.addPackage', () => kitr.addPackage())
  command('kitr.addPlatform', () => kitr.addPlatform())
  command('kitr.dev', (arg?: unknown) => kitr.platformTask('dev', arg))
  command('kitr.build', (arg?: unknown) => kitr.platformTask('build', arg))
  command('kitr.start', (arg?: unknown) => kitr.platformTask('start', arg))
  command('kitr.doctor', () => kitr.doctor())
  command('kitr.types', () => kitr.types())
  command('kitr.openAgents', () => kitr.openAgents())
  command('kitr.selectProject', () => kitr.selectProject())
  command('kitr.refresh', async () => {
    await kitr.locate()
    await kitr.refresh()
  })
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      if (await kitr.locate()) kitr.scheduleRefresh()
    }),
  )
  if (!(await kitr.locate())) return
  await kitr.refresh()
  if (vscode.workspace.getConfiguration('kitr').get<boolean>('doctorOnOpen', true)) {
    // Quietly: only the status bar and the Problems panel change.
    void kitr.doctor(true)
  }
}

export function deactivate(): void {}
