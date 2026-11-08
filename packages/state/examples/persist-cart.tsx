import { createKitrStore } from '@kitr/state'
import { useState } from 'react'

export const meta = {
  title: 'A cart that survives a reload',
  description:
    'Add a few items, then press Reload. The cart is saved to localStorage under kitr:cart and restored.',
}

interface CartState {
  items: string[]
  add: (item: string) => void
  remove: (index: number) => void
  clear: () => void
}

const [useCart] = createKitrStore<CartState>({ name: 'cart', persist: true }, (set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  remove: (index) => set((s) => ({ items: s.items.filter((_, i) => i !== index) })),
  clear: () => set({ items: [] }),
}))

const fruit = ['Apple', 'Banana', 'Cherry', 'Mango', 'Pear']

export default function PersistCart() {
  const items = useCart((s) => s.items)
  const add = useCart((s) => s.add)
  const remove = useCart((s) => s.remove)
  const clear = useCart((s) => s.clear)
  const [next, setNext] = useState(0)

  return (
    <div className="demo">
      <div className="demo-row">
        <button
          type="button"
          className="demo-button primary"
          onClick={() => {
            add(fruit[next % fruit.length]!)
            setNext((n) => n + 1)
          }}
        >
          Add {fruit[next % fruit.length]}
        </button>
        <button type="button" className="demo-button" onClick={clear} disabled={!items.length}>
          Empty cart
        </button>
      </div>
      <p className="demo-muted">
        {items.length} {items.length === 1 ? 'item' : 'items'} in the cart
      </p>
      <ul className="demo-list">
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same fruit can be added twice
          <li key={i}>
            <span>{item}</span>
            <button
              type="button"
              className="demo-link"
              onClick={() => remove(i)}
              aria-label={`Remove ${item}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
