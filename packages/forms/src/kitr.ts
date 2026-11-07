import { definePackage, naming } from '@kitr/core/package'

/** `kitr add forms`: React Hook Form with Standard Schema resolvers, `<Form>` with server-error mapping. */
export default definePackage({
  name: 'forms',
  client: true,
  add(ctx) {
    ctx.deps.add('react-hook-form', '@hookform/resolvers', 'zod')
    ctx.agents.add(
      'forms',
      `- Forms: \`const form = useSchemaForm(schema, { defaultValues })\` then \`<Form form={form} onSubmit={...}>\` from \`kitr/forms\` (or the styled copy in \`app/components/ui/form.tsx\`).\n- Throw or reject with a KitrError carrying \`fieldErrors\` and the fields show the messages; anything else lands in \`useRootError()\`.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove('react-hook-form', '@hookform/resolvers')
    ctx.agents.remove('forms')
  },
  generators: {
    form: {
      description: 'Create a form component in app/components/forms',
      target: (name, project) => ({
        file: `${project.rc.directories.components ?? 'app/components'}/forms/${naming.snake(name)}_form.tsx`,
      }),
      stub: ({ name }) => `import { useSchemaForm } from 'kitr/forms'
import { z } from 'zod'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

export const ${naming.camel(name)}Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})
export type ${naming.pascal(name)}Values = z.infer<typeof ${naming.camel(name)}Schema>

export function ${naming.pascal(name)}Form({ defaultValues, onSubmit }: { defaultValues?: Partial<${naming.pascal(name)}Values>; onSubmit: (values: ${naming.pascal(name)}Values) => Promise<unknown> }) {
  const form = useSchemaForm(${naming.camel(name)}Schema, { defaultValues: { name: '', ...defaultValues } })
  return (
    <Form form={form} onSubmit={onSubmit} className="grid gap-4">
      <FormMessage />
      <FormField name="name" label="Name">
        <FieldInput autoComplete="off" />
      </FormField>
      <SubmitButton>Save</SubmitButton>
    </Form>
  )
}
`,
    },
  },
  wraps: { 'react-hook-form': 'kitr/forms' },
  eject: { 'kitr/forms': 'react-hook-form + @hookform/resolvers' },
  vite: { optimizeDeps: ['react-hook-form', '@hookform/resolvers/standardSchema'] },
})
