import { createEnvironmentConfig } from "konfeeg"

type WhichEnvsAreRequired = {
  local?: unknown // optional (?) = per-env value may be omitted
  nonprod: unknown // required = must supply a value
  prod: unknown
}

type AppEnvironment = keyof WhichEnvsAreRequired

const appEnv = import.meta.env.VITE_APP_ENV as AppEnvironment

console.info("Active environment: ", appEnv)
console.info("import.meta.env: ", import.meta.env) // Vite's env vars are available at runtime

export const config = createEnvironmentConfig<WhichEnvsAreRequired>()(
  appEnv,
  {
    viteFoo: {
      doc: "Example of import.meta.env override",
      format: String,
      importMetaEnv: "VITE_FOO",
      value: "default vitefoo (should _NOT_ be seen because VITE_FOO is set)",
    },
    apiUrl: {
      doc: "Base URL for the API",
      format: "url", // Will error if the value isn't a valid URL
      processEnv: "API_URL", // runtime override (highest priority)
      local: "http://localhost:3000",
      nonprod: "https://staging-api.example.com",
      prod: "https://api.example.com",
    },
    logLevel: {
      doc: "Minimum log level",
      format: ["debug", "info", "warn", "error"] as const, // Must be one of these literals
      processEnv: "LOG_LEVEL",
      local: "debug",
      nonprod: "info",
      prod: "warn",
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
      nonprod: ["https://staging.example.com"],
      prod: ["https://example.com", "https://admin.example.com"],
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
    missing: {
      doc: "Example of a missing optional value with no default. Resolves to `undefined`.",
      optional: true,
      importMetaEnv: "THIS_ENV_VAR_DOES_NOT_EXIST", // Not set, so this entry has no value source at runtime
    },
  },
  {
    fallbacks: {
      local: "nonprod", // When running in `local`, any entry that does not declare a `local` value falls back to the entry's `nonprod` value.
    },
  },
)

console.info(config)

document.getElementById("output")!.textContent = JSON.stringify(
  config,
  (_k, v) => (v === undefined ? "can't stringify undefined" : v),
  2,
)
