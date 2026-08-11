/* eslint-disable @typescript-eslint/no-explicit-any */

import { validateAndCoerce } from "./format.js"
import type {
  ConfigGroup,
  ResolveTopLevelConfig,
  ValidateSchema,
} from "./types.js"
import type {
  CreateConfigOptions,
  EnvName,
  EnvsShape,
  Fallbacks,
} from "./util-types.js"

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
const RESERVED_ENTRY_KEYS = new Set([
  "doc",
  "format",
  "value",
  "optional",
  "default",
  "processEnv",
  "importMetaEnv",
])

export function createEnvironmentConfig<E extends EnvsShape>() {
  // `G & ValidateSchema<G, E>` (rather than `ValidateSchema<G, E>` alone):
  // G must be inferred from the plain `G` member. Inferring it THROUGH the
  // mapped ValidateSchema type produces a reverse-mapped type on TS < 6 whose
  // properties fail the conditional branches in ResolveConfigGroup, collapsing
  // every resolved entry. The intersection keys enum-value errors to the
  // offending property just like the reverse-mapped form did.
  return <const G extends ConfigGroup<E>>(
    env: EnvName<E>,
    inputConfig: G & ValidateSchema<G, E>,
    options?: CreateConfigOptions<E>,
  ): ResolveTopLevelConfig<G> & { env: EnvName<E> } =>
    buildConfig<E, G>(env, inputConfig as G, options)
}

