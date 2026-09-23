/// <reference types="vite/client" />

import { createUncheckedEnvironmentConfig as createCore } from "./create-config.js"
import type {
  ConfigGroup,
  ResolveTopLevelConfig,
  ValidateSchema,
} from "./types.js"
import type { CreateConfigOptions, EnvName, EnvsShape } from "./util-types.js"

export * from "./index.js"

function browserOptions<E extends EnvsShape>(
  options?: CreateConfigOptions<E>,
): CreateConfigOptions<E> | undefined {
  const importMetaEnv = options?.importMetaEnv ?? import.meta.env
  return importMetaEnv === undefined ? options : { ...options, importMetaEnv }
}

export function createEnvironmentConfig<E extends EnvsShape>() {
  const create = createUncheckedEnvironmentConfig<E>()
  return <const G extends ConfigGroup<E>>(
    env: EnvName<E>,
    schema: G & ValidateSchema<G, E>,
    options?: CreateConfigOptions<E>,
  ): ResolveTopLevelConfig<G> & { env: EnvName<E> } =>
    create<G>(env, schema, options)
}

export function createUncheckedEnvironmentConfig<E extends EnvsShape>() {
  const create = createCore<E>()
  return <const G extends ConfigGroup<E>>(
    env: EnvName<E>,
    schema: G,
    options?: CreateConfigOptions<E>,
  ): ResolveTopLevelConfig<G> & { env: EnvName<E> } =>
    create(env, schema, browserOptions(options))
}

export function defineEnvironmentConfig<E extends EnvsShape>() {
  const create = createUncheckedEnvironmentConfig<E>()
  return <const G extends ConfigGroup<E>>(
    schema: G & ValidateSchema<G, E>,
    options?: CreateConfigOptions<E>,
  ): ((env: EnvName<E>) => ResolveTopLevelConfig<G> & { env: EnvName<E> }) =>
    (env) =>
      create<G>(env, schema, options)
}

export function defineUncheckedEnvironmentConfig<E extends EnvsShape>() {
  const create = createUncheckedEnvironmentConfig<E>()
  return <const G extends ConfigGroup<E>>(
    schema: G,
    options?: CreateConfigOptions<E>,
  ): ((env: EnvName<E>) => ResolveTopLevelConfig<G> & { env: EnvName<E> }) =>
    (env) =>
      create(env, schema, options)
}
