import { createKitrStore } from '@kitr/state'

interface CartState {
  items: string[]
  add: (item: string) => void
  remove: (index: number) => void
  clear: () => void
}

/** The cart, saved to localStorage as `kitr:cart`. */
export const [useCart] = createKitrStore<CartState>({ name: 'cart', persist: true }, (set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  remove: (index) => set((s) => ({ items: s.items.filter((_, i) => i !== index) })),
  clear: () => set({ items: [] }),
}))
