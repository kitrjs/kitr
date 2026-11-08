import { getRouteApi, Link } from '@kitr/router'
import { useEffect, useState } from 'react'
import { api } from '#app/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'

const route = getRouteApi('/verify-email')

/** The link in the verification email lands here; the page posts the token to the API. */
export default function VerifyEmailPage() {
  const { token } = route.useSearch()
  const [state, setState] = useState<'checking' | 'done' | 'failed'>('checking')
  useEffect(() => {
    api.auth.verifyEmail({ body: { token } }).then(
      () => setState('done'),
      () => setState('failed'),
    )
  }, [token])
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Confirm your email</CardTitle>
          <CardDescription>
            {state === 'checking' && 'Checking the link…'}
            {state === 'done' && 'Your email address is confirmed.'}
            {state === 'failed' && 'This link is invalid or has expired. Ask for a new one from your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className="text-sm underline">
            Continue
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
