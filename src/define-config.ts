/* eslint-disable @typescript-eslint/no-explicit-any */

import type { TypeLambda } from "./util-types.js"
import type { ConfigGroup, EnvName, ResolveConfigGroup } from "./types.js"
import { createEnvironmentConfig } from "./create-config.js"

export function defineEnvironmentConfig<
  E extends TypeLambda,
  G extends ConfigGroup<E> = ConfigGroup<E>,
>(inputConfig: G): (env: EnvName<E>) => ResolveConfigGroup<G> {
  return (env: EnvName<E>) => createEnvironmentConfig<E, G>(env, inputConfig)
}
