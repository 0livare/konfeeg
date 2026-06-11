# configee

Build a validated, strongly-typed config object for the current environment. Define your schema once; values are resolved, coerced, and validated at startup so missing or misconfigured values fail fast. Works in Node and the browser.

> [!important]
> Throws if any required value is missing or fails format validation. This surfaces broken `.env` files immediately rather than at runtime.

The resolved object always includes an `env` property set to the active environment.

---

## Defining your environments

You decide what your environments are called and which are required vs. optional. Environments are declared as a plain object type: each key is an environment name, required envs are required properties, optional envs are optional properties. The property value type is unused by the library, so `unknown` is fine:

```ts
type MyEnvs = {
  dev?: unknown // optional environment
  integ?: unknown // optional environment
  staging: unknown // required environment
  production: unknown // required environment
}
```

- A **required** property means every config entry that supplies any per-env values must supply this one (unless it uses `value`, `processEnv`, `importMetaEnv`, or `optional`).
- An **optional** property (`?`) means the per-env value may be omitted.

Pass `MyEnvs` as the type argument when you build a config. Note the trailing
`()` — the function is curried so the schema can be inferred on the second
call:

```ts
// 👀 Note the extra trailing `()`            👇 -- The function is curried to help TS infer the correct types
const config = createEnvironmentConfig<MyEnvs>()("production", {
  /* schema */
})
```

---

## Schema entry fields

Each leaf entry in the config schema must have:

| Field      | Required | Description                                                               |
| ---------- | -------- | ------------------------------------------------------------------------- |
| `doc`      | yes      | Human-readable description of the value                                   |
| `format`   | yes      | Validation format — see [Formats](#formats)                               |
| `optional` | no       | When `true`, a missing value resolves to `undefined` rather than throwing |
| `default`  | no       | Fallback when the entry is `optional` and no value is found               |

### Formats

| Format       | Resolved type | Notes                                              |
| ------------ | ------------- | -------------------------------------------------- |
| `String`     | `string`      | Value must be a string                             |
| `Number`     | `number`      | Numeric strings (e.g. from env vars) are coerced   |
| `Boolean`    | `boolean`     | `'true'`/`'false'` strings and `0`/`1` are coerced |
| `Array`      | `any[]`       | Value must be an array                             |
| `'url'`      | `string`      | Value must parse as a valid URL                    |
| `['a', 'b']` | `'a' \| 'b'`  | Value must be one of the listed literals           |

---

## Value resolution precedence

When multiple sources are declared on the same entry, the highest-priority source that resolves to a defined value wins.

| Priority    | Source                         | When to use                                     |
| ----------- | ------------------------------ | ----------------------------------------------- |
| 1 — lowest  | `value: T`                     | A constant shared across all environments       |
| 2           | Per-environment fields         | Per-environment overrides of the static value   |
| 3 — highest | `processEnv` / `importMetaEnv` | Secrets and local overrides supplied at runtime |

The per-environment field names match the property names on your envs declaration (e.g. `dev`, `integ`, `staging`, `production`).

**Example:** an entry with `value: 'default'`, `staging: 'staging-specific'`, and `processEnv: 'MY_VAR'` resolves to:

- `'default'` in `dev` (no dev override, no env var set)
- `'staging-specific'` in `staging` (no env var set)
- `process.env.MY_VAR` in any environment when the variable is defined

---

## Example

```ts
import { createEnvironmentConfig } from "configee"

type MyEnvs = {
  dev?: unknown
  integ?: unknown
  staging: unknown
  production: unknown
}

// 👀 Note the extra trailing `()`            👇 -- The function is curried to help TS infer the correct types
const config = createEnvironmentConfig<MyEnvs>()("staging", {
  apiUrl: {
    doc: "Base URL for the API",
    format: "url",
    processEnv: "API_URL", // priority 3: runtime override
    dev: "http://localhost:3000",
    staging: "https://staging-api.example.com",
    production: "https://api.example.com",
  },
  mongo: {
    dbName: {
      doc: "Mongo database name",
      format: String,
      processEnv: "MONGO_DB_NAME", // priority 3: runtime override
      value: "my-app-db", // priority 1: static fallback
    },
    password: {
      doc: "Mongo database password",
      format: String,
      processEnv: "MONGO_PASSWORD", // runtime-only — no static fallback
    },
  },
})

config.env // 'staging'
config.apiUrl // string
config.mongo.dbName // string
config.mongo.password // string
```

---

## `defineEnvironmentConfig`

Identical to `createEnvironmentConfig` but binds the schema first and the environment later. Useful when the environment is not known at schema-definition time.

```ts
import { defineEnvironmentConfig } from "configee"

const buildConfig = defineEnvironmentConfig<MyEnvs>()({
  /* schema */
})

const config = buildConfig(process.env.APP_ENV as any)
```

---

## Options

Both `createEnvironmentConfig` and `defineEnvironmentConfig` accept an optional `options` object as the last argument to their schema-binding call.

| Argument position             | `createEnvironmentConfig` | `defineEnvironmentConfig` |
| ----------------------------- | ------------------------- | ------------------------- |
| Schema-binding call signature | `(env, schema, options?)` | `(schema, options?)`      |

```ts
type CreateConfigOptions<E extends EnvsShape> = {
  fallbacks?: Fallbacks<E>
}

type Fallbacks<E extends EnvsShape> = Partial<Record<EnvName<E>, EnvName<E>>>
```

### `fallbacks` — environment fallback chains

When resolving a per-environment value, if the active environment has no value declared on a given entry, resolution can fall back to a different environment's value. Fallbacks chain transitively: if `A` falls back to `B` and `B` falls back to `C`, then `A` will use `C`'s value when neither `A` nor `B` has one.

Fallbacks only affect the **per-environment** resolution step (Priority 2). The static `value`, `processEnv`, and `importMetaEnv` sources are unaffected — runtime env vars still win, and a static `value` is still used when no env in the chain resolves.

```ts
type MyEnvs = {
  dev?: unknown
  integ?: unknown
  staging: unknown
  production: unknown
}

const config = createEnvironmentConfig<MyEnvs>()(
  "dev",
  {
    apiUrl: {
      doc: "API URL",
      format: "url",
      // No `dev` field — resolves via fallback to `integ`.
      integ: "https://integ.example.com",
      staging: "https://staging.example.com",
      production: "https://api.example.com",
    },
  },
  {
    fallbacks: {
      dev: "integ", // when running in dev, fall back to integ
      integ: "staging", // chained: integ falls back further to staging
    },
  },
)

config.apiUrl // 'https://integ.example.com'
```

**Resolution order with fallbacks:**

1. The active env's own per-environment field (e.g. `dev`)
2. The fallback env named in `fallbacks[activeEnv]` (e.g. `integ`)
3. The next fallback in the chain (e.g. `staging`), and so on
4. Static `value`, if declared
5. Runtime env var (`processEnv` / `importMetaEnv`) — always wins when defined, regardless of fallback resolution

**Notes:**

- Fallbacks only apply when the active env matches a key in the `fallbacks` map. Other envs resolve as if no fallback were configured.
- A circular fallback chain (e.g. `{ dev: 'integ', integ: 'dev' }`) throws synchronously when the config is built, with the cycle path included in the error message.
- The `env` property on the resolved config always reflects the **active** environment, not the env a value was sourced from.
