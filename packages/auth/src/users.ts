/** The least a signed-in user has: an id and the email they sign in with. Your own `User` adds roles, names and so on. */
export interface AuthUser {
  id: string
  email: string
}

/** A user as the provider keeps it: the public `user`, the password hash and whether the email is confirmed. */
export interface StoredUser<TUser extends AuthUser = AuthUser> {
  /** What sessions and the client see. Never holds the hash. */
  user: TUser
  /** The `hashPassword` string, or `null` for a user who has no password (social sign-in). */
  passwordHash: string | null
  /** Whether the email address was confirmed. */
  emailVerified?: boolean
}

/** What `UserProvider.create` receives: the sign-up fields, with the password already hashed. */
export interface NewUser {
  email: string
  passwordHash: string
  name?: string
}

/**
 * Where users live. The kit implements it over its own database (`server/users.ts`); the cookie
 * session controller and the request scope call it and nothing else. The controller lower-cases
 * emails before calling.
 */
export interface UserProvider<TUser extends AuthUser = AuthUser> {
  /** The stored user with this (lower-cased) email, or `null`. */
  findByEmail(email: string): Promise<StoredUser<TUser> | null>
  /** The public user with this id, or `null`. Called on every authenticated request. */
  findById(id: string): Promise<TUser | null>
  /** Create a user from a sign-up. Reject with a `CONFLICT` `KitrError` when the email is taken. */
  create(input: NewUser): Promise<TUser>
  /** Store a new password hash (password reset, rehash after sign-in). Needed for `resetPassword`. */
  setPasswordHash?(id: string, passwordHash: string): Promise<void>
  /** Mark the email confirmed. Needed for `verifyEmail`. */
  markEmailVerified?(id: string): Promise<void>
}

/** Options for `createMemoryUserProvider`. */
export interface MemoryUserProviderOptions<TUser extends AuthUser> {
  /** Build the public user for a sign-up. Default: `{ id, email, name }`. */
  build?: (input: NewUser, id: string) => TUser
  /** Users that exist from the start. */
  seed?: Array<StoredUser<TUser>>
}

/** A `UserProvider` over a map, with the map itself as `all`. */
export interface MemoryUserProvider<TUser extends AuthUser> extends UserProvider<TUser> {
  /** Every stored user by id. */
  readonly all: ReadonlyMap<string, StoredUser<TUser>>
}

/** Users in this process: for tests and demos. Lost on restart; swap for your database. */
export function createMemoryUserProvider<TUser extends AuthUser = AuthUser>(
  options: MemoryUserProviderOptions<TUser> = {},
): MemoryUserProvider<TUser> {
  const byId = new Map<string, StoredUser<TUser>>()
  for (const stored of options.seed ?? []) byId.set(stored.user.id, { ...stored })
  const byEmail = (email: string) =>
    [...byId.values()].find((s) => s.user.email.toLowerCase() === email)
  return {
    all: byId,
    async findByEmail(email) {
      return byEmail(email) ?? null
    },
    async findById(id) {
      return byId.get(id)?.user ?? null
    },
    async create(input) {
      if (byEmail(input.email.toLowerCase()))
        throw Object.assign(new Error('Email already registered'), { code: 'CONFLICT' })
      const id = crypto.randomUUID()
      const user =
        options.build?.(input, id) ??
        ({
          id,
          email: input.email,
          ...(input.name ? { name: input.name } : {}),
        } as unknown as TUser)
      byId.set(id, { user, passwordHash: input.passwordHash, emailVerified: false })
      return user
    },
    async setPasswordHash(id, passwordHash) {
      const stored = byId.get(id)
      if (stored) stored.passwordHash = passwordHash
    },
    async markEmailVerified(id) {
      const stored = byId.get(id)
      if (stored) stored.emailVerified = true
    },
  }
}
