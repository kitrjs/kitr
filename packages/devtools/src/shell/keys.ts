/**
 * Whether a key event is the configured toggle. A string is the key with Ctrl/Cmd+Shift; an array
 * is the exact combination, where `Meta` matches Ctrl or Cmd.
 */
export function matchShortcut(e: KeyboardEvent, shortcut: string | string[] = 'k'): boolean {
  const key = (e.key ?? '').toLowerCase()
  if (typeof shortcut === 'string')
    return (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && key === shortcut.toLowerCase()
  let meta = false
  let ctrl = false
  let shift = false
  let alt = false
  let target = ''
  for (const part of shortcut) {
    const p = part.toLowerCase()
    if (p === 'meta' || p === 'cmd') meta = true
    else if (p === 'ctrl' || p === 'control') ctrl = true
    else if (p === 'shift') shift = true
    else if (p === 'alt' || p === 'option') alt = true
    else target = p
  }
  if (!target || key !== target) return false
  const modifier = meta ? e.ctrlKey || e.metaKey : ctrl ? e.ctrlKey : !(e.ctrlKey || e.metaKey)
  return modifier && e.shiftKey === shift && e.altKey === alt
}