function buildConfig<E extends EnvsShape, G extends ConfigGroup<E>>(
  env: EnvName<E>,
  inputConfig: G,
  options?: CreateConfigOptions<E>,
): ResolveTopLevelConfig<G> & { env: EnvName<E> } {
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
        // A variant group is a discriminated-union node: a `variants` map plus
        // one sibling enum entry (the discriminant). Its value selects which
        // sub-group is resolved. Detected structurally by a `variants` key and
        // checked before the plain-group branch, since a variant node also
        // lacks `doc`.
        if ("variants" in entry) {
          output[key] = processVariantGroup(entry as any, fullKey)
        } else {
          output[key] = processConfig(entry as ConfigGroup<E>, fullKey)
        }
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
          // @ts-expect-error import.meta.env may not be defined in Node builds
          typeof import.meta !== "undefined" && import.meta.env
            ? // @ts-expect-error import.meta.env may not be defined in Node builds
              import.meta.env[configEntry.importMetaEnv as string]
            : undefined
        if (runtimeOverride !== undefined) value = runtimeOverride
      }

      const hasEnvDeclaration = Object.keys(configEntry).some(
        (candidateKey) => !RESERVED_ENTRY_KEYS.has(candidateKey),
      )

      const hasValueSource =
        "value" in configEntry ||
        "processEnv" in configEntry ||
        "importMetaEnv" in configEntry ||
        configEntry.optional ||
        hasEnvDeclaration

      if (value === undefined && !hasValueSource) {
        errors.push(
          `${fullKey}: No value source declared and "optional" is not set.`,
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
            `${fullKey}: Missing required config value in environment ${env}`,
          )
          continue
        }
      }

      //
      // Format validation and coercion
      //
      value = validateAndCoerce(value, configEntry.format, fullKey, errors)

      // Clone array values so the resolved config owns its arrays rather than
      // aliasing the input schema — otherwise mutating a resolved array would
      // leak into the schema and into sibling configs built from it.
      if (Array.isArray(value)) value = [...value]

      output[key] = value
    }

    return output
  }

  // Resolve a variant group: resolve the discriminant enum entry, then resolve
  // ONLY the sub-group selected by its value. Sibling variants are never read,
  // so only the active variant's sources are required.
  //
  // The discriminant lives inside `variants` — the sole entry-valued child
  // (it has a string `doc`) among the group-valued variant options — and its
  // key name is the output property name. Every sibling of `variants` is a
  // shared field resolved for all variants.
  function processVariantGroup(
    node: Record<string, any>,
    keyPrefix: string,
  ): Record<string, any> {
    const rawVariants = node.variants
    if (
      rawVariants === null ||
      typeof rawVariants !== "object" ||
      Array.isArray(rawVariants)
    ) {
      errors.push(
        `${keyPrefix}: "variants" must be an object mapping discriminant values to config groups`,
      )
      return {}
    }

    // Discriminant detection mirrors DiscriminantKeyOf in types.ts: only an
    // entry has a string-valued `doc`; the variant options are groups.
    const discriminantKeys = Object.keys(rawVariants).filter((k) => {
      const child = rawVariants[k]
      return (
        child !== null &&
        typeof child === "object" &&
        typeof child.doc === "string"
      )
    })
    const discriminantKey = discriminantKeys[0]
    if (discriminantKeys.length !== 1 || discriminantKey === undefined) {
      errors.push(
        `${keyPrefix}: a variant group must declare exactly one discriminant entry inside "variants"; found [${discriminantKeys.join(", ")}]`,
      )
      return {}
    }

    const { [discriminantKey]: _discriminant, ...options } = rawVariants
    const variants = options as Record<string, ConfigGroup<E>>

    // Every sibling of `variants` is a shared field resolved for all variants.
    const sharedKeys = Object.keys(node).filter((k) => k !== "variants")
    if (sharedKeys.includes(discriminantKey)) {
      errors.push(
        `${keyPrefix}.${discriminantKey}: shared field key collides with the discriminant key`,
      )
      return {}
    }
    const sharedGroup = Object.fromEntries(
      sharedKeys.map((k) => [k, node[k]]),
    ) as ConfigGroup<E>

    if (discriminantKey === "env") {
      throw new Error(
        `Config key "env" is reserved and cannot be used as a variant discriminant.`,
      )
    }
    const discriminantFullKey = keyPrefix
      ? `${keyPrefix}.${discriminantKey}`
      : discriminantKey

    // Resolve the discriminant by treating it as a one-key group, reusing the
    // full source-precedence / fallback / enum-validation / missing-required
    // pipeline. If it errors, don't pile on further variant errors.
    const errorsBefore = errors.length
    const resolved = processConfig(
      { [discriminantKey]: rawVariants[discriminantKey] } as ConfigGroup<E>,
      keyPrefix,
    )
    if (errors.length > errorsBefore) return {}

    const discriminantValue = resolved[discriminantKey]
    if (discriminantValue === undefined) {
      errors.push(
        `${discriminantFullKey}: discriminant did not resolve to a value; cannot select a variant`,
      )
      return {}
    }

    const selected = variants[discriminantValue]
    if (!selected) {
      errors.push(
        `${discriminantFullKey}: resolved to "${discriminantValue}", which has no matching variant. ` +
          `Valid variants: [${Object.keys(variants).join(", ")}]`,
      )
      return {}
    }

    // Resolve the shared fields and the selected variant's fields under the
    // same key prefix, so their output/error keys are flat under this group
    // (e.g. db.connectionString).
    const resolvedShared = processConfig(sharedGroup, keyPrefix)
    const resolvedVariant = processConfig(selected, keyPrefix)

    // A key declared both as a shared field and inside the selected variant is
    // ambiguous (and its resolved type would be an intersection of the two
    // declarations), so reject it rather than pick a winner.
    for (const sharedKey of Object.keys(resolvedShared)) {
      if (sharedKey in resolvedVariant) {
        errors.push(
          `${keyPrefix}.${sharedKey}: declared both as a shared field and in variant "${discriminantValue}"`,
        )
      }
    }
    if (errors.length > errorsBefore) return {}

    // The discriminant is spread last so it always wins: a variant field that
    // (mistakenly) reuses the discriminant's key can't overwrite the selected
    // value, keeping the resolved value consistent with the chosen variant.
    return {
      ...resolvedShared,
      ...resolvedVariant,
      [discriminantKey]: discriminantValue,
    }
  }

  // The root schema may itself be a variant group, making the whole config a
  // discriminated union; detected structurally by a top-level `variants` key,
  // exactly as nested variant groups are.
  let outputConfig =
    "variants" in inputConfig
      ? processVariantGroup(inputConfig as Record<string, any>, "")
      : processConfig(inputConfig, "")

  if (errors.length > 0) {
    console.error("Environment config validation failed", errors)
    throw new Error(
      `Environment config validation failed:\n${errors.join("\n")}`,
    )
  }

  outputConfig = {
    env,
    ...outputConfig,
  }
  return outputConfig as ResolveTopLevelConfig<G> & { env: EnvName<E> }
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
