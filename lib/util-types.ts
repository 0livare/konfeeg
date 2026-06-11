/**
 * Declaration of the environments a config supports: an object whose keys
 * are environment names, with required envs as required properties and
 * optional envs as optional properties.
 *
 * The property value type is not used by the library — only the keys and
 * their required/optional status matter — so `unknown` (or any other type)
 * is fine.
 *
 * @example
 * ```ts
 * type MyEnvs = {
 *   dev?: unknown
 *   integ?: unknown
 *   staging: unknown
 *   production: unknown
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EnvsShape = Record<string, any>

type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T] &
  string

type OptionalKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T] &
  string

/** Union of all environment names declared on `E` (required ∪ optional). */
export type EnvName<E extends EnvsShape> = keyof E & string

/**
 * Per-environment value shape for a value of type `T`:
 * required envs are required, optional envs are optional.
 */
export type PerEnv<E extends EnvsShape, T> = { [K in RequiredKeys<E>]: T } & {
  [K in OptionalKeys<E>]?: T
}
