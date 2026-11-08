import { createContext, useContext, useEffect, useRef } from 'react'

/** A stack of things Escape closes, topmost first: menus above the palette above the panel. */
export interface Layers {
  push(close: () => void): () => void
}

export const LayersContext = createContext<Layers>({ push: () => () => {} })

/** Registers `close` as the topmost Escape target while `active`. */
export function useEscapeLayer(close: () => void, active = true) {
  const layers = useContext(LayersContext)
  const ref = useRef(close)
  ref.current = close
  useEffect(() => (active ? layers.push(() => ref.current()) : undefined), [layers, active])
}
