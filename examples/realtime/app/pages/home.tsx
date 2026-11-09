const commands = [
  ['kitr make:page <path>', 'add a page'],
  ['kitr add <package>', 'add sign-in, forms, an API and more'],
  ['kitr doctor', 'check the wiring'],
]

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 bg-background p-6 leading-relaxed text-foreground">
      <h1 className="text-3xl font-semibold tracking-tight">realtime is running</h1>
      <p className="text-muted-foreground">
        This page is <code>app/pages/home.tsx</code>.
      </p>
      <p className="text-muted-foreground">
        Pages are listed in <code>app/routes.ts</code>.
      </p>
      <h2 className="text-xl font-semibold">Next</h2>
      <ul className="divide-y divide-border rounded-md border border-border">
        {commands.map(([command, note]) => (
          <li key={command} className="flex flex-wrap gap-x-3 px-4 py-2">
            <code className="font-mono text-sm">{command}</code>
            <span className="text-muted-foreground">{note}</span>
          </li>
        ))}
      </ul>
      <p className="flex gap-4">
        <a className="underline underline-offset-4" href="https://kitr.dev/docs/getting-started">
          Getting started
        </a>
        <a className="underline underline-offset-4" href="https://kitr.dev/packages">
          Packages
        </a>
      </p>
      <p className="text-sm text-muted-foreground">
        <code>AGENTS.md</code> in this folder describes the conventions for coding assistants.
      </p>
    </main>
  )
}
