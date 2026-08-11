# konfeeg

Validated, strongly-typed, multi-environment config for Node and the browser. Define a schema once; values are resolved, coerced, and validated at startup — missing or invalid values throw immediately.

## Features

| Feature                       | konfeeg | [convict] | [node-config] |
| ----------------------------- | ------- | --------- | ------------- |
| Browser support               | ✅      | ❌        | ❌            |
| First-class multi-env support | ✅      | ❌        | ❌            |
| Runtime env var overrides     | ✅      | ✅        | ✅            |
| Strongly typed                | ✅      | ✅        | ❌            |
| Supports `import.meta.env`    | ✅      | ❌        | ❌            |
| Runtime validation            | ✅      | ✅        | ❌            |
| Conditional / variant config  | ✅      | ❌        | ❌            |
| Custom validations            | ❌      | ✅        | ❌            |

[convict]: https://github.com/mozilla/node-convict/tree/master/packages/convict [node-config]: https://github.com/node-config/node-config

---

## Quick start

```ts
import { createEnvironmentConfig } from "konfeeg";

// 1. Declare the names of your environments
type MyEnvs = {
  dev?: unknown; // optional (?) = per-env value may be omitted
  staging: unknown; // required = must supply a value
  production: unknown;
};

// 2. Build the config —- note the extra (), it's curried for TS inference
const config = createEnvironmentConfig<MyEnvs>()("staging", {
  // ← this env name should be dynamic in a real app
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
});

config.env; // "staging"
config.apiUrl; // string (validated as URL)
config.logLevel; // "debug" | "info" | "warn" | "error"
config.port; // number
config.allowedOrigins; // string[]
config.mongo.dbName; // string
config.mongo.poolSize; // number
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
> // type AppEnvironment = keyof WhichEnvsAreRequired // "local" | "nonprod" | "prod"
>
> const appEnv = import.meta.env.VITE_APP_ENV as AppEnvironment
> if (!appEnv) throw new Error("VITE_APP_ENV is required")
>
> const config = createEnvironmentConfig<WhichEnvsAreRequired>()(appEnv, { ... })
> ```

---

## Schema fields

| Field                             | Required | Description                                                                                                                                                               |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doc`                             | required | Human-readable description                                                                                                                                                |
| `format`                          | optional | Validation format — see [below](#formats). If omitted, no validation is applied; the resolved type is inferred from `value`/per-env fields, or `any` if none are declared |
| `value`                           | optional | Constant shared across all environments (lowest priority)                                                                                                                 |
| `processEnv`                      | optional | `process.env` key — runtime override (highest priority)                                                                                                                   |
| `importMetaEnv`                   | optional | `import.meta.env` key — runtime override (highest priority)                                                                                                               |
| `optional`                        | optional | When `true`, missing value will not throw. Resolves to `default` field or `undefined`                                                                                     |
| `default`                         | optional | Fallback to replace `undefined` when `optional: true` and no value is found                                                                                               |
| env keys (e.g. `dev`, `staging`…) | optional | Per-environment value overrides. _(These are the env names that you pass in in)_                                                                                          |

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
      integ: "staging", // integ → staging (chains with prev. fallback is now dev → integ → staging)
    },
  },
);

config.apiUrl; // "https://integ.example.com"
```

A circular fallback chain (e.g. `{ dev: 'integ', integ: 'dev' }`) throws synchronously with the cycle path in the error message.

---

## Variant groups (conditional config)

Sometimes which fields are required depends on the value of another field. A **variant group** models this as a discriminated union: an enum entry (the _discriminant_) selects which sub-group of fields is resolved. Only the selected variant's fields are resolved and required — the others are never read.

A variant group is any node with a `variants` map (including the root config object itself). Inside the map, the discriminant is its only direct entry — everything else is a group holding one variant's fields. The groups themselves do not exist in the final config, only the contents of the selected variant group are resolved.

So the structure is:

```js
// This can exist at the root of the config or at any nested level.
{
  variants: {
    myVariantKey: { doc: "...", format: ["foo", "bar"] as const },
    foo: { // <-- group for one of the myVariantKey strings (does not exist in final config)
       fooField1: { doc: "...", format: String },
       fooField2: { doc: "...", format: Number },
     },
    bar: { // <-- group for one of the myVariantKey strings (does not exist in final config)
      barField1: { doc: "...", format: Boolean },
      barField2: { doc: "...", format: Array },
     },
  }
}
```

Here's a complete example of a variant group at the root of the config:

