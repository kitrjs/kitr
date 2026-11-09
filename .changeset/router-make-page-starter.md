---
"@kitr/router": patch
---

`kitr make:page` says what it wrote and what it added (`wrote app/pages/docs/slug.tsx, added .page('/docs/$slug') to app/routes.ts`), and its help shows the quoted form `kitr make:page 'docs/$slug'` so the shell keeps the `$`. The starter home and about pages use the theme token classes (`bg-background`, `text-muted-foreground`, `border-border`) instead of inline styles.
