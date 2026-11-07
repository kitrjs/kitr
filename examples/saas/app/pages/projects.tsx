import { useAnalytics } from 'kitr/analytics/react'
import { useSchemaForm } from 'kitr/forms'
import { useMutation, useSuspenseQuery } from 'kitr/query'
import { getRouteApi } from 'kitr/router'
import { type ColumnDef, type DataTableFeatures, useUrlTableState } from 'kitr/table'
import { useState } from 'react'
import type { AppEvents } from '#app/analytics'
import { createProject, deleteProject, projectsQuery } from '#app/features/projects/queries'
import { type Project, createProjectSchema } from '#app/features/projects/schema'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'
import { PageHeader } from '#components/ui/page-header'

const route = getRouteApi('/_app/projects')

export default function ProjectsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const tableState = useUrlTableState({
    search,
    setSearch: (patch) => navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }) }),
  })
  const { data } = useSuspenseQuery(projectsQuery.options({}))
  const remove = useMutation(deleteProject)
  const [open, setOpen] = useState(false)

  const columns: ColumnDef<DataTableFeatures, Project>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
          {row.original.status}
        </Badge>
      ),
    },
    { accessorKey: 'owner', header: 'Owner' },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={() => remove.mutate({ params: { id: row.original.id } })}
        >
          Delete
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Projects"
        description="Sorting and paging live in the URL, so links are shareable."
        actions={<Button onClick={() => setOpen(true)}>New project</Button>}
      />
      <DataTable columns={columns} data={data} clientSide {...tableState} />
      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useMutation(createProject)
  const analytics = useAnalytics<AppEvents>()
  const form = useSchemaForm(createProjectSchema, { defaultValues: { name: '', status: 'active' } })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>Validated by the same schema the API uses.</DialogDescription>
      </DialogHeader>
      <Form
        form={form}
        className="grid gap-4"
        resetOnSuccess
        onSubmit={async (values) => {
          const project = await create.mutateAsync({ body: values })
          analytics.track('project.created', { id: project.id })
          onOpenChange(false)
        }}
      >
        <FormMessage />
        <FormField name="name" label="Name">
          <FieldInput autoFocus placeholder="Q3 launch" />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton pendingText="Creating…">Create</SubmitButton>
        </DialogFooter>
      </Form>
    </Dialog>
  )
}
