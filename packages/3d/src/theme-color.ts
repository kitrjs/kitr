import { useEffect, useState } from 'react'

/**
 * Turn any CSS colour (`oklch(55% 0.2 262)`, `color-mix(...)`, a named colour) into the `#rrggbb`
 * three.js understands, by letting the browser paint it. Returns the input when there is no
 * canvas to paint on.
 */
export function toHexColor(value: string): string {
  const color = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase()
  if (typeof document === 'undefined') return color
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return color
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((n) => (n ?? 0).toString(16).padStart(2, '0')).join('')}`
  } catch {
    return color
  }
}

function readVariable(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * The value of a CSS colour variable, ready for a three.js material: `useThemeColor('--kitr-color-primary')`.
 * Re-reads when the theme changes (a `data-theme`, `class` or `style` change on `<html>`, or the
 * system colour scheme), so a scene follows dark mode with the rest of the page. Returns
 * `fallback` on the server and when the variable is not set.
 */
export function useThemeColor(variable: `--${string}`, fallback = '#808080'): string {
  const [color, setColor] = useState(fallback)
  useEffect(() => {
    const update = () => {
      const raw = readVariable(variable)
      setColor(raw ? toHexColor(raw) : fallback)
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    })
    const scheme =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null
    scheme?.addEventListener?.('change', update)
    return () => {
      observer.disconnect()
      scheme?.removeEventListener?.('change', update)
    }
  }, [variable, fallback])
  return color
}
