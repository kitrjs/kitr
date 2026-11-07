import { createDefineConfig } from '@kitr/core'

/** What the server returns for every stored file, and what the client resolves with. */
export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  /** Where it can be fetched, when the driver serves files. */
  url?: string
  /** The storage key the driver wrote. */
  key: string
}

export interface UploadRules {
  /** Bytes. Default 10 MiB. */
  maxSize?: number
  /** Allowed MIME types or patterns such as `image/*`. Default: anything. */
  accept?: string[]
  /** Files per request. Default 1. */
  maxFiles?: number
}

export interface UploadsConfig extends UploadRules {
  /** Where files go. Default: `storage/uploads` on disk (`createDiskUploadsDriver`). */
  driver?: unknown
  /** Public URL prefix the driver answers under, e.g. `/uploads`. */
  publicPath?: string
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    uploads: UploadsConfig
  }
}

export const defineConfig = createDefineConfig<UploadsConfig>()

/** `image/*` matches `image/png`; exact types match themselves; `.pdf` matches by extension. */
export function accepts(type: string, name: string, accept?: string[]): boolean {
  if (!accept?.length) return true
  return accept.some((pattern) => {
    if (pattern.startsWith('.')) return name.toLowerCase().endsWith(pattern.toLowerCase())
    if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1))
    return type === pattern
  })
}

export interface UploadOptions {
  /** The endpoint, default `/api/uploads`. */
  url?: string
  /** Form field name, default `file`. */
  field?: string
  /** Extra fields sent with the file. */
  fields?: Record<string, string>
  headers?: Record<string, string>
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void
  signal?: AbortSignal
  /** Sent with credentials (cookies). Default true. */
  credentials?: boolean
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'UploadError'
  }
}

/**
 * Upload one or more files with progress. XMLHttpRequest is the only browser API that reports
 * upload progress, so this is XHR with a promise around it; a fetch fallback runs elsewhere.
 */
export function upload(files: File | File[], options: UploadOptions = {}): Promise<UploadedFile[]> {
  const list = Array.isArray(files) ? files : [files]
  const url = options.url ?? '/api/uploads'
  const field = options.field ?? 'file'
  const form = new FormData()
  for (const [k, v] of Object.entries(options.fields ?? {})) form.append(k, v)
  for (const file of list) form.append(field, file, file.name)
  const parse = (status: number, text: string): UploadedFile[] => {
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    if (status < 200 || status >= 300)
      throw new UploadError((body as any)?.message ?? `Upload failed (${status})`, status, body)
    const data = (body as any)?.files ?? body
    return Array.isArray(data) ? data : [data]
  }
  if (typeof XMLHttpRequest === 'undefined') {
    return fetch(url, {
      method: 'POST',
      body: form,
      headers: options.headers,
      signal: options.signal,
      credentials: options.credentials === false ? 'omit' : 'include',
    }).then(async (res) => parse(res.status, await res.text()))
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = options.credentials !== false
    for (const [k, v] of Object.entries(options.headers ?? {})) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        options.onProgress?.({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        })
    }
    xhr.onload = () => {
      try {
        resolve(parse(xhr.status, xhr.responseText))
      } catch (e) {
        reject(e)
      }
    }
    xhr.onerror = () => reject(new UploadError('Network error during upload', 0))
    xhr.onabort = () => reject(new UploadError('Upload cancelled', 0))
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(form)
  })
}

/** Client-side check against the same rules the server enforces, so errors show before the request. */
export function checkFile(file: File, rules: UploadRules = {}): string | null {
  const maxSize = rules.maxSize ?? 10 * 1024 * 1024
  if (file.size > maxSize) return `${file.name} is larger than ${formatBytes(maxSize)}`
  if (!accepts(file.type, file.name, rules.accept)) return `${file.name} is not an accepted type`
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
