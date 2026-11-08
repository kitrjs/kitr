# mobile

Built with [kitr](https://kitr.dev) from the `mobile` kit.

## Run it

```sh
pnpm run dev          # start the dev server
pnpm run build        # build for production
pnpm run start        # run the production build
pnpm run test         # run the tests
pnpm run typecheck    # check the types
```

## Where things live

- `kitrrc.ts`: the wiring: packages, providers and platforms
- `config/`: one file per package
- `app/routes.ts`: the page list
- `app/pages/`: page components
- `AGENTS.md`: conventions for coding assistants

## Add things

- `kitr add <package>`: add sign-in, forms, an API and more
- `kitr make:page <path>`: add a page
- `kitr ui add <component>`: add a UI component

Run `kitr --help` for every command.

Docs: https://kitr.dev/docs/getting-started
Packages: https://kitr.dev/packages
