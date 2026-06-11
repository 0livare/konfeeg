import type { EnvsShape, EnvName } from "./util-types.js"
import type { ConfigGroup, ResolveConfigGroup } from "./types.js"
import { createEnvironmentConfig } from "./create-config.js"

/**
 * Like {@link createEnvironmentConfig}, but binds the schema first and the
 * environment later. Useful when the active environment is not known at
 * schema-definition time.
 *
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
 */
export function defineEnvironmentConfig<E extends EnvsShape>() {
  const create = createEnvironmentConfig<E>()
  return <G extends ConfigGroup<E>>(
      inputConfig: G,
    ): ((env: EnvName<E>) => ResolveConfigGroup<G> & { env: EnvName<E> }) =>
    (env: EnvName<E>) =>
      create(env, inputConfig)
}
