export { createEnvironmentConfig } from "./create-config.js"
export { defineEnvironmentConfig } from "./define-config.js"
export type {
  ConfigGroup,
  ResolveConfigGroup,
  ResolveTopLevelConfig,
  ResolveVariantGroup,
  // ValidateSchema appears in createEnvironmentConfig's parameter type, so it
  // must be nameable: a consumer that wraps or re-exports the curried function
  // otherwise gets it structurally inlined into its declaration emit, where
  // deep schemas hit the printer's depth limit and degrade to `any`.
  ValidateSchema,
  VariantGroup,
} from "./types.js"
export type {
  CreateConfigOptions,
  EnvName,
  EnvsShape,
  Fallbacks,
  PerEnv,
} from "./util-types.js"
