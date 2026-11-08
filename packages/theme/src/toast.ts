/**
 * Toasts go through sonner when it is installed. `toast` degrades to console
 * output otherwise, so a package can call it without forcing the dependency.
 */
type ToastFn = ((message: string, options?: Record<string, unknown>) => unknown) & {
  success: (message: string, options?: Record<string, unknown>) => unknown
  error: (message: string, options?: Record<string, unknown>) => unknown
  info: (message: string, options?: Record<string, unknown>) => unknown
  warning: (message: string, options?: Record<string, unknown>) => unknown
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
  ) => Promise<T>
}

let impl: ToastFn | null = null // kitr-allow-module-state: the page has one toaster: the UI host registers its implementation here

const fallback: ToastFn = Object.assign((message: string) => console.info(`[toast] ${message}`), {
  success: (m: string) => console.info(`[toast:success] ${m}`),
  error: (m: string) => console.error(`[toast:error] ${m}`),
  info: (m: string) => console.info(`[toast:info] ${m}`),
  warning: (m: string) => console.warn(`[toast:warning] ${m}`),
  promise: async <T>(p: Promise<T>) => p,
})

/**
 * Replace what `toast` calls: a function with `success`, `error`, `info`, `warning` and `promise` methods.
 * The theme provider sets sonner's `toast` once it loads; `null` goes back to the console fallback.
 */
export function setToastImplementation(fn: ToastFn | null) {
  impl = fn
}

/**
 * Show a toast: `toast('Saved')`, `toast.success()`, `.error()`, `.info()`, `.warning()` and `.promise()`.
 * Goes to sonner when it is installed and loaded, and to the console otherwise.
 */
export const toast: ToastFn = Object.assign(
  (message: string, options?: Record<string, unknown>) => (impl ?? fallback)(message, options),
  {
    success: (m: string, o?: Record<string, unknown>) => (impl ?? fallback).success(m, o),
    error: (m: string, o?: Record<string, unknown>) => (impl ?? fallback).error(m, o),
    info: (m: string, o?: Record<string, unknown>) => (impl ?? fallback).info(m, o),
    warning: (m: string, o?: Record<string, unknown>) => (impl ?? fallback).warning(m, o),
    promise: <T>(p: Promise<T>, messages: { loading: string; success: string; error: string }) =>
      (impl ?? fallback).promise(p, messages),
  },
)

/** Show a KitrError (or anything) as an error toast with its message. */
export function toastError(error: unknown, fallbackMessage = 'Something went wrong') {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as any).message)
      : fallbackMessage
  toast.error(message)
}
