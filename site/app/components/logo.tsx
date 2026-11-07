import lockup from '#app/assets/lockup.svg?raw'

// The wordmark follows the text colour; the mark keeps its brand colours.
const svg = lockup.replaceAll('#0F1B2B', 'currentColor')

export function Logo({ height = 28 }: { height?: number }) {
  return (
    <span
      className="logo"
      style={{ height, width: (height * 311) / 120 }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: our own static SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
