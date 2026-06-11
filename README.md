# configee

Build a validated, strongly-typed config object for the current environment. Define your schema once; values are resolved, coerced, and validated at startup so missing or misconfigured values fail fast. Works in Node and the browser.

```ts
createEnvironmentConfig<E>(env: EnvName<E>, config: ConfigGroup<E>): ResolveConfigGroup<G>
defineEnvironmentConfig<E>(config: ConfigGroup<E>): (env: EnvName<E>) => ResolveConfigGroup<G>
```

> [!important]
> Throws if any required value is missing or fails format validation. This surfaces broken `.env` files immediately rather than at runtime.

The resolved object always includes an `env` property set to the active environment.

---

## Defining your environments

You decide what your environments are called and which are required vs. optional. Environments are declared as a `TypeLambda` — an interface that maps a value type `T` onto the per-environment shape:

```ts
import type { TypeLambda } from "configee"

interface MyEnvs extends TypeLambda {
  readonly out: {
    dev?: this["arg"] // optional environment
    integ?: this["arg"] // optional environment
    staging: this["arg"] // required environment
    production: this["arg"] // required environment
  }
}
```

- A **required** field means every config entry must supply a value for that environment (unless it has a `value`, `processEnv`, `importMetaEnv`, or is marked `optional`).
- An **optional** field (`?`) means the environment may be omitted on any entry.

Pass `MyEnvs` as the first type argument when you build a config:

```ts
const config = createEnvironmentConfig<MyEnvs>("production", {
  /* schema */
})
```

`EnvName<MyEnvs>` resolves to `'dev' | 'integ' | 'staging' | 'production'`.

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

The per-environment field names match the keys you declared on your `TypeLambda` (e.g. `dev`, `integ`, `staging`, `production`).

**Example:** an entry with `value: 'default'`, `staging: 'staging-specific'`, and `processEnv: 'MY_VAR'` resolves to:

- `'default'` in `dev` (no dev override, no env var set)
- `'staging-specific'` in `staging` (no env var set)
- `process.env.MY_VAR` in any environment when the variable is defined

---

## Example

```ts
import { createEnvironmentConfig } from "configee"
import type { TypeLambda } from "configee"

interface MyEnvs extends TypeLambda {
  readonly out: {
    dev?: this["arg"]
    integ?: this["arg"]
    staging: this["arg"]
    production: this["arg"]
  }
}

const config = createEnvironmentConfig<MyEnvs>("staging", {
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

Identical to `createEnvironmentConfig` but returns a factory function instead of immediately resolving. Useful when the environment is not known at schema-definition time.

```ts
const buildConfig = defineEnvironmentConfig<MyEnvs>({
  /* schema */
})

const config = buildConfig(process.env.APP_ENV as EnvName<MyEnvs>)
```
