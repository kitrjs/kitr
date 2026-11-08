---
title: Overview
description: Turn features on for some users and off for others, with the same answer on the server and in the browser.
order: 0
---

# Feature flags

Feature flags let you merge unfinished work behind a switch, turn a redesign on for 10% of users, or switch a feature off in production without a deploy. The trouble starts when flags are strings checked in a dozen places, the server and the browser disagree about a user's value, and nobody remembers which flags are still live.

`@kitr/flags` declares every flag once, resolves it per user on the server, and hands the browser the same answer.

## What it is

`@kitr/flags` is a typed flag registry with a provider chain. You declare each flag with a default and a type in `config/flags.ts`. Providers decide the value per user: an env variable, a stable percentage rollout, your own rules, or a vendor. On the server, `resolveFlags()` answers for the current request; the answer is embedded in the page so the browser's `useFlag()` starts with the same values and never flickers.

It runs on both sides: React hooks in the browser, `resolveFlags()` on the server. Flags are not permissions: to decide whether a user may delete an invoice, use [auth](/packages/auth). For a value that is the same for everyone in an environment, a [config file](/docs/configuration) is simpler.

## Built on

`@kitr/flags` speaks [OpenFeature](https://openfeature.dev/docs/reference/intro), the vendor-neutral flag standard. Any OpenFeature provider, including LaunchDarkly, Flagsmith, Unleash and the rest, plugs into the chain. Three providers are built in: environment variables, percentage rollouts keyed on the user id, and a rules provider for your own code.

kitr adds the typed declarations, type coercion (`FLAG_MAX_UPLOAD_MB=25` arrives as a number), the per-request resolution on the server so one user's answer never leaks to another, the snapshot the server embeds for the browser, the React hooks and a devtools panel that shows every flag's value and which provider set it.

## Problems it solves

- **Misspelt flag names.** Flags are declared once, so `useFlag('new-dashbord')` is a type error. See [Declare flags](/packages/flags/guide#declare-flags).
- **Shipping half-built features.** Show a feature to some users while the rest see the old one. See [Show a feature to some users](/packages/flags/guide#show-a-feature-to-some-users).
- **Server and browser disagreeing.** The server resolves once per request and sends the snapshot down with the page. See [Send the server's answer to the browser](/packages/flags/guide#send-the-servers-answer-to-the-browser).
- **Flags that change when someone signs in.** Resolve again with the new user and update every hook. See [Resolve again after sign-in](/packages/flags/guide#resolve-again-after-sign-in).
- **Vendor lock-in.** Any OpenFeature provider slots in; your own rules sit beside it. See [Providers](/packages/flags/guide#providers).
- **Dead flags.** Removing a flag from the declaration surfaces every stale check as a type error. See [Retire a flag](/packages/flags/guide#retire-a-flag).

## Further reading

- [Guide](/packages/flags/guide): install, configure and every task.
- [API reference](/packages/flags/api): every export with its signature.
- [OpenFeature](https://openfeature.dev/docs/reference/intro): the standard the providers speak, and the list of vendor providers.
- [Auth](/packages/auth): the user whose id targets rollouts, and permissions proper.
- [Configuration](/docs/configuration): how `config/flags.ts` is loaded.