```ts
const config = createEnvironmentConfig<MyEnvs>()("production", {
  // Shared field — a sibling of `variants`, resolved for every variant.
  poolSize: { doc: "Max pool size", format: Number, value: 10 },
  variants: {
    // The discriminant. Its key ("driver") is the output property name.
    driver: {
      doc: "Database driver",
      format: ["pg", "awsDataApi"] as const,
      processEnv: "DB_DRIVER",
      value: "pg", // default driver (a runtime DB_DRIVER wins)
    },
    pg: {
      connectionString: {
        doc: "PG URL",
        format: String,
        processEnv: "DATABASE_URL",
      },
    },
    awsDataApi: {
      resourceArn: {
        doc: "Resource ARN",
        format: String,
        processEnv: "DB_RESOURCE_ARN",
      },
      secretArn: {
        doc: "Secret ARN",
        format: String,
        processEnv: "DB_SECRET_ARN",
      },
      database: { doc: "DB name", format: String, processEnv: "DB_NAME" },
    },
  },
});

// The whole `config` is a discriminated union — narrow it with the discriminant:
if (config.driver === "pg") {
  config.connectionString; // string
} else {
  config.resourceArn; // string
}
config.poolSize; // number — a shared field, available on every variant
```

Resolves to:

```ts
// `config` — each member also carries `env: "dev" | "staging" | "production"`
| { driver: "pg"; poolSize: number; connectionString: string }
| { driver: "awsDataApi"; poolSize: number; resourceArn: string; secretArn: string; database: string }
```

- The discriminant is a normal enum entry, so it supports the full value resolution order (`value`, per-env fields, `processEnv`/`importMetaEnv`) and [fallbacks](#fallbacks). It's distinguished from the variant groups around it by being an entry (it has a `doc`).
- Selecting one variant does **not** require the other variants' sources.
- If the discriminant resolves to a value with no matching variant, resolution throws and lists the valid variant keys.
- Variant groups work anywhere a regular entry or group can — at the root of the config (as above), inside a group, or inside another variant.
- Shared fields (siblings of `variants`) resolve flat alongside the selected variant's fields. A shared field whose key collides with the discriminant key or with a field of the selected variant is ambiguous and throws.

> [!note]
> `variants` is a reserved key: a group containing a `variants` child is always treated as a variant group.

---

## `defineEnvironmentConfig`

Same as `createEnvironmentConfig`, but binds the schema first and the environment later — useful when the environment isn't known at schema-definition time.

```ts
import { defineEnvironmentConfig } from "konfeeg";

const buildConfig = defineEnvironmentConfig<MyEnvs>()({/* schema */});

const config = buildConfig(process.env.APP_ENV as any);
```

---

## Building your own wrapper

If you need to create several configs in your project that all use the same environment names, you can wrap `createEnvironmentConfig` in a function that pre-defines your org's env names and env-resolution logic.

When creating a wrapper, in order to keep strong typing and avoid type casts, a functionally equivalent `createUncheckedEnvironmentConfig` function is provided to keep TypeScript happy.

```ts
import {
  createUncheckedEnvironmentConfig,
  type ConfigGroup,
  type ResolveTopLevelConfig,
  type ValidateSchema,
} from "konfeeg";

type MyCompanyAppEnvs = {
  local?: unknown;
  staging: unknown;
  production: unknown;
};

export type MyCompanyAppEnvironment = keyof MyCompanyAppEnvs; // "local" | "staging" | "production"

function resolveMyCompanyAppEnvironment(): MyCompanyAppEnvironment {
  const env = process.env.APP_ENV;
  if (!env) throw new Error("APP_ENV is required");
  return env as MyCompanyAppEnvironment;
}

// Bind the envs once; this plain-`G` builder is the forwarding target.
const buildConfig = createUncheckedEnvironmentConfig<MyCompanyAppEnvs>();

export function createMyCompanyAppConfig<
  const G extends ConfigGroup<MyCompanyAppEnvs>,
>(
  schema: G & ValidateSchema<G, MyCompanyAppEnvs>,
): ResolveTopLevelConfig<G> & { env: MyCompanyAppEnvironment } {
  return buildConfig(resolveMyCompanyAppEnvironment(), schema);
}
```

This composes to any depth, a second generic forwarder (e.g. `createLambdaConfig`) can declare its own `G & ValidateSchema<G, E>` parameter and forward into the same sink, staying cast-free while validating enum literals at each boundary.

Consumers now declare only a schema; the env names and the active environment come from the wrapper:

```ts
import { createMyCompanyAppConfig } from "./app-config.js";

export const config = createMyCompanyAppConfig({
  logLevel: {
    doc: "Minimum log level",
    format: ["debug", "info", "warn"] as const,
    staging: "info",
    production: "warn",
  },
});

config.env; // "local" | "staging" | "production"
config.logLevel; // "debug" | "info" | "warn"
```

Inference is fully preserved through the wrapper: literal types, enum unions, [variant groups](#variant-groups-conditional-config), and schema errors all behave exactly as they do on a direct call, and a bad enum value is still reported on the offending key rather than smeared across its siblings.
