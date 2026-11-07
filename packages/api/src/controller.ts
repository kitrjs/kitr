import type { Validators } from './types'

/**
 * Controllers are plain classes. Methods receive the HttpContext and return
 * data. Declare validators per method in `static validation`, so both the
 * runtime (validated before the method runs) and the typed client see them.
 *
 *   export default class ProjectsController {
 *     static validation = { store: { body: createProjectSchema } }
 *     async index({ query }: HttpContext) { ... }
 *     async store({ body }: HttpContext<{}, {}, CreateProject>) { ... }
 *   }
 */
export interface ControllerClass {
  new (...args: any[]): object
  /** Validators per method name, e.g. `{ store: { body: schema } }`. */
  validation?: Record<string, Validators>
}

/** A function that imports a controller module, so the file loads on first request. */
export type LazyController = () => Promise<{ default: ControllerClass } | ControllerClass>

/** `[Controller, 'method']` or `[() => import('#controllers/x'), 'method']` */
export type ControllerRef<
  C extends ControllerClass | LazyController = ControllerClass | LazyController,
> = readonly [
  C,
  C extends ControllerClass
    ? MethodNames<InstanceType<C>>
    : C extends LazyController
      ? MethodNames<InstanceType<ResolvedController<C>>>
      : string,
]

/** The controller class behind a class or a lazy import. */
export type ResolvedController<C> = C extends ControllerClass
  ? C
  : C extends LazyController
    ? Awaited<ReturnType<C>> extends { default: infer D }
      ? D extends ControllerClass
        ? D
        : never
      : Awaited<ReturnType<C>> extends ControllerClass
        ? Awaited<ReturnType<C>>
        : never
    : never

/** The names of a class's methods, for checking `[Controller, 'method']` pairs. */
export type MethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T] &
  string

/** What a controller method resolves to: the response type the client sees. */
export type ControllerOutput<C, M extends string> =
  InstanceType<ResolvedController<C>> extends infer I
    ? M extends keyof I
      ? I[M] extends (...args: any[]) => infer R
        ? Awaited<R>
        : never
      : never
    : never

/** The validators a controller declares for one method in `static validation`. */
export type ControllerValidators<C, M extends string> =
  ResolvedController<C> extends { validation: infer V }
    ? M extends keyof V
      ? V[M]
      : undefined
    : undefined

const instances = new WeakMap<ControllerClass, object>()
const resolved = new WeakMap<LazyController, Promise<ControllerClass>>()

/** True for a `[Controller, 'method']` handler. */
export function isControllerRef(handler: unknown): handler is ControllerRef {
  return Array.isArray(handler) && handler.length === 2 && typeof handler[1] === 'string'
}

/** Load a controller class from a class or a lazy import. Cached per import function. */
export async function resolveControllerClass(
  ref: ControllerClass | LazyController,
): Promise<ControllerClass> {
  if (isClass(ref)) return ref
  let p = resolved.get(ref)
  if (!p) {
    p = Promise.resolve(ref()).then((mod) =>
      'default' in mod && typeof mod.default === 'function'
        ? mod.default
        : (mod as ControllerClass),
    )
    resolved.set(ref, p)
  }
  return p
}

/** The single shared instance of a controller class; one per class, reused across requests. */
export function controllerInstance(cls: ControllerClass): object {
  let instance = instances.get(cls)
  if (!instance) {
    instance = new cls()
    instances.set(cls, instance)
  }
  return instance
}

function isClass(fn: unknown): fn is ControllerClass {
  return typeof fn === 'function' && /^class\s/.test(Function.prototype.toString.call(fn))
}
