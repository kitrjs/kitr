import type { Answers, AnswerValue, ProjectInfo, Question } from '@kitr/core/package'

/**
 * Questions a package asks on `kitr add`. Every question is a flag first: `--driver redis`,
 * `--worker` / `--no-worker`, `--targets ios,android`. What flags leave unanswered is asked
 * in a TTY and defaulted otherwise (`--yes`, `CI`, no stdin).
 */

export interface AskOptions {
  /** Take defaults for anything not given as a flag. */
  yes?: boolean
  /** Force prompting on or off. Default: on when stdin and stdout are TTYs and `CI` is unset. */
  interactive?: boolean
  /** The prompt implementation, for tests. */
  prompt?: Prompter
}

export interface Prompter {
  select(q: Question, answers: Answers): Promise<AnswerValue>
  multiselect(q: Question, answers: Answers): Promise<AnswerValue>
  confirm(q: Question, answers: Answers): Promise<AnswerValue>
  text(q: Question, answers: Answers): Promise<AnswerValue>
}

export function canPrompt(): boolean {
  return !!process.stdin.isTTY && !!process.stdout.isTTY && !process.env.CI
}

/** Turn a raw flag (`"redis"`, `true`, `"ios,android"`) into the question's value type. */
export function coerceAnswer(q: Question, raw: string | boolean): AnswerValue {
  switch (q.type) {
    case 'confirm':
      if (typeof raw === 'boolean') return raw
      if (raw === 'true' || raw === '1' || raw === 'yes' || raw === '') return true
      if (raw === 'false' || raw === '0' || raw === 'no') return false
      throw new Error(`--${q.name} expects true or false, got "${raw}"`)
    case 'multiselect': {
      if (typeof raw === 'boolean') throw new Error(`--${q.name} expects a comma-separated list`)
      const values = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      for (const v of values) checkOption(q, v)
      return values
    }
    case 'select': {
      if (typeof raw === 'boolean') throw new Error(`--${q.name} expects a value`)
      checkOption(q, raw)
      return raw
    }
    default:
      if (typeof raw === 'boolean') throw new Error(`--${q.name} expects a value`)
      return raw
  }
}

function checkOption(q: Question, value: string) {
  const allowed = q.options?.map((o) => o.value) ?? []
  if (allowed.length && !allowed.includes(value))
    throw new Error(`--${q.name} expects one of ${allowed.join(', ')}, got "${value}"`)
}

/**
 * Resolve every question to an answer: flags first, then prompts (when allowed), then
 * defaults. `when` is evaluated with the answers so far; a skipped question has no entry.
 */
export async function resolveAnswers(
  questions: Question[],
  flags: Record<string, string | boolean>,
  project: ProjectInfo,
  options: AskOptions = {},
): Promise<Answers> {
  const answers: Answers = {}
  const interactive = options.interactive ?? (!options.yes && canPrompt())
  const prompter = options.prompt ?? (interactive ? await clackPrompter() : undefined)
  for (const q of questions) {
    if (q.when && !q.when(answers, project)) continue
    let value: AnswerValue
    if (q.name in flags) value = coerceAnswer(q, flags[q.name]!)
    else if (prompter && interactive) value = await prompter[q.type](q, answers)
    else value = q.default
    const problem = q.validate?.(value, answers)
    if (problem) throw new Error(`--${q.name}: ${problem}`)
    answers[q.name] = value
  }
  return answers
}

/** One line per question, for `kitr add <pkg> --help`. */
export function describeQuestions(questions: Question[]): string[] {
  return questions.map((q) => {
    const flag =
      q.type === 'confirm'
        ? `--${q.name} / --no-${q.name}`
        : q.type === 'multiselect'
          ? `--${q.name} a,b`
          : `--${q.name} <${q.options ? q.options.map((o) => o.value).join('|') : 'value'}>`
    const def =
      q.default === undefined
        ? ''
        : ` (default: ${Array.isArray(q.default) ? q.default.join(',') : String(q.default)})`
    return `${flag.padEnd(34)} ${q.message}${def}`
  })
}

async function clackPrompter(): Promise<Prompter> {
  const p = await import('@clack/prompts')
  const bail = (value: unknown) => {
    if (p.isCancel(value)) {
      p.cancel('Cancelled.')
      process.exit(1)
    }
    return value
  }
  return {
    async select(q) {
      return bail(
        await p.select({
          message: q.message,
          initialValue: typeof q.default === 'string' ? q.default : undefined,
          options: (q.options ?? []).map((o) => ({
            value: o.value,
            label: o.label ?? o.value,
            hint: o.hint,
          })),
        }),
      ) as string
    },
    async multiselect(q) {
      return bail(
        await p.multiselect({
          message: q.message,
          initialValues: Array.isArray(q.default) ? q.default : undefined,
          required: false,
          options: (q.options ?? []).map((o) => ({
            value: o.value,
            label: o.label ?? o.value,
            hint: o.hint,
          })),
        }),
      ) as string[]
    },
    async confirm(q) {
      return bail(
        await p.confirm({
          message: q.message,
          initialValue: typeof q.default === 'boolean' ? q.default : true,
        }),
      ) as boolean
    },
    async text(q) {
      return bail(
        await p.text({
          message: q.message,
          defaultValue: typeof q.default === 'string' ? q.default : undefined,
          placeholder: typeof q.default === 'string' ? q.default : undefined,
        }),
      ) as string
    },
  }
}
