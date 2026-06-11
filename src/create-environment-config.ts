/* eslint-disable @typescript-eslint/no-explicit-any */

// ===============================================================================
// Define the list of environments
//

export type RepEnvironment = 'local' | 'sandbox' | 'nonprod' | 'prod'

type WhichEnvsAreRequired<T> = { local?: T; sandbox?: T; nonprod: T; prod: T }

//
// ===============================================================================

export function defineEnvironmentConfig<G extends ConfigGroup>(
  inputConfig: G
): (env: RepEnvironment) => ResolveConfigGroup<G> {
  return (env: RepEnvironment) => createEnvironmentConfig(env, inputConfig)
}

export function createEnvironmentConfig<G extends ConfigGroup>(
  env: RepEnvironment,
  inputConfig: G
): ResolveConfigGroup<G> {
  const errors: string[] = []

  function processConfig(config: ConfigGroup, keyPrefix: string): Record<string, any> {
    const output: Record<string, any> = {}

    for (const [key, entry] of Object.entries(config)) {
      if (key === 'env') {
        throw new Error(`Config key "env" is reserved and cannot be used. It will already be present by default.`)
      }

      const fullKey = keyPrefix ? `${keyPrefix}.${key}` : key

      if (!('doc' in entry)) {
        output[key] = processConfig(entry as ConfigGroup, fullKey)
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
      let value: any = 'value' in configEntry ? configEntry.value : undefined

      // Priority 2: per-environment value (overrides static)
      const envValue = configEntry[env]
      if (envValue !== undefined) value = envValue

      // Priority 3: runtime env var (highest precedence — always wins when defined)
      if ('processEnv' in configEntry) {
        const runtimeOverride =
          typeof process !== 'undefined' && process.env ? process.env[configEntry.processEnv as string] : undefined
        if (runtimeOverride !== undefined) value = runtimeOverride
      } else if ('importMetaEnv' in configEntry) {
        const runtimeOverride =
          // @ts-expect-error import.meta.env may not be defined in Node builds
          typeof import.meta !== 'undefined' && import.meta.env
            ? // @ts-expect-error import.meta.env may not be defined in Node builds
              import.meta.env[configEntry.importMetaEnv as string]
            : undefined
        if (runtimeOverride !== undefined) value = runtimeOverride
      }

      const hasValueSource = value !== undefined || 'processEnv' in configEntry || 'importMetaEnv' in configEntry

      if (value === undefined && !hasValueSource) {
        errors.push(
          `No value source declared for ${fullKey}. Supply a value using environment names, "value", "processEnv", or "importMetaEnv".`
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
          errors.push(`Missing required config value for ${fullKey} in environment ${env}`)
          continue
        }
      }

      //
      // Format validation and coercion
      //
      switch (configEntry.format) {
        case String:
          if (typeof value !== 'string') {
            errors.push(`Config value for ${fullKey} must be a string`)
          }
          break
        case Number:
          value = Number(value)
          if (isNaN(value)) errors.push(`Config value for ${fullKey} must be a number`)
          break
        case Boolean:
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
            errors.push(`Config value for ${fullKey} must be a boolean`)
          }
          value = value === 'true' ? true : value === 'false' ? false : Boolean(value)
          break
        case Array:
          if (!Array.isArray(value)) {
            errors.push(`Config value for ${fullKey} must be an array`)
          }
          break
        case 'url':
          try {
            new URL(value)
          } catch {
            errors.push(`Config value for ${fullKey} must be a valid URL; found "${value}"`)
          }
          break
        default:
          if (configEntry.format instanceof Array) {
            if (!configEntry.format.includes(value)) {
              errors.push(`Config value for ${fullKey} must be one of: [${configEntry.format.join(', ')}]`)
            }
          }
      }

      output[key] = value
    }

    return output
  }

  const outputConfig = processConfig(inputConfig, '')

  if (errors.length > 0) {
    console.error('Environment config validation failed', errors)
    throw new Error(`Environment config validation failed:\n${errors.join('\n')}`)
  }

  outputConfig.env = env
  return outputConfig as ResolveConfigGroup<G> & { env: RepEnvironment }
}

