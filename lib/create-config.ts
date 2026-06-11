/* eslint-disable @typescript-eslint/no-explicit-any */

import type { EnvsDecl, EnvName } from "./util-types.js"
import type { ConfigGroup, ResolveConfigGroup } from "./types.js"
import { validateAndCoerce } from "./format.js"

/**
 * Create a resolved, validated config for the given environment.
 *
 * Curried so the envs declaration is bound on the first call and the
 * schema is inferred (giving you autocomplete) on the second call:
 *
 * ```ts
 * type MyEnvs = { required: 'staging' | 'production'; optional: 'dev' }
 * const config = createEnvironmentConfig<MyEnvs>()('dev', {
 *   port: { doc: 'Port', format: Number, value: 3000 },
 * })
 * config.port // number
 * ```
 */
export function createEnvironmentConfig<E extends EnvsDecl>() {
  return <G extends ConfigGroup<E>>(
    env: EnvName<E>,
    inputConfig: G,
  ): ResolveConfigGroup<G> & { env: EnvName<E> } =>
    buildConfig<E, G>(env, inputConfig)
}

function buildConfig<E extends EnvsDecl, G extends ConfigGroup<E>>(
  env: EnvName<E>,
  inputConfig: G,
): ResolveConfigGroup<G> & { env: EnvName<E> } {
  const errors: string[] = []

  function processConfig(
    config: ConfigGroup<E>,
    keyPrefix: string,
  ): Record<string, any> {
    const output: Record<string, any> = {}

    for (const [key, entry] of Object.entries(config)) {
      if (key === "env") {
        throw new Error(
          `Config key "env" is reserved and cannot be used. It will already be present by default.`,
        )
      }

      const fullKey = keyPrefix ? `${keyPrefix}.${key}` : key

      if (!("doc" in entry)) {
        output[key] = processConfig(entry as ConfigGroup<E>, fullKey)
        continue
      }

      const configEntry = entry as any

      // Value resolution — sources are evaluated in ascending priority order.
      // The highest-priority source that resolves to a defined value wins.
      //
      //  Priority │ Source
      //  ─────────┼────────────────────────────────────────────────────────────────
      //  1 (low)  │ Static `value` — same value across all environments
      //  2        │ Per-environment field
      //           │ — overrides the static value for that specific environment
      //  3 (high) │ Runtime env var via `processEnv` or `importMetaEnv`
      //           │ — always wins; intended for secrets and local dev overrides

      // Priority 1: static value (lowest precedence)
      let value: any = "value" in configEntry ? configEntry.value : undefined

      // Priority 2: per-environment value (overrides static)
      const envValue = configEntry[env]
      if (envValue !== undefined) value = envValue

      // Priority 3: runtime env var (highest precedence — always wins when defined)
      if ("processEnv" in configEntry) {
        const runtimeOverride =
          // @ts-expect-error process may not be defined in browser builds
          typeof process !== "undefined" && process.env
            ? // @ts-expect-error process may not be defined in browser builds
              process.env[configEntry.processEnv as string]
            : undefined
        if (runtimeOverride !== undefined) value = runtimeOverride
      } else if ("importMetaEnv" in configEntry) {
        const runtimeOverride =
          // @ts-expect-error import.meta.env may not be defined in Node builds
          typeof import.meta !== "undefined" && import.meta.env
            ? // @ts-expect-error import.meta.env may not be defined in Node builds
              import.meta.env[configEntry.importMetaEnv as string]
            : undefined
        if (runtimeOverride !== undefined) value = runtimeOverride
      }

      const hasValueSource =
        value !== undefined ||
        "processEnv" in configEntry ||
        "importMetaEnv" in configEntry

      if (value === undefined && !hasValueSource) {
        errors.push(
          `No value source declared for ${fullKey}. Supply a value using environment names, "value", "processEnv", or "importMetaEnv".`,
        )
        continue
      }

      if (value === undefined) {
        if (configEntry.optional) {
          value = configEntry.default
          if (value === undefined) {
            output[key] = undefined
            continue
          }
        } else {
          errors.push(
            `Missing required config value for ${fullKey} in environment ${env}`,
          )
          continue
        }
      }

      //
      // Format validation and coercion
      //
      value = validateAndCoerce(value, configEntry.format, fullKey, errors)

      output[key] = value
    }

    return output
  }

  const outputConfig = processConfig(inputConfig, "")

  if (errors.length > 0) {
    console.error("Environment config validation failed", errors)
    throw new Error(
      `Environment config validation failed:\n${errors.join("\n")}`,
    )
  }

  outputConfig.env = env
  return outputConfig as ResolveConfigGroup<G> & { env: EnvName<E> }
}
