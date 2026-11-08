import { useSchemaForm } from '@kitr/forms'
import { schemaFrom } from '@kitr/kitr/app'
import { useNavigate } from '@kitr/router'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

interface SignInValues {
  email: string
  password: string
}

// Replace with your zod/valibot schema; any Standard Schema works.
const signInSchema = schemaFrom((values: SignInValues) => {
  const issues: { message: string; path: string[] }[] = []
  if (!/^\S+@\S+$/.test(values.email ?? ''))
    issues.push({ message: 'Enter a valid email', path: ['email'] })
  if (!values.password) issues.push({ message: 'Password is required', path: ['password'] })
  return issues.length ? { issues } : values
})

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const form = useSchemaForm(signInSchema, { defaultValues: { email: '', password: '' } })

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            form={form}
            className="grid gap-4"
            onSubmit={async (values) => {
              // Call your auth adapter here, e.g. `await auth.signIn(values)`.
              void values
              await navigate({ to: redirect ?? '/' })
            }}
          >
            <FormMessage />
            <FormField name="email" label="Email">
              <FieldInput type="email" autoComplete="email" />
            </FormField>
            <FormField name="password" label="Password">
              <FieldInput type="password" autoComplete="current-password" />
            </FormField>
            <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
