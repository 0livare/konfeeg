/**
 * Declaration of the environments a config supports.
 *
 * - `required`: union of env names where every entry must supply a value
 *   (unless it uses `value`, `processEnv`, `importMetaEnv`, or `optional`).
 * - `optional`: union of env names where per-environment values may be omitted.
 *
 * @example
 * ```ts
 * type MyEnvs = {
 *   required: 'staging' | 'production'
 *   optional: 'dev' | 'integ'
 * }
 * ```
 */
export type EnvsDecl = {
  required: string
  optional?: string
}

/** Union of all environment names declared on `E` (required ∪ optional). */
export type EnvName<E extends EnvsDecl> =
  | E["required"]
  | (E extends { optional: infer O extends string } ? O : never)

/**
 * Per-environment value shape for a value of type `T`:
 * required envs are required, optional envs are optional.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type PerEnv<E extends EnvsDecl, T> = {
  [K in E["required"]]: T
} & (E extends { optional: infer O extends string } ? { [K in O]?: T } : {})
