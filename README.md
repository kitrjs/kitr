<p align="center">
  <a href="https://kitr.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/kitr-lockup-white.svg">
      <img src=".github/assets/kitr-lockup.svg" alt="kitr" width="240">
    </picture>
  </a>
</p>

<p align="center"><strong>One way to build everything.</strong></p>

<p align="center">
  <a href="https://kitr.dev">Website</a> ·
  <a href="https://kitr.dev/docs">Docs</a> ·
  <a href="https://kitr.dev/docs/getting-started">Getting started</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/kitr"><img src="https://img.shields.io/npm/v/kitr.svg" alt="npm"></a>
  <a href="https://github.com/kitrjs/kitr/actions/workflows/ci.yml"><img src="https://github.com/kitrjs/kitr/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

kitr is one TypeScript framework for the web, servers, desktop and phones. It wires together the libraries you would pick anyway (TanStack Router and Query, React Hook Form, Zustand, h3, Tailwind) behind one CLI, so you spend your time building instead of choosing.

## Quick start

You need Node.js 22 or newer.

```sh
npm install -g kitr
kitr new my-app --kit app
cd my-app
npm run dev
```

Then add what your app needs, one package at a time:

```sh
kitr add forms
kitr add auth
```

## Learn more

Everything else lives on [kitr.dev](https://kitr.dev):

- [What is kitr](https://kitr.dev/docs/what-is-kitr)
- [Getting started](https://kitr.dev/docs/getting-started)
- [Kits](https://kitr.dev/docs/kits): `app`, `dashboard`, `fullstack`, `server`, `saas` and more
- [Packages](https://kitr.dev/docs/packages) and [platforms](https://kitr.dev/docs/platforms)
- [How kitr compares](https://kitr.dev/docs/compare) to Next.js, Remix, Expo and others
- [Built for agents](https://kitr.dev/docs/agents): conventions and skills for Claude Code, Cursor and Codex

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the setup and the checks CI runs, and [SECURITY.md](SECURITY.md) to report a security issue.

## License

[MIT](LICENSE) © 2026 Platon Podkopov
