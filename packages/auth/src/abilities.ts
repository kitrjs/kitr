/**
 * Permissions as plain functions, shared by client guards and server middleware.
 *
 *   export const abilities = defineAbilities({
 *     'projects.update': (user: User, project: Project) => project.ownerId === user.id || user.role === 'admin',
 *   })
 */
/** One permission rule: true when `user` may act on `subject`. */
export type AbilityCheck<TUser, TSubject = any> = (user: TUser, subject: TSubject) => boolean

/** The result of `defineAbilities`: the rules plus `can` and `for` to check them. */
export type Abilities<TUser, TMap extends Record<string, AbilityCheck<TUser, any>>> = {
  /** The rules as given. */
  readonly map: TMap
  /** Check one ability. False for anonymous users, unknown abilities and rules that throw. */
  can<K extends keyof TMap & string>(
    user: TUser | null | undefined,
    ability: K,
    subject?: Parameters<TMap[K]>[1],
  ): boolean
  /** Bind a user: `const can = abilities.for(user); can('projects.update', project)`. */
  for(
    user: TUser | null | undefined,
  ): <K extends keyof TMap & string>(ability: K, subject?: Parameters<TMap[K]>[1]) => boolean
}

/** The user type of an ability map: the first parameter of its checks. */
type UserOf<M> = {
  [K in keyof M]: M[K] extends (user: infer U, ...rest: any[]) => any ? U : never
}[keyof M]

/**
 * Annotate the user in each check and the ability names stay typed, so `can('typo')` fails to compile:
 *
 *   defineAbilities({ 'projects.update': (user: User, project: Project) => ... })
 *
 * `defineAbilities<User>({...})` also works, but TypeScript can't infer the names when a type
 * argument is given, so they widen to `string`.
 */
export function defineAbilities<
  const TMap extends Record<string, (user: any, subject?: any) => boolean>,
>(map: TMap): Abilities<UserOf<TMap>, TMap>
export function defineAbilities<
  TUser,
  const TMap extends Record<string, AbilityCheck<TUser, any>> = Record<
    string,
    AbilityCheck<TUser, any>
  >,
>(map: TMap): Abilities<TUser, TMap>
export function defineAbilities(map: Record<string, AbilityCheck<any, any>>): Abilities<any, any> {
  const can = (user: unknown, ability: string, subject?: unknown) => {
    if (!user) return false
    const check = map[ability]
    if (!check) return false
    try {
      return !!check(user, subject)
    } catch {
      return false
    }
  }
  return {
    map,
    can: can as any,
    for: (user) => ((ability: string, subject?: unknown) => can(user, ability, subject)) as any,
  }
}

/** The ability names of an `Abilities` object, as a string union. */
export type AbilityName<A> = A extends Abilities<any, infer M> ? keyof M & string : string
