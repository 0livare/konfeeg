import {
  createEnvironmentConfig,
  createUncheckedEnvironmentConfig,
} from "./create-config.js"
import type {
  ConfigGroup,
  ResolveTopLevelConfig,
  ValidateSchema,
} from "./types.js"
import type { CreateConfigOptions, EnvName, EnvsShape } from "./util-types.js"

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
  // See createEnvironmentConfig for why the parameter is `G & ValidateSchema`.
  return <const G extends ConfigGroup<E>>(
    inputConfig: G & ValidateSchema<G, E>,
    options?: CreateConfigOptions<E>,
  ): ((env: EnvName<E>) => ResolveTopLevelConfig<G> & { env: EnvName<E> }) =>
    (env: EnvName<E>) =>
      create(env, inputConfig as any, options) as ResolveTopLevelConfig<G> & {
        env: EnvName<E>
      }
}

/**
 * Like {@link defineEnvironmentConfig}, but its schema parameter is a plain
 * `G` with no `ValidateSchema` intersection. This is the schema-first
 * counterpart of {@link createUncheckedEnvironmentConfig}; use it as a
 * forwarding target for wrapper functions. See that function for why a
 * plain-`G` sink keeps validating wrappers cast-free.
 */
export function defineUncheckedEnvironmentConfig<E extends EnvsShape>() {
  const create = createUncheckedEnvironmentConfig<E>()
  return <const G extends ConfigGroup<E>>(
    inputConfig: G,
    options?: CreateConfigOptions<E>,
  ): ((env: EnvName<E>) => ResolveTopLevelConfig<G> & { env: EnvName<E> }) =>
    (env: EnvName<E>) =>
      create(env, inputConfig, options)
}
