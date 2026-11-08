import { driverUnavailable, loadShellModule } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/** The part of `@tauri-apps/plugin-stronghold` the driver uses. */
interface StrongholdModule {
  Stronghold: { load(path: string, password: string): Promise<Stronghold> }
}
interface Stronghold {
  loadClient(name: string): Promise<Client>
  createClient(name: string): Promise<Client>
  save(): Promise<void>
}
interface Client {
  getStore(): Store
}
interface Store {
  get(key: string): Promise<ArrayLike<number> | null>
  insert(key: string, value: number[]): Promise<void>
  remove(key: string): Promise<unknown>
}

interface PathModule {
  appDataDir(): Promise<string>
}
interface CoreModule {
  invoke<T>(command: string): Promise<T>
}

/** Options of the Tauri secure-storage driver, passed to `createTauriDriver()`. */
export interface TauriSecureStorageOptions extends DriverOptions {
  /**
   * The vault password. Stronghold derives the snapshot key from it, so it must not be a constant
   * in the bundle. Default: the random secret the scaffolded Rust side keeps in the OS keyring,
   * read with `invoke('kitr_vault_key')`.
   */
  password?: () => Promise<string>
  /** The snapshot file inside the app data dir. Default `kitr-vault.hold`. */
  file?: string
  /** The Stronghold client name. Default `kitr`. */
  client?: string
}

const missing = (pkg: string, detail = '') =>
  driverUnavailable(
    'tauri',
    'secure-storage',
    `${pkg} is not installed (run \`npm install ${pkg}\`)${detail}`,
  )

const encode = (text: string) => Array.from(new TextEncoder().encode(text))
const decode = (bytes: ArrayLike<number>) => new TextDecoder().decode(Uint8Array.from(bytes))

/** The key list lives in the vault itself, under one reserved key. */
const INDEX = '__kitr_keys'

/**
 * The secure-storage driver for the Tauri shell, on `@tauri-apps/plugin-stronghold`: an encrypted
 * IOTA Stronghold snapshot in the app data dir, opened with a password that the Rust side keeps in
 * the OS keyring. The plugins are imported on first use and are optional peers; when one is
 * missing, every method rejects with `E_DRIVER_UNAVAILABLE`.
 *
 * Stronghold rather than `plugin-store`: the store plugin writes plain JSON to disk, which is
 * storage, not a vault.
 */
export function createTauriDriver(options: TauriSecureStorageOptions = {}): Driver {
  const file = options.file ?? 'kitr-vault.hold'
  const clientName = options.client ?? 'kitr'
  let opened: Promise<{ hold: Stronghold; store: Store }> | undefined
  const open = () =>
    (opened ??= (async () => {
      let stronghold: StrongholdModule
      try {
        stronghold = await loadShellModule<StrongholdModule>('@tauri-apps/plugin-stronghold')
      } catch {
        throw missing(
          '@tauri-apps/plugin-stronghold',
          ', add tauri-plugin-stronghold in src-tauri and allow stronghold:default',
        )
      }
      let path: PathModule
      let core: CoreModule
      try {
        path = await loadShellModule<PathModule>('@tauri-apps/api/path')
        core = await loadShellModule<CoreModule>('@tauri-apps/api/core')
      } catch {
        throw missing('@tauri-apps/api')
      }
      const password = options.password
        ? await options.password()
        : await core.invoke<string>('kitr_vault_key')
      const dir = (await path.appDataDir()).replace(/[\\/]$/, '')
      const hold = await stronghold.Stronghold.load(`${dir}/${file}`, password)
      let client: Client
      try {
        client = await hold.loadClient(clientName)
      } catch {
        client = await hold.createClient(clientName)
      }
      return { hold, store: client.getStore() }
    })().catch((error) => {
      opened = undefined
      throw error
    }))
  const readIndex = async (store: Store): Promise<string[]> => {
    const raw = await store.get(INDEX)
    return raw ? (JSON.parse(decode(raw)) as string[]) : []
  }
  // Writes are serialised so the key list never loses an entry to a race.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run)
    queue = next.catch(() => {})
    return next
  }
  return {
    name: 'tauri-stronghold',
    secure: true,
    async get(key) {
      const { store } = await open()
      const raw = await store.get(key)
      return raw ? decode(raw) : null
    },
    set: (key, value) =>
      serial(async () => {
        const { hold, store } = await open()
        await store.insert(key, encode(value))
        const keys = await readIndex(store)
        if (!keys.includes(key)) await store.insert(INDEX, encode(JSON.stringify([...keys, key])))
        await hold.save()
      }),
    remove: (key) =>
      serial(async () => {
        const { hold, store } = await open()
        await store.remove(key)
        const keys = (await readIndex(store)).filter((k) => k !== key)
        await store.insert(INDEX, encode(JSON.stringify(keys)))
        await hold.save()
      }),
    async keys() {
      const { store } = await open()
      return readIndex(store)
    },
  }
}
