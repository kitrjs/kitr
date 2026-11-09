import { createKitrStore } from '@kitr/state'
import { useState } from 'react'

export const meta = {
  title: 'A cart that survives a reload',
  description: 'Add items, then press Reload. The cart comes back from localStorage.',
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

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const button =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-border bg-background text-foreground'
const primary =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-primary bg-primary text-primary-foreground'
const list =
  'm-0 list-none rounded-[10px] border border-border p-0 empty:hidden [&>li]:flex [&>li]:justify-between [&>li]:border-b [&>li]:border-border [&>li]:px-3 [&>li]:py-2 [&>li:last-child]:border-b-0'
const link = 'cursor-pointer border-0 bg-transparent p-0 text-primary'

export default function PersistCart() {
  const items = useCart((s) => s.items)
  const add = useCart((s) => s.add)
  const remove = useCart((s) => s.remove)
  const clear = useCart((s) => s.clear)
  const [next, setNext] = useState(0)

  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primary}
          onClick={() => {
            add(fruit[next % fruit.length]!)
            setNext((n) => n + 1)
          }}
        >
          Add {fruit[next % fruit.length]}
        </button>
        <button type="button" className={button} onClick={clear} disabled={!items.length}>
          Empty cart
        </button>
      </div>
      <p className="m-0 text-muted-foreground">
        {items.length} {items.length === 1 ? 'item' : 'items'} in the cart
      </p>
      <ul className={list}>
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same fruit can be added twice
          <li key={i}>
            <span>{item}</span>
            <button
              type="button"
              className={link}
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
