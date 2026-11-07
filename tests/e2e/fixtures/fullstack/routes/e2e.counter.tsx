import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/e2e/counter')({ component: Counter })

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      clicked {count}
    </button>
  )
}
