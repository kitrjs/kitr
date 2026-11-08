import { useSchemaForm } from '@kitr/forms'
import { Link } from '@kitr/router'
import { useState } from 'react'
import { z } from 'zod'
import { api } from '#app/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

const schema = z.object({ email: z.email('Enter a valid email') })

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const form = useSchemaForm(schema, { defaultValues: { email: '' } })
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We email a link that works once and expires in an hour.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm">If that address has an account, a reset link is on its way.</p>
          ) : (
            <Form
              form={form}
              className="grid gap-4"
              onSubmit={async (values) => {
                await api.auth.requestPasswordReset({ body: values })
                setSent(true)
              }}
            >
              <FormMessage />
              <FormField name="email" label="Email">
                <FieldInput type="email" autoComplete="email" placeholder="you@example.com" />
              </FormField>
              <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
            </Form>
          )}
          <Link to="/sign-in" search={{ redirect: undefined }} className="mt-4 block text-center text-sm text-muted-foreground underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
