import { createFileRoute, notFound } from '@tanstack/react-router'
import { type ComponentType, useEffect, useState } from 'react'
import { storagePrefix } from '#app/components/live-example'

const examples = import.meta.glob<{ default: ComponentType }>(
  '../../../../../packages/*/examples/*.tsx',
)
const keyFor = (pkg: string, example: string) =>
  `../../../../../packages/${pkg}/examples/${example}.tsx`

export const Route = createFileRoute('/play/$pkg/$example')({
  beforeLoad: ({ params }) => {
    if (!examples[keyFor(params.pkg, params.example)]) throw notFound()
  },
  head: () => ({
    meta: [
      { title: 'kitr example' },
      { name: 'description', content: 'A live kitr example, running in your browser.' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Play,
})

/**
 * Give this frame its own corner of localStorage before the example's code runs, so stores
 * created at import time already see the prefix. Storage.prototype belongs to this frame's
 * window, so the parent page is unaffected.
 */
function namespaceStorage(prefix: string) {
  const proto = Storage.prototype as Storage & { __kitrPrefix?: string }
  if (proto.__kitrPrefix) return
  const { getItem, setItem, removeItem, key } = proto
  const own = (s: Storage) => {
    const keys: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = key.call(s, i)
      if (k?.startsWith(prefix)) keys.push(k)
    }
    return keys
  }
  proto.__kitrPrefix = prefix
  proto.getItem = function (k) {
    return getItem.call(this, prefix + k)
  }
  proto.setItem = function (k, v) {
    setItem.call(this, prefix + k, v)
  }
  proto.removeItem = function (k) {
    removeItem.call(this, prefix + k)
  }
  proto.key = function (i) {
    return own(this)[i]?.slice(prefix.length) ?? null
  }
  proto.clear = function () {
    for (const k of own(this)) removeItem.call(this, k)
  }
}

function Play() {
  const { pkg, example } = Route.useParams()
  const [Example, setExample] = useState<ComponentType | null>(null)
  useEffect(() => {
    namespaceStorage(storagePrefix(pkg, example))
    void examples[keyFor(pkg, example)]?.().then((m) => setExample(() => m.default))
  }, [pkg, example])
  return (
    <main className="play">
      <h1 className="visually-hidden">
        Live example: {pkg} / {example}
      </h1>
      {Example ? <Example /> : <p className="play-loading">Loading example…</p>}
    </main>
  )
}
