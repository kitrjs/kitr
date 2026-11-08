import { useAnalytics } from 'kitr/analytics/react'
import { useAuth } from 'kitr/auth'
import { useSchemaForm } from 'kitr/forms'
import { getRouteApi, Link, useNavigate } from 'kitr/router'
import { z } from 'zod'
import type { User } from '#app/abilities'
import type { AppEvents } from '#app/analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

const route = getRouteApi('/sign-in')

export default function SignInPage() {
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  const auth = useAuth<User, z.infer<typeof signInSchema>>()
  const analytics = useAnalytics<AppEvents>()
  const form = useSchemaForm(signInSchema, { defaultValues: { email: '', password: '' } })

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Saas</CardTitle>
          <CardDescription>Demo accounts: admin@example.com or member@example.com, password "password".</CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            form={form}
            className="grid gap-4"
            onSubmit={async (values) => {
              await auth.signIn(values)
              analytics.track('sign-in.completed', { method: 'password' })
              await navigate({ to: redirect ?? '/' })
            }}
          >
            <FormMessage />
            <FormField name="email" label="Email">
              <FieldInput type="email" autoComplete="email" placeholder="you@example.com" />
            </FormField>
            <FormField name="password" label="Password">
              <FieldInput type="password" autoComplete="current-password" />
            </FormField>
            <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
            <Link to="/forgot-password" className="text-center text-sm text-muted-foreground underline">
              Forgot your password?
            </Link>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
