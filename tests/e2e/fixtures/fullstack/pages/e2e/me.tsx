import { useSuspenseQuery } from '@tanstack/react-query'
import { meQuery } from '#app/e2e/me-query'

export default function Me() {
  const { data } = useSuspenseQuery(meQuery)
  return <p data-testid="me">user:{data}</p>
}
