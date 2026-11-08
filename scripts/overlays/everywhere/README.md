# everywhere

One project, three platforms. Same pages, same services.

| Platform | Type | Run | Build |
| --- | --- | --- | --- |
| `site` | web | `kitr dev site` | `kitr build site` |
| `app` | desktop (Electron) | `kitr dev app` | `kitr build app` |
| `phone` | mobile (Capacitor) | `kitr dev phone --target android` | `kitr build phone` |

`kitr dev` runs all three. Output is prefixed with the platform name.

The home page shows:

- the runtime (`useRuntime()`) and the form factor (`useFormFactor()`)
- a note kept in secure storage (the OS vault on Electron and Capacitor)
- a "Notify me" button (`@kitr/notifications`)

Branch on the shell in code:

```ts
if (platform.runtime === 'electron') {
  // desktop only
}
if (import.meta.env.KITR_PLATFORM === 'phone') {
  // phone build only
}
```

See [Platforms](https://kitr.dev/docs/platforms) and [Extending kitr](https://kitr.dev/docs/extending).
