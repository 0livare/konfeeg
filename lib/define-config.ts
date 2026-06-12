import type { EnvsShape, EnvName, CreateConfigOptions } from "./util-types.js"
import type { ConfigGroup, ValidateSchema, ResolveConfigGroup } from "./types.js"
import { createEnvironmentConfig } from "./create-config.js"

/**
 * Like {@link createEnvironmentConfig}, but binds the schema first and the
 * environment later. Useful when the active environment is not known at
 * schema-definition time.
 *
 * @typeParam E - The envs shape describing required/optional environments.
 *
 * @example
 * ```ts
 * type MyEnvs = {
 *   dev?: unknown
 *   staging: unknown
 *   production: unknown
 * }
 * const buildConfig = defineEnvironmentConfig<MyEnvs>()({
 *   port: { doc: 'Port', format: Number, value: 3000 },
 * })
 * const config = buildConfig('dev')
 * ```
 *
 * @example Fallback environments
 * ```ts
 * const buildConfig = defineEnvironmentConfig<MyEnvs>()(
 *   { apiUrl: { doc: 'API URL', format: 'url', staging: 'https://staging' } },
 *   { fallbacks: { dev: 'staging' } },
 * )
 * const config = buildConfig('dev') // apiUrl resolved from `staging`
 * ```
 */
export function defineEnvironmentConfig<E extends EnvsShape>() {
  const create = createEnvironmentConfig<E>()
  return <const G extends ConfigGroup<E>>(
      inputConfig: ValidateSchema<G, E>,
      options?: CreateConfigOptions<E>,
    ): ((env: EnvName<E>) => ResolveConfigGroup<G> & { env: EnvName<E> }) =>
    (env: EnvName<E>) =>
      create(env, inputConfig as any, options)
}
