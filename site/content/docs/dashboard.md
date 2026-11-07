---
title: A dashboard on an existing API
description: Build a logged-in app with tables and forms against a backend you already have.
---

# A dashboard on an existing API

This guide builds a small admin dashboard for a backend that already exists: users sign in, see a sortable table of projects, and create new ones. It uses the `app` kit, which has everything needed.

## 1. Create the app

```sh
kitr new projects-admin --kit app
```

Point it at your API in `.env`:

```
VITE_API_URL=https://api.example.com
```

No backend yet? The kit includes [Mocks](/packages/mocks), which fakes API responses while you build.

## 2. Sign in

`config/auth.ts` already uses a token adapter that posts to `/sign-in` and reads `/me`. Adjust the paths to match your API, then protect every page under a layout route:

```ts
// app/routes.ts
import { requireAuth } from 'kitr/router'

r.layout('_app', { beforeLoad: requireAuth(), lazy: () => import('./pages/app-layout') }, (app) =>
  app.page('/', { lazy: () => import('./pages/overview') }),
)
```

Wire the token into the HTTP client so every request is signed. See [Auth with the HTTP client](/packages/auth#with-the-http-client).

## 3. Describe the data

```sh
kitr make:queries projects
```

This writes `app/features/projects/queries.ts` with list, detail, create, update and delete, each backed by the HTTP client and wired with cache effects. Adjust the paths and the `Project` type to match your API.

## 4. Show a table

```sh
kitr ui add data-table
```

Then follow [Tables](/packages/table#sorting-and-paging-in-the-url) to bind sorting and paging to the URL. Pass the URL's `page`, `size` and `sort` to your list query so the API returns the right page.

## 5. Create projects

```sh
kitr make:form new-project
```

Point the form's `onSubmit` at the create mutation. When it succeeds, the effect invalidates the project lists and the table refetches. If your API responds `422` with field errors, they appear under the right inputs. See [Forms](/packages/forms).

## 6. Test it

The kit includes [Testing](/packages/testing). `renderWithKitr` renders a component with the app's providers, and the mocks answer its requests:

```sh
npm test
```

## Where to go next

- [Permissions](/packages/auth#permissions): hide the delete button from members.
- [State](/packages/state): remember the user's preferred table density.
