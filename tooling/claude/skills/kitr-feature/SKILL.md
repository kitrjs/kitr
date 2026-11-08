---
name: kitr-feature
description: Scaffold one feature of a kitr app end to end with kitr make, from the schema to the pages and a test, then run the checks.
disable-model-invocation: true
argument-hint: <feature-name>
---

# Scaffold a kitr feature

Build the feature named in `$ARGUMENTS` (for example `projects`) end to end. Do not ask questions. Read the project and decide.

## 1. Read the project

```sh
kitr info              # packages, platforms, serverOnly
kitr make --json       # the generators this project has and the path each writes
```

Read `AGENTS.md` and `app/routes.ts`. Look at one existing feature, if there is one, and match it.

Pick the data path from what the project has:

| The project has | Data path |
| --- | --- |
| `server/routes.ts` (a server platform and `@kitr/api`) | A resource controller, plus queries in `app/queries/<feature>.ts` on the typed client in `app/api/client.ts` |
| `@kitr/actions` and no `server/routes.ts` | Server functions in `app/actions/<feature>/` |
| Neither (an external API) | `app/queries/<feature>.ts` over HTTP |

If there is no web platform and the feature needs pages, stop and say so. `kitr add web site` adds one; ask before adding it.

## 2. Generate, in this order

Use a singular name for the schema and form and a plural one for the resource. With `projects`:

1. Schema shared by the form and the server:
   ```sh
   kitr make:validator project
   ```
2. Data, by the path chosen above:
   ```sh
   kitr make:controller projects --resource   # then add the route line it prints to server/routes.ts
   kitr make:queries projects
   ```
   or, with actions:
   ```sh
   kitr make:query projects/list
   kitr make:mutation projects/create
   ```
3. Pages, and a layout only when several pages share a frame:
   ```sh
   kitr make:page projects
   kitr make:page projects/:id
   kitr make:layout projects     # optional
   ```
4. The form:
   ```sh
   kitr make:form project
   ```
5. A test:
   ```sh
   kitr make:test projects
   ```

Use `--dry-run` on any `make:*` command first when you are unsure what it will write. Never pass `--force` over a file you did not just create.

## 3. Fill in the files

- Validate with the schema from `#app/validators/project` in the controller (`static validation`), the action and the form.
- Mutations declare cache `effects` (for example `{ invalidate: [...] }`). Do not invalidate in a component.
- Load list data in the page's route loader in `app/routes.ts`, not in an effect.
- Import from `@kitr/*`, never the upstream library.
- Write the test against the real behaviour: list, create, validation error.

## 4. Check

```sh
kitr types
kitr doctor --json
```

Then run the project's `typecheck` and `test` scripts. Fix every doctor finding with `"level": "error"` and every type or test failure. Rerun until all pass.

## 5. Report

List the files written and changed, the route lines added, and the result of each check.
