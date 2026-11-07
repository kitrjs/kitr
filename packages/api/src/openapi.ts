import type { StandardSchemaV1 } from '@kitr/core'
import { httpEntries } from './routes'
import type { RouteEntry as TableEntry } from '@kitr/core'

/** Options for `toOpenApi()`: document info and schema conversion. */
export interface OpenApiOptions {
  /** `info.title`. Default `kitr API`. */
  title?: string
  /** `info.version`. Default `0.0.0`. */
  version?: string
  /** `info.description`. */
  description?: string
  /** The document's `servers` list. */
  servers?: Array<{ url: string; description?: string }>
  /** Convert a Standard Schema to JSON Schema. Zod 4 is handled automatically when `zod` is importable. */
  schemaToJson?: (
    schema: StandardSchemaV1,
  ) => Promise<Record<string, unknown> | undefined> | Record<string, unknown> | undefined
}

/** Emit an OpenAPI 3.1 document from a router. Validators become request schemas where convertible. */
export async function toOpenApi(
  router: { entries: Array<{ kind: string }> },
  options: OpenApiOptions = {},
) {
  const convert = options.schemaToJson ?? defaultSchemaToJson
  const paths: Record<string, Record<string, unknown>> = {}
  for (const route of httpEntries(router as unknown as { entries: TableEntry[] })) {
    const path = route.path.replace(/:(\w+)/g, '{$1}')
    const params = [...route.path.matchAll(/:(\w+)/g)].map((m) => m[1]!)
    const op: Record<string, unknown> = {
      operationId: route.name,
      summary: route.meta?.summary,
      description: route.meta?.description,
      tags: route.meta?.tags ?? [route.name.split('.')[0]].filter((t) => t && !t.includes(' ')),
      deprecated: route.meta?.deprecated,
      parameters: params.map((name) => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      })),
      responses: {
        '200': { description: 'OK' },
        '422': {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/KitrError' } } },
        },
      },
    }
    const validators =
      route.validate ??
      (isControllerRefLike(route.handler)
        ? await validatorsFromController(route.handler)
        : undefined)
    if (validators?.query) {
      const schema = await convert(validators.query)
      if (schema?.properties) {
        for (const [name, prop] of Object.entries(schema.properties as Record<string, unknown>)) {
          ;(op.parameters as unknown[]).push({
            name,
            in: 'query',
            required: (schema.required as string[] | undefined)?.includes(name) ?? false,
            schema: prop,
          })
        }
      }
    }
    if (validators?.body) {
      const schema = await convert(validators.body)
      if (schema) op.requestBody = { required: true, content: { 'application/json': { schema } } }
    }
    paths[path] ??= {}
    paths[path][route.method.toLowerCase()] = op
  }
  return {
    openapi: '3.1.0',
    info: {
      title: options.title ?? 'kitr API',
      version: options.version ?? '0.0.0',
      description: options.description,
    },
    servers: options.servers,
    paths,
    components: {
      schemas: {
        KitrError: {
          type: 'object',
          required: ['code', 'message', 'status'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            status: { type: 'integer' },
            fieldErrors: {
              type: 'object',
              additionalProperties: { type: 'array', items: { type: 'string' } },
            },
            data: {},
          },
        },
      },
    },
  }
}

function isControllerRefLike(h: unknown): h is readonly [unknown, string] {
  return Array.isArray(h) && h.length === 2 && typeof h[1] === 'string'
}

async function validatorsFromController(ref: readonly [unknown, string]) {
  const { resolveControllerClass } = await import('./controller')
  const cls = await resolveControllerClass(ref[0] as any)
  return cls.validation?.[ref[1]]
}

async function defaultSchemaToJson(
  schema: StandardSchemaV1,
): Promise<Record<string, unknown> | undefined> {
  const vendor = schema['~standard'].vendor
  if (vendor === 'zod') {
    const zod = await optionalImport('zod')
    if (zod?.toJSONSchema)
      return zod.toJSONSchema(schema, { target: 'openapi-3.0' }) as Record<string, unknown>
  }
  if (vendor === 'valibot') {
    const mod = await optionalImport('@valibot/to-json-schema')
    if (mod?.toJsonSchema) return mod.toJsonSchema(schema) as Record<string, unknown>
  }
  if (vendor === 'arktype' && typeof (schema as any).toJsonSchema === 'function')
    return (schema as any).toJsonSchema()
  return undefined
}

/** Dynamic import that bundlers leave alone: the specifier is a variable, so Vite/Rolldown do not try to resolve it. */
async function optionalImport(name: string): Promise<any> {
  const specifier = name
  try {
    return await import(/* @vite-ignore */ specifier)
  } catch {
    return null
  }
}
