---
title: Overview
description: Load data from your API, keep it cached, and refresh it when something changes.
order: 0
---

# Query

Most screens show data that lives on a server: a list of orders, one invoice, the projects a team owns. Fetching it is one line. Keeping it cached so going back is instant, refreshing it after a save, updating every screen that shows it, and showing errors the same way everywhere is where most frontend code goes.

`@kitr/query` loads that data, caches it and refreshes it, and gives every data source in kitr the same contract.

## What it is

`@kitr/query` is the data layer of a kitr app. You describe each piece of data once with `queryFrom`, `mutationFrom` and `subscriptionFrom`, and components read it with `useQuery` and change it with `useMutation`. A mutation declares its cache effects, so every screen showing the changed data updates without manual refetching. Every source, whether a REST API through [http](/packages/http), your own [API routes](/packages/api), [server actions](/packages/actions) or [realtime](/packages/realtime) channels, plugs into the same contract, and every failure arrives as one `KitrError`.

It runs in the browser, and on the server while a page renders. For values only the browser owns, such as a cart or a sidebar toggle, use [state](/packages/state) instead.

## Built on

`@kitr/query` is [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), re-exported unchanged. `useQuery`, `useInfiniteQuery`, `QueryClient`, hydration and devtools work exactly as TanStack documents them, imported from `@kitr/query`.

| What kitr adds | Why |
| --- | --- |
| `queryFrom`, `mutationFrom`, `subscriptionFrom` | One contract for every data source, with typed keys and inputs. |
| `CacheEffect` and `applyCacheEffect` | A mutation declares what it changed (`set`, `invalidate`, `remove`) and the cache applies it. |
| `createQueryClient` | TanStack Query's client with kitr's defaults, error handling and server-rendering wiring. |
| `KitrError` | One error type from every source, with codes and field errors forms understand. |
| A registry | `useQuery('orders.list')` by name, typed from the sources you defined. |

## Problems it solves

- **Refetching by hand after a save.** Declare `effects` on the mutation and every screen updates. See [Refresh what a mutation changed](/packages/query/guide#refresh-what-a-mutation-changed).
- **Data that arrives after the page.** Loaders fill the cache before the page renders. See [Load data before the page renders](/packages/query/guide#load-data-before-the-page-renders).
- **Slow saves that feel slow.** Update the screen before the server answers and roll back on failure. See [Update the screen before the server answers](/packages/query/guide#update-the-screen-before-the-server-answers).
- **Cache keys invented per call site.** Key factories give each resource one naming scheme. See [Name cache entries with keys](/packages/query/guide#name-cache-entries-with-keys).
- **Live updates that bypass the cache.** Subscriptions write into the same cache the components read. See [Subscribe to live updates](/packages/query/guide#subscribe-to-live-updates).
- **Errors handled differently per source.** Every failure is a `KitrError`. See [Handle errors](/packages/query/guide#handle-errors).

## Further reading

- [Guide](/packages/query/guide): install, configure and every task.
- [API reference](/packages/query/api): every export with its signature.
- [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/overview): everything there works as written.
- [HTTP](/packages/http), [Actions](/packages/actions), [API](/packages/api) and [Realtime](/packages/realtime): the sources that plug into the contract.
- [Loading and saving data](/docs/data): how every kitr data source shares one contract.
