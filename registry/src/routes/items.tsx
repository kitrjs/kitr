import {
  type ColumnDef,
  type DataTableFeatures,
  parseTableSearch,
  useUrlTableState,
} from '@kitr/table'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { PageHeader } from '#components/ui/page-header'

interface Item {
  id: string
  name: string
  status: 'active' | 'archived'
}

const columns: ColumnDef<DataTableFeatures, Item>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
]

export const Route = createFileRoute('/items')({
  validateSearch: parseTableSearch,
  component: ItemsPage,
})

function ItemsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const tableState = useUrlTableState({
    search,
    setSearch: (patch) => navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }) }),
  })
  // Replace with a query: `const { data } = useSuspenseQuery(itemsQuery.options(search))`
  const data: Item[] = []
  return (
    <>
      <PageHeader
        title="Items"
        description="Everything in one table."
        actions={<Button>New item</Button>}
      />
      <DataTable columns={columns} data={data} rowCount={0} {...tableState} />
    </>
  )
}
