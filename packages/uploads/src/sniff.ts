/**
 * The content type of a file from its first bytes, for formats that have a signature; undefined
 * for everything else (text formats, SVG, HTML and unknown binaries have none).
 *
 * Uploads are served with the sniffed type, never the one the uploader declared: a browser trusts
 * whatever the server says, so a declared `image/png` over HTML bytes would otherwise run as the site.
 */
export function sniffType(data: Uint8Array): string | undefined {
  const at = (offset: number, ...bytes: number[]) =>
    bytes.every((byte, i) => data[offset + i] === byte)
  const ascii = (offset: number, text: string) =>
    [...text].every((char, i) => data[offset + i] === char.charCodeAt(0))

  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif'
  if (ascii(0, 'RIFF')) {
    if (ascii(8, 'WEBP')) return 'image/webp'
    if (ascii(8, 'WAVE')) return 'audio/wav'
    if (ascii(8, 'AVI ')) return 'video/x-msvideo'
  }
  if (at(0, 0x42, 0x4d) && data.length > 14) return 'image/bmp'
  if (at(0, 0x00, 0x00, 0x01, 0x00)) return 'image/x-icon'
  if (ascii(0, '%PDF-')) return 'application/pdf'
  // ISO base media: `....ftyp<brand>`.
  if (ascii(4, 'ftyp')) {
    if (ascii(8, 'avif') || ascii(8, 'avis')) return 'image/avif'
    if (ascii(8, 'heic') || ascii(8, 'heix') || ascii(8, 'mif1')) return 'image/heic'
    if (ascii(8, 'M4A ')) return 'audio/mp4'
    if (ascii(8, 'qt  ')) return 'video/quicktime'
    return 'video/mp4'
  }
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm'
  if (ascii(0, 'OggS')) return 'audio/ogg'
  if (ascii(0, 'fLaC')) return 'audio/flac'
  if (ascii(0, 'ID3') || (data[0] === 0xff && ((data[1] ?? 0) & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (at(0, 0x50, 0x4b, 0x03, 0x04) || at(0, 0x50, 0x4b, 0x05, 0x06)) return 'application/zip'
  if (at(0, 0x1f, 0x8b)) return 'application/gzip'
  if (at(0, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return 'application/x-7z-compressed'
  if (ascii(0, 'Rar!')) return 'application/vnd.rar'
  if (ascii(0, 'wOF2')) return 'font/woff2'
  if (ascii(0, 'wOFF')) return 'font/woff'
  if (ascii(0, 'OTTO')) return 'font/otf'
  if (at(0, 0x00, 0x01, 0x00, 0x00, 0x00)) return 'font/ttf'
  return undefined
}

/** Whether a MIME type matches one of `patterns` (`text/csv`, `text/*`). Parameters such as `; charset=utf-8` are ignored. */
export function matchesType(type: string, patterns: readonly string[]): boolean {
  const bare = type.split(';')[0]!.trim().toLowerCase()
  return patterns.some((pattern) => {
    const p = pattern.toLowerCase()
    return p.endsWith('/*') ? bare.startsWith(p.slice(0, -1)) : bare === p
  })
}
