import { createFileRoute } from '@tanstack/react-router'
import { useUser } from 'kitr/auth'
import { useSuspenseQuery } from 'kitr/query'
import { Link } from 'kitr/router'
import type { User } from '#app/abilities'
import { projectsQuery } from '#app/features/projects/queries'
import { buttonVariants } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery.options({})),
  component: OverviewPage,
})

function OverviewPage() {
  const user = useUser<User>()
  const { data: projects } = useSuspenseQuery(projectsQuery.options({}))
  const active = projects.filter((p) => p.status === 'active')
  const stats = [
    { label: 'Projects', value: projects.length },
    { label: 'Active', value: active.length },
    { label: 'Archived', value: projects.length - active.length },
  ]
  return (
    <>
      <PageHeader
        title={'Welcome back' + (user ? ', ' + user.email.split('@')[0] : '')}
        description="What changed since you were last here."
        actions={
          <Link to="/projects" className={buttonVariants()}>
            All projects
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recently updated</CardTitle>
          <CardDescription>The last three projects anyone touched.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {projects.slice(0, 3).map((project) => (
              <li key={project.id} className="flex items-center justify-between py-2 text-sm">
                <span>{project.name}</span>
                <span className="text-muted-foreground">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
