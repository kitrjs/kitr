# @kitr/router

## 0.4.0

### Patch Changes

- @kitr/core@0.4.0
  - @kitr/react@0.4.0

## 0.3.2

### Patch Changes

- 5d0d0d0: `.root()` takes `{ lazy: () => import('./pages/not-found') }` for `notFoundComponent`, `errorComponent` and `pendingComponent`, the way `.page()` takes `lazy`, so the fallback screens stay out of the first bundle. A plain component still works.
- f0b962a: `RoutePath<typeof routes>` is the union of a route table's page paths, as `<Link to>` takes them, so a nav list from data can be typed instead of widened to `string`. The router guide has a "Links from data" section on why a list of concrete paths such as `/docs/agents` does not type-check against `to`, and how `kitr make:page 'docs/$slug'` names its file.
- 75a3ab6: `kitr make:page` says what it wrote and what it added (`wrote app/pages/docs/slug.tsx, added .page('/docs/$slug') to app/routes.ts`), and its help shows the quoted form `kitr make:page 'docs/$slug'` so the shell keeps the `$`. The starter home and about pages use the theme token classes (`bg-background`, `text-muted-foreground`, `border-border`) instead of inline styles.
- Updated dependencies [8904b74]
  - @kitr/core@0.3.2
  - @kitr/react@0.3.2

## 0.3.1

### Patch Changes

- @kitr/core@0.3.1
  - @kitr/react@0.3.1

## 0.3.0

### Patch Changes

- @kitr/core@0.3.0
  - @kitr/react@0.3.0

## 0.2.1

### Patch Changes

- @kitr/core@0.2.1
  - @kitr/react@0.2.1

## 0.2.0

### Minor Changes

- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.

### Patch Changes

- 1206461: Devtools rebuilt: a bottom sheet on phones and a dock on desktops, light and dark themes, a draggable trigger with a long-press menu, a command palette, a three-finger gesture and a URL flag. The hub gains channels, counts, marks and burst collapse; `@kitr/devtools/ui` is a shared kit for contributed panels; `@kitr/http` logs every request and adds a Network panel; the other panels are rewritten on the kit.
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
  - @kitr/react@0.2.0
