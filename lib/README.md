# konfeeg

Validated, strongly-typed config for Node and the browser. Define a schema once; values are resolved, coerced, and validated at startup — missing or invalid values throw immediately.

> API is inspired by [convict](https://github.com/mozilla/node-convict/tree/master/packages/convict), but this package:
>
> - works in the browser (as well as node)
> - supports environment-specific values without requiring use of global env vars
> - supports `import.meta.env` (e.g. for Vite)

---

## Quick start

```ts
import { createEnvironmentConfig } from "konfeeg"

// 1. Declare the names of your environments
type MyEnvs = {
  dev?: unknown // optional (?) = per-env value may be omitted
  staging: unknown // required = must supply a value
  production: unknown
}

// 2. Build the config — note the extra ()    👇 (curried for TS inference)
const config = createEnvironmentConfig<MyEnvs>()("staging", {
  apiUrl: {
    doc: "Base URL for the API",
    format: "url", // Will error if the value isn't a valid URL
    processEnv: "API_URL", // runtime override (highest priority)
    dev: "http://localhost:3000",
    staging: "https://staging-api.example.com",
    production: "https://api.example.com",
  },
  logLevel: {
    doc: "Minimum log level",
    format: ["debug", "info", "warn", "error"] as const, // Must be one of these literals
    processEnv: "LOG_LEVEL",
    dev: "debug",
    staging: "info",
    production: "warn",
  },
  port: {
    doc: "HTTP port to listen on",
    format: Number, // Numeric strings (e.g. from env vars) are coerced
    processEnv: "PORT",
    value: 3000,
  },
  allowedOrigins: {
    doc: "CORS allow-list",
    format: Array, // Value must be an array
    staging: ["https://staging.example.com"],
    production: ["https://example.com", "https://admin.example.com"],
  },
  mongo: {
    dbName: {
      doc: "Mongo database name",
      format: String, // Will error if the value isn't a string
      processEnv: "MONGO_DB_NAME",
      value: "my-app-db", // static fallback (lowest priority)
    },
    poolSize: {
      doc: "Max connections in the Mongo pool",
      format: Number,
      optional: true, // missing value resolves to `default` instead of throwing
      default: 10,
    },
  },
})

config.env // "staging"
config.apiUrl // string (validated as URL)
config.logLevel // "debug" | "info" | "warn" | "error"
config.port // number
config.allowedOrigins // any[]
config.mongo.dbName // string
config.mongo.poolSize // number
```

> [!important]
> The above example hardcodes the active environment (`"staging"`) for clarity, but you'll want that to be dynamic in a real app:
>
> ```ts
> type WhichEnvsAreRequired = {
>   local?: unknown // optional (?) = per-env value may be omitted
>   nonprod: unknown // required = must supply a value
>   prod: unknown
> }
>
> type AppEnvironment = keyof WhichEnvsAreRequired // "local" | "nonprod" | "prod"
>
> const appEnv = import.meta.env.VITE_APP_ENV as AppEnvironment
> if (!appEnv) throw new Error("VITE_APP_ENV is required")
>
> const config = createEnvironmentConfig<WhichEnvsAreRequired>()(appEnv, { ... })
> ```

---

## Schema fields

| Field                             | Required | Description                                                                      |
| --------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `doc`                             | required | Human-readable description                                                       |
| `format`                          | required | Validation format — see below                                                    |
| `value`                           | optional | Constant shared across all environments (lowest priority)                        |
| `processEnv`                      | optional | `process.env` key — runtime override (highest priority)                          |
| `importMetaEnv`                   | optional | `import.meta.env` key — runtime override (highest priority)                      |
| `optional`                        | optional | When `true`, missing value resolves to `undefined` instead of throwing           |
| `default`                         | optional | Fallback when `optional: true` and no value is found                             |
| env keys (e.g. `dev`, `staging`…) | optional | Per-environment value overrides. _(These are the env names that you pass in in)_ |

---

## Formats

Validate that the resolved value matches the declared format. Coercion is applied where reasonable (e.g. numeric strings → numbers, `'true'`/`'false'` → booleans).

| Format       | Resolved type | Notes                                      |
| ------------ | ------------- | ------------------------------------------ |
| `String`     | `string`      | Value must be a string                     |
| `Number`     | `number`      | Numeric strings are coerced                |
| `Boolean`    | `boolean`     | `'true'`/`'false'` and `0`/`1` are coerced |
| `Array`      | `any[]`       | Value must be an array                     |
| `'url'`      | `string`      | Must parse as a valid URL                  |
| `['a', 'b']` | `'a' \| 'b'`  | Value must be one of the listed literals   |

---

## Value resolution order

When multiple sources are declared on the same entry, the highest-priority source wins.

| Priority    | Source                             | Use for                          |
| ----------- | ---------------------------------- | -------------------------------- |
| 3 — highest | `processEnv` / `importMetaEnv`     | Secrets, local overrides         |
| 2           | Per-env fields (`dev`, `staging`…) | Environment-specific values      |
| 1 — lowest  | `value`                            | Constants shared across all envs |

---

## Fallbacks

When an entry has no value for the active environment, resolution can fall back to another env's value. Chains are transitive. Only affects per-env resolution (priority 2) — runtime env vars still win.

```ts
const config = createEnvironmentConfig<MyEnvs>()(
  "dev",
  {
    apiUrl: {
      doc: "API URL",
      format: "url",
      // no `dev` field — falls back to `integ`
      integ: "https://integ.example.com",
      staging: "https://staging.example.com",
      production: "https://api.example.com",
    },
  },
  {
    fallbacks: {
      dev: "integ", // dev → integ
      integ: "staging", // integ → staging (chained)
    },
  },
)

config.apiUrl // "https://integ.example.com"
```

A circular fallback chain (e.g. `{ dev: 'integ', integ: 'dev' }`) throws synchronously with the cycle path in the error message.

---

## `defineEnvironmentConfig`

Same as `createEnvironmentConfig`, but binds the schema first and the environment later — useful when the environment isn't known at schema-definition time.

```ts
import { defineEnvironmentConfig } from "konfeeg"

const buildConfig = defineEnvironmentConfig<MyEnvs>()({
  /* schema */
})

const config = buildConfig(process.env.APP_ENV as any)
```
