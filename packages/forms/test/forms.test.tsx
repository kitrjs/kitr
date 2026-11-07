import { KitrError, schemaFrom } from '@kitr/core'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import {
  applyServerErrors,
  FieldInput,
  Form,
  FormField,
  SubmitButton,
  useFieldProps,
  useRootError,
  useSchemaForm,
  useZodForm,
} from '../src'

type Values = { email: string; address: { city: string } }
const schema = schemaFrom((v: any) => {
  const issues = []
  if (!v.email?.includes('@')) issues.push({ message: 'Invalid email', path: ['email'] })
  return issues.length ? { issues } : v
})

describe('applyServerErrors', () => {
  // Reading formState.errors during render subscribes the hook to error updates.
  const setup = () =>
    renderHook(() => {
      const form = useForm<Values>({ defaultValues: { email: '', address: { city: '' } } })
      void form.formState.errors
      return form
    }).result

  it('maps known fields (including nested paths) and sends the rest to root.server', () => {
    const form = setup()
    let isValidation = false
    act(() => {
      isValidation = applyServerErrors(
        form.current,
        KitrError.validation({
          email: ['taken', 'second'],
          'address.city': ['unknown city'],
          plan: ['n/a'],
          _root: ['general'],
        }),
      )
    })
    expect(isValidation).toBe(true)
    const errors = form.current.formState.errors as any
    expect(errors.email.message).toBe('taken')
    expect(errors.address.city.message).toBe('unknown city')
    expect(errors.root.server.message).toBeDefined()
  })

  it('puts non-validation errors on root.server and reports false', () => {
    const form = setup()
    let isValidation = true
    act(() => {
      isValidation = applyServerErrors(form.current, new Error('Server exploded'))
    })
    expect(isValidation).toBe(false)
    expect((form.current.formState.errors as any).root.server.message).toBe('Server exploded')
  })

  it('accepts wire-shaped errors from fetch bodies', () => {
    const form = setup()
    act(() => {
      applyServerErrors(form.current, {
        code: 'VALIDATION',
        message: 'x',
        status: 422,
        fieldErrors: { email: ['bad'] },
      })
    })
    expect(form.current.formState.errors.email?.message).toBe('bad')
  })
})

describe('useSchemaForm', () => {
  it('validates with any Standard Schema and is aliased as useZodForm', async () => {
    expect(useZodForm).toBe(useSchemaForm)
    const { result } = renderHook(() => {
      const form = useSchemaForm(schema, { defaultValues: { email: 'nope' } })
      void form.formState.errors
      return form
    })
    let valid = true
    await act(async () => {
      valid = await result.current.trigger()
    })
    expect(valid).toBe(false)
    expect(result.current.formState.errors.email?.message).toBe('Invalid email')
  })
})

function SignUp({
  onSubmit,
  onError,
  onSuccess,
}: {
  onSubmit: (v: any) => any
  onError?: any
  onSuccess?: any
}) {
  const form = useSchemaForm(schema, { defaultValues: { email: '' } })
  function RootError() {
    const message = useRootError()
    return message ? <p data-testid="root">{message}</p> : null
  }
  return (
    <Form
      form={form}
      onSubmit={onSubmit}
      onError={onError}
      onSuccess={onSuccess}
      resetOnSuccess
      aria-label="signup"
    >
      <FormField name="email" label="Email" description="We never share it">
        <FieldInput type="email" />
      </FormField>
      <RootError />
      <SubmitButton pendingText="Saving…" disabled={false}>
        Save
      </SubmitButton>
    </Form>
  )
}

describe('<Form>', () => {
  it('wires labels, descriptions and client-side errors accessibly', async () => {
    render(<SignUp onSubmit={vi.fn()} />)
    const input = screen.getByLabelText('Email') as HTMLInputElement
    expect(input.getAttribute('aria-describedby')).toContain('description')
    fireEvent.change(input, { target: { value: 'bad' } })
    fireEvent.submit(screen.getByRole('form'))
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain('error')
  })

  it('submits valid values, shows pending state, resets and calls onSuccess', async () => {
    let finish!: (v: unknown) => void
    const onSubmit = vi.fn(() => new Promise((r) => (finish = r)))
    const onSuccess = vi.fn()
    render(<SignUp onSubmit={onSubmit} onSuccess={onSuccess} />)
    const input = screen.getByLabelText('Email') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a@b.dev' } })
    fireEvent.submit(screen.getByRole('form'))
    const button = await screen.findByRole('button', { name: 'Saving…' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    await act(async () => finish({ id: 1 }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 1 }, { email: 'a@b.dev' }))
    expect(input.value).toBe('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('lands server validation errors on fields and other errors at the root', async () => {
    const onError = vi.fn()
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(KitrError.validation({ email: ['Already registered'] }))
      .mockRejectedValueOnce(new KitrError('UNAVAILABLE', 'Try later'))
    render(<SignUp onSubmit={onSubmit} onError={onError} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.dev' } })
    fireEvent.submit(screen.getByRole('form'))
    expect((await screen.findByRole('alert')).textContent).toBe('Already registered')
    fireEvent.submit(screen.getByRole('form'))
    expect((await screen.findByTestId('root')).textContent).toBe('Try later')
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'UNAVAILABLE' }))
  })

  it('useFieldProps outside a field explains itself', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Lost() {
      useFieldProps()
      return null
    }
    expect(() => render(<Lost />)).toThrow(/inside <FormField>/)
    spy.mockRestore()
  })
})
