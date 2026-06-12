/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  EnvsShape,
  EnvName,
  CreateConfigOptions,
  Fallbacks,
} from "./util-types.js"
import type { ConfigGroup, ValidateSchema, ResolveConfigGroup } from "./types.js"
import { validateAndCoerce } from "./format.js"

/**
 * Create a resolved, validated config for the given environment.
 *
 * Curried so the envs declaration is bound on the first call and the
 * schema is inferred (giving you autocomplete) on the second call.
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
 * const config = createEnvironmentConfig<MyEnvs>()('dev', {
 *   port: { doc: 'Port', format: Number, value: 3000 },
 * })
 * config.port // number
 * ```
 *
 * @example Fallback environments
 * ```ts
 * // When running in `dev`, any entry that does not declare a `dev` value
 * // falls back to the entry's `integ` value.
 * const config = createEnvironmentConfig<MyEnvs>()(
 *   'dev',
 *   {
 *     apiUrl: {
 *       doc: 'API URL',
 *       format: 'url',
 *       integ: 'https://integ.example.com',
 *       staging: 'https://staging.example.com',
 *       production: 'https://api.example.com',
 *     },
 *   },
 *   { fallbacks: { dev: 'integ' } },
 * )
 * ```
 */
export function createEnvironmentConfig<E extends EnvsShape>() {
  return <const G extends ConfigGroup<E>>(
    env: EnvName<E>,
    inputConfig: ValidateSchema<G, E>,
    options?: CreateConfigOptions<E>,
  ): ResolveConfigGroup<G> & { env: EnvName<E> } =>
    buildConfig<E, G>(env, inputConfig as unknown as G, options)
}

function buildConfig<E extends EnvsShape, G extends ConfigGroup<E>>(
  env: EnvName<E>,
  inputConfig: G,
  options?: CreateConfigOptions<E>,
): ResolveConfigGroup<G> & { env: EnvName<E> } {
  const errors: string[] = []

  // Resolve the per-environment lookup chain once for the active env.
  // Throws synchronously on a circular fallback chain.
  const envChain = resolveFallbackChain<E>(env, options?.fallbacks)

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
      //  2        │ Per-environment field, walking the fallback chain
      //           │ — overrides the static value for that specific environment
      //  3 (high) │ Runtime env var via `processEnv` or `importMetaEnv`
      //           │ — always wins; intended for secrets and local dev overrides

      // Priority 1: static value (lowest precedence)
      let value: any = "value" in configEntry ? configEntry.value : undefined

      // Priority 2: per-environment value, walking the fallback chain.
      // The first env in the chain with a defined value wins.
      for (const candidateEnv of envChain) {
        const envValue = configEntry[candidateEnv]
        if (envValue !== undefined) {
          value = envValue
          break
        }
      }

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
          importMetaEnv?.[configEntry.importMetaEnv as string]
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

/**
 * Build the ordered list of environments to consult for per-environment
 * value resolution. The active env is always first; each subsequent entry
 * is the fallback target declared for the previous env. Throws if the
 * chain is cyclic.
 */
function resolveFallbackChain<E extends EnvsShape>(
  env: EnvName<E>,
  fallbacks: Fallbacks<E> | undefined,
): EnvName<E>[] {
  const chain: EnvName<E>[] = [env]
  if (!fallbacks) return chain

  const seen = new Set<string>([env])
  let current: EnvName<E> = env
  while (fallbacks[current] !== undefined) {
    const next = fallbacks[current] as EnvName<E>
    if (seen.has(next)) {
      throw new Error(
        `Circular fallback chain detected: ${[...chain, next].join(" -> ")}`,
      )
    }
    seen.add(next)
    chain.push(next)
    current = next
  }
  return chain
}

// Resolved indirectly so bundlers targeting CJS don't statically rewrite
// `import.meta` to `{}` — in CJS the Function body is a SyntaxError, which
// we swallow and treat as "no import.meta.env available".
const importMetaEnv: Record<string, string | undefined> | undefined = (() => {
  try {
    return new Function("return import.meta.env")()
  } catch {
    return undefined
  }
})()
