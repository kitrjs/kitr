import { createFileRoute } from '@tanstack/react-router'
import { seo } from 'kitr/ssr'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/pricing')({
  head: () => seo({ title: 'Pricing', description: 'Simple plans for every team size.' }),
  component: PricingPage,
})

const tiers = [
  { name: 'Hobby', price: 'Free', features: ['1 project', 'Community support'] },
  { name: 'Team', price: '$29', features: ['Unlimited projects', 'Email support', 'SSO'] },
  { name: 'Enterprise', price: 'Talk to us', features: ['Dedicated support', 'Custom contracts'] },
]

function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <PageHeader title="Pricing" description="Prerendered at build time: this page is static HTML." />
      <div className="grid gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.name}>
            <CardHeader>
              <CardTitle>{tier.name}</CardTitle>
              <CardDescription className="text-2xl font-semibold text-foreground">{tier.price}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {tier.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Button variant={tier.name === 'Team' ? 'default' : 'outline'}>Choose {tier.name}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
