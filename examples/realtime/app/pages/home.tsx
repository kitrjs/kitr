const commands = [
  ['kitr make:page <path>', 'add a page'],
  ['kitr add <package>', 'add sign-in, forms, an API and more'],
  ['kitr doctor', 'check the wiring'],
]

export default function HomePage() {
  return (
    <main
      style={{
        colorScheme: 'light dark',
        maxWidth: 640,
        margin: '0 auto',
        padding: 24,
        lineHeight: 1.5,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>realtime is running</h1>
      <p>
        This page is <code>app/pages/home.tsx</code>.
      </p>
      <p>
        Pages are listed in <code>app/routes.ts</code>.
      </p>
      <h2>Next</h2>
      <ul>
        {commands.map(([command, note]) => (
          <li key={command}>
            <code>{command}</code>: {note}
          </li>
        ))}
      </ul>
      <p>
        <a href="https://kitr.dev/docs/getting-started">Getting started</a> |{' '}
        <a href="https://kitr.dev/packages">Packages</a>
      </p>
      <p>
        <code>AGENTS.md</code> in this folder describes the conventions for coding assistants.
      </p>
    </main>
  )
}
