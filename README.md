# createEnvironmentConfig

```ts
createEnvironmentConfig(env: AppEnvironment, config: ConfigGroup): ResolveConfigGroup<G>
defineEnvironmentConfig(config: ConfigGroup): (env: AppEnvironment) => ResolveConfigGroup<G>
```

Builds a validated, strongly-typed config object for the given environment. Define your schema once; values are resolved, coerced, and validated at startup so missing or misconfigured values fail fast.

> [!important]
> Throws if any required value is missing or fails format validation. This surfaces broken `.env` files immediately rather than at runtime.

The resolved object always includes an `env` property set to the active `AppEnvironment`.

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

| Priority    | Source                                       | When to use                                     |
| ----------- | -------------------------------------------- | ----------------------------------------------- |
| 1 — lowest  | `value: T`                                   | A constant shared across all environments       |
| 2           | `local`, `sandbox`, `nonprod`, `prod` fields | Per-environment overrides of the static value   |
| 3 — highest | `processEnv` / `importMetaEnv`               | Secrets and local overrides supplied at runtime |

**Example:** an entry with `value: 'default'`, `nonprod: 'nonprod-specific'`, and `processEnv: 'MY_VAR'` resolves to:

- `'default'` in `sandbox` (no sandbox override, no env var set)
- `'nonprod-specific'` in `nonprod` (no env var set)
- `process.env.MY_VAR` in any environment when the variable is defined

---

## Example

```ts
const config = createEnvironmentConfig('sandbox', {
  apiUrl: {
    doc: 'Base URL for the API',
    format: 'url',
    processEnv: 'API_URL', // priority 3: runtime override
    local: 'http://localhost:3000',
    sandbox: 'https://sandbox-api.example.com',
    nonprod: 'https://nonprod-api.example.com',
    prod: 'https://api.example.com',
  },
  mongo: {
    dbName: {
      doc: 'Mongo database name',
      format: String,
      processEnv: 'MONGO_DB_NAME', // priority 3: runtime override
      value: 'my-app-db', // priority 1: static fallback
    },
    password: {
      doc: 'Mongo database password',
      format: String,
      processEnv: 'MONGO_PASSWORD', // runtime-only — no static fallback
    },
  },
})

config.env // 'sandbox'
config.apiUrl // string
config.mongo.dbName // string
config.mongo.password // string
```

---

## `defineEnvironmentConfig`

Identical to `createEnvironmentConfig` but returns a factory function instead of immediately resolving. Useful when the environment is not known at schema-definition time.

```ts
const buildConfig = defineEnvironmentConfig({
  /* schema */
})
const config = buildConfig(process.env.APP_ENV as AppEnvironment)
```
