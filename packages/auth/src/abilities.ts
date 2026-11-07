/**
 * Permissions as plain functions, shared by client guards and server middleware.
 *
 *   export const abilities = defineAbilities<User>({
 *     'projects.update': (user, project: Project) => project.ownerId === user.id || user.role === 'admin',
 *   })
 */
export type AbilityCheck<TUser, TSubject = any> = (user: TUser, subject: TSubject) => boolean

export type Abilities<TUser, TMap extends Record<string, AbilityCheck<TUser, any>>> = {
  readonly map: TMap
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

export function defineAbilities<
  TUser,
  const TMap extends Record<string, AbilityCheck<TUser, any>> = Record<
    string,
    AbilityCheck<TUser, any>
  >,
>(map: TMap): Abilities<TUser, TMap> {
  const can = (user: TUser | null | undefined, ability: string, subject?: unknown) => {
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

export type AbilityName<A> = A extends Abilities<any, infer M> ? keyof M & string : string
