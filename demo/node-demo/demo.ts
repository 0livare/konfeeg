import "dotenv/config"
import { createEnvironmentConfig } from "konfeeg"

type MyEnvs = {
  dev?: unknown // optional (?) = per-env value may be omitted
  staging: unknown // required = must supply a value
  production: unknown
}

type MyEnvNames = Prettify<keyof MyEnvs> //  "dev" | "integ" | "staging" | "production"

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

console.info(config)
console.info("\n\n")
console.info("config.env: ", config.env) // "staging"
console.info("config.apiUrl: ", config.apiUrl) // string (validated as URL)
console.info("config.logLevel: ", config.logLevel) // "debug" | "info" | "warn" | "error"
console.info("config.port: ", config.port) // number
console.info("config.allowedOrigins: ", config.allowedOrigins) // any[]
console.info("config.mongo.dbName: ", config.mongo.dbName) // string
console.info("config.mongo.poolSize: ", config.mongo.poolSize) // number

//

type Prettify<T> = { [K in keyof T]: T[K] } & {}
