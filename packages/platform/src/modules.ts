/** Loads one optional module, such as `() => import('@tauri-apps/plugin-dialog')`. */
export type ModuleLoader = () => Promise<unknown>

const KEY = Symbol.for('kitr.shellModules')

/** One map for the whole page, even when two copies of this package are bundled. */
function registry(): Map<string, ModuleLoader> {
  const scope = globalThis as unknown as Record<symbol, Map<string, ModuleLoader> | undefined>
  scope[KEY] ??= new Map()
  return scope[KEY] as Map<string, ModuleLoader>
}

/**
 * Register loaders for the optional packages a native shell's drivers import lazily (the Tauri
 * plugins, say). A shell's provider calls this with literal `import('...')` expressions, so the
 * app's bundler sees and bundles them; the device packages then ask for them by name with
 * `loadShellModule()` and never name an optional package in code that every app bundles.
 */
export function registerShellModules(loaders: Record<string, ModuleLoader>): void {
  for (const [specifier, load] of Object.entries(loaders)) registry().set(specifier, load)
}

/**
 * Load an optional module by specifier: through the loader a shell registered, else a plain
 * dynamic `import()` (which works under Node and in tests, and fails in a bundled page where
 * nothing registered it). Rejects when the module cannot be loaded; callers turn that into
 * `driverUnavailable()` with the install instructions.
 */
export async function loadShellModule<T = unknown>(specifier: string): Promise<T> {
  const load = registry().get(specifier)
  if (load) return (await load()) as T
  return (await import(/* @vite-ignore */ specifier)) as T
}
