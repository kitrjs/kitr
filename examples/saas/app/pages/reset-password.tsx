import { useSchemaForm } from '@kitr/forms'
import { getRouteApi, useNavigate } from '@kitr/router'
import { z } from 'zod'
import { api } from '#app/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

const schema = z.object({ password: z.string().min(8, 'Use at least 8 characters') })
const route = getRouteApi('/reset-password')

export default function ResetPasswordPage() {
  const { token } = route.useSearch()
  const navigate = useNavigate()
  const form = useSchemaForm(schema, { defaultValues: { password: '' } })
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Signing in again is required on every device afterwards.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            form={form}
            className="grid gap-4"
            onSubmit={async (values) => {
              await api.auth.resetPassword({ body: { token, password: values.password } })
              await navigate({ to: '/sign-in', search: { redirect: undefined } })
            }}
          >
            <FormMessage />
            <FormField name="password" label="New password">
              <FieldInput type="password" autoComplete="new-password" />
            </FormField>
            <SubmitButton pendingText="Saving…">Save password</SubmitButton>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
