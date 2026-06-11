import { createEnvironmentConfig } from "./lib/index.js"

type MyEnvs = {
  dev?: unknown
  integ?: unknown
  staging: unknown
  production: unknown
}

const config = createEnvironmentConfig<MyEnvs>()(
  "dev",
  {
    aws: {
      region: {
        doc: "AWS region",
        format: String,
        value: "us-east-1",
      },
      cognito: {
        userPoolId: {
          doc: "Cognito User Pool ID",
          format: String,
          staging: "us-east-1_stagingPool",
          production: "us-east-1_prodPool",
        },
      },
    },
    mongo: {
      connectionString: {
        doc: "MongoDB connection string",
        format: "url",
        dev: "mongodb://localhost:27017/myapp",
        staging: "mongodb://localhost:27017/myapp",
        production: "mongodb://db.prod:27017/myapp",
      },
    },
    port: {
      doc: "Port to run the server on",
      format: Number,
      value: 3000,
    },
    foo: {
      doc: "Example of a value that only exists in some environments",
      processEnv: "FOO", // Can also pull from env vars
      staging: "stagingFoo",
      production: "productionFoo",
    },
    bar: {
      doc: "Example of a value that only exists in some environments",
      importMetaEnv: "VITE_BAR", // Can also pull from env vars that override
      dev: "defaultBar", // Static default value, overridden by env vars and per-env fields
      staging: "stagingBar",
      production: "productionBar",
    },
  },
  {
    fallbacks: {
      dev: "integ", // when dev is not specified, fall back to integ
      integ: "staging", // when integ is not specified, fall back to staging
    },
  },
)

console.log(config.aws.region)
console.log(config.aws.cognito.userPoolId)
console.log(config.mongo.connectionString)
console.log(config.port)
