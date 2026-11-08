import type { FileData, FileFilter, PickedFile } from './index'

const MIME: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
}

/** The MIME type for a file name's extension, e.g. `invoice.pdf` → `application/pdf`. Unknown → `fallback`. */
export function mimeFor(name: string, fallback = 'application/octet-stream'): string {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return MIME[ext] ?? fallback
}

/** Turn any `FileData` into a Blob of the given type. A Blob passes through unchanged. */
export function toBlob(data: FileData, type: string): Blob {
  if (data instanceof Blob) return data
  if (typeof data === 'string') return new Blob([data], { type })
  return new Blob([data as BlobPart], { type })
}

/** Wrap a browser `File` (or any Blob with a name) as a `PickedFile`. */
export function fromFile(file: File, path?: string): PickedFile {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    path,
    text: () => file.text(),
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
    blob: async () => file,
  }
}

/** `'.PNG'`, `'png'` and `' png '` are the same extension; `'*'` and empty ones mean "any". */
export function extensions(filter: FileFilter): string[] {
  return [
    ...new Set(
      filter.extensions
        .map((e) => e.trim().replace(/^\.+/, '').toLowerCase())
        .filter((e) => e && e !== '*'),
    ),
  ]
}

/** The `accept` string an `<input type="file">` needs for a set of filters. */
export function acceptFor(filters: FileFilter[] = []): string {
  return [...new Set(filters.flatMap((f) => extensions(f).map((e) => `.${e}`)))].join(',')
}
