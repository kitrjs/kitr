import { useSchemaForm } from '@kitr/forms'
import { useTranslation } from '@kitr/i18n'
import { useMutation } from '@kitr/query'
import { mutationFrom } from '@kitr/query'
import { Link } from '@kitr/router'
import { useState } from 'react'
import { api } from '#app/api/client'
import { subscribeSchema } from '#app/validators/newsletter'
import { buttonVariants } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

const subscribe = mutationFrom(api.newsletter.subscribe.mutation())

export default function HomePage() {
  const { t } = useTranslation()
  const features = ['ssr', 'i18n', 'api'] as const
  return (
    <main className="mx-auto max-w-5xl px-4">
      <section className="py-20 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">{t('hero.title')}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{t('hero.subtitle')}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/blog" className={buttonVariants({ size: 'lg' })}>
            {t('hero.cta')}
          </Link>
          <Link to="/pricing" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            {t('hero.secondary')}
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{t('features.' + key + '.title')}</CardTitle>
              <CardDescription>{t('features.' + key + '.body')}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
      <Newsletter />
    </main>
  )
}

function Newsletter() {
  const { t } = useTranslation()
  const mutation = useMutation(subscribe)
  const [done, setDone] = useState(false)
  const form = useSchemaForm(subscribeSchema, { defaultValues: { email: '' } })
  return (
    <section className="mt-16">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{t('newsletter.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t('newsletter.success')}
            </p>
          ) : (
            <Form
              form={form}
              className="flex flex-col gap-3"
              onSubmit={async (values) => {
                await mutation.mutateAsync({ body: values })
                setDone(true)
              }}
            >
              <FormMessage />
              <FormField name="email" label="Email">
                <FieldInput type="email" placeholder={t('newsletter.placeholder')} autoComplete="email" />
              </FormField>
              <SubmitButton pendingText="…">{t('newsletter.button')}</SubmitButton>
            </Form>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
