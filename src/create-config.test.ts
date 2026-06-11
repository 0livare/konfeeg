/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest"
import { createEnvironmentConfig, type TypeLambda } from "./index.js"
import type { ConfigGroup, EnvName, ResolveConfigGroup } from "./types.js"

declare const process: { env: Record<string, string | undefined> }

type TestEnvsShape<T> = { local?: T; sandbox?: T; nonprod: T; prod: T }

interface TestEnvs extends TypeLambda {
  readonly out: TestEnvsShape<this["arg"]>
}

const testCreateConfig = <G extends ConfigGroup<TestEnvs>>(
  env: EnvName<TestEnvs>,
  config: G,
): ResolveConfigGroup<G> => createEnvironmentConfig<TestEnvs, G>(env, config)

function baseEntry(value: any) {
  return {
    doc: "test",
    local: value,
    nonprod: value,
    prod: value,
  }
}

describe("environment selection", () => {
  it("reads from the local environment", () => {
    const config = testCreateConfig("local", {
      key: {
        ...baseEntry("shared-value"),
        local: "local-value",
        format: String,
      },
    })
    expect(config.key).toBe("local-value")
  })

  it("reads from the sandbox environment", () => {
    const config = testCreateConfig("sandbox", {
      key: {
        doc: "test",
        format: String,
        local: "local-value",
        sandbox: "sandbox-value",
        nonprod: "nonprod-value",
        prod: "prod-value",
      },
    })
    expect(config.key).toBe("sandbox-value")
  })

  it("reads from the nonprod environment", () => {
    const config = testCreateConfig("nonprod", {
      key: {
        ...baseEntry("nonprod-value"),
        nonprod: "nonprod-value",
        format: String,
      },
    })
    expect(config.key).toBe("nonprod-value")
  })

  it("reads from the prod environment", () => {
    const config = testCreateConfig("prod", {
      key: {
        ...baseEntry("nonprod-value"),
        prod: "prod-value",
        format: String,
      },
    })
    expect(config.key).toBe("prod-value")
  })

  it("falls back to a static value when no sandbox-specific value is declared", () => {
    const config = testCreateConfig("sandbox", {
      key: { doc: "test", format: String, value: "shared-value" },
    })
    expect(config.key).toBe("shared-value")
  })

  it("throws when running in sandbox with no sandbox value and no fallback", () => {
    expect(() =>
      testCreateConfig("sandbox", {
        key: {
          doc: "test",
          format: String,
          nonprod: "nonprod-value",
          prod: "prod-value",
        },
      }),
    ).toThrow()
  })
})

describe("value sources", () => {
  it("reads a static value", () => {
    const config = testCreateConfig("nonprod", {
      key: { ...baseEntry("hello"), format: String },
    })
    expect(config.key).toBe("hello")
  })

  it("reads from process.env", () => {
    process.env.TEST_EC_KEY = "env-value"
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        processEnv: "TEST_EC_KEY",
        nonprod: "static-value",
        prod: "static-value",
      },
    })
    expect(config.key).toBe("env-value")
    delete process.env.TEST_EC_KEY
  })

  it("falls back to the static value when process.env is not set", () => {
    delete process.env.TEST_EC_KEY
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        processEnv: "TEST_EC_KEY",
        nonprod: "static-value",
        prod: "static-value",
      },
    })
    expect(config.key).toBe("static-value")
  })
})

describe("value source precedence", () => {
  // Priority 3 > Priority 2: runtime env var beats per-environment value
  it("processEnv overrides a per-environment value", () => {
    process.env.TEST_EC_PREC = "runtime-value"
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        processEnv: "TEST_EC_PREC",
        nonprod: "env-value",
        prod: "env-value",
      },
    })
    expect(config.key).toBe("runtime-value")
    delete process.env.TEST_EC_PREC
  })

  it("processEnv overrides a static value", () => {
    process.env.TEST_EC_PREC = "runtime-value"
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        processEnv: "TEST_EC_PREC",
        value: "static-value",
      },
    })
    expect(config.key).toBe("runtime-value")
    delete process.env.TEST_EC_PREC
  })

  it("processEnv overrides a sandbox-specific value", () => {
    process.env.TEST_EC_PREC = "runtime-value"
    const config = testCreateConfig("sandbox", {
      key: {
        doc: "test",
        format: String,
        processEnv: "TEST_EC_PREC",
        local: "local-value",
        sandbox: "sandbox-value",
        nonprod: "nonprod-value",
        prod: "prod-value",
      },
    })
    expect(config.key).toBe("runtime-value")
    delete process.env.TEST_EC_PREC
  })

  // Priority 2 > Priority 1: per-environment value beats static value
  it("per-environment value overrides a static value", () => {
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        value: "static-value",
        nonprod: "env-specific",
        prod: "env-specific",
      },
    })
    expect(config.key).toBe("env-specific")
  })

  it("sandbox-specific value overrides a static value", () => {
    const config = testCreateConfig("sandbox", {
      key: {
        doc: "test",
        format: String,
        value: "static-value",
        sandbox: "sandbox-specific",
      },
    })
    expect(config.key).toBe("sandbox-specific")
  })

  // When runtime var is absent, fall back through the priority chain
  it("uses the per-environment value when processEnv is declared but the runtime var is not set", () => {
    delete process.env.TEST_EC_UNSET
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        processEnv: "TEST_EC_UNSET",
        nonprod: "env-value",
        prod: "env-value",
      },
    })
    expect(config.key).toBe("env-value")
  })

  it("uses the static value when processEnv is declared, the runtime var is not set, and no per-environment value exists", () => {
    delete process.env.TEST_EC_UNSET
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        processEnv: "TEST_EC_UNSET",
        value: "static-value",
      },
    })
    expect(config.key).toBe("static-value")
  })
})

describe("format validation", () => {
  it("accepts a string value", () => {
    const config = testCreateConfig("nonprod", {
      key: { ...baseEntry("hello"), format: String },
    })
    expect(config.key).toBe("hello")
  })

  it("throws when a string format receives a non-string value", () => {
    expect(() =>
      testCreateConfig("nonprod", {
        key: { ...baseEntry(42), format: String },
      }),
    ).toThrow()
  })

  it("coerces a numeric string to a number", () => {
    const config = testCreateConfig("nonprod", {
      key: { ...baseEntry("42"), format: Number },
    })
    expect(config.key).toBe(42)
  })

  it("throws when a number format receives a non-numeric value", () => {
    expect(() =>
      testCreateConfig("nonprod", {
        key: { ...baseEntry("not-a-number"), format: Number },
      }),
    ).toThrow()
  })

  it("coerces boolean-like values to boolean", () => {
    const trueConfig = testCreateConfig("nonprod", {
      key: { ...baseEntry("true"), format: Boolean },
    })
    expect(trueConfig.key).toBe(true)

    // Boolean(false) and Boolean(0) correctly yield false
    const falseConfig = testCreateConfig("nonprod", {
      key: { ...baseEntry(false), format: Boolean },
    })
    expect(falseConfig.key).toBe(false)

    const zeroConfig = testCreateConfig("nonprod", {
      key: { ...baseEntry(0), format: Boolean },
    })
    expect(zeroConfig.key).toBe(false)
  })

  it("throws when a boolean format receives a non-boolean-like value", () => {
    expect(() =>
      testCreateConfig("nonprod", {
        key: { ...baseEntry("notabool"), format: Boolean },
      }),
    ).toThrow()
  })

  it("accepts an array value", () => {
    const config = testCreateConfig("nonprod", {
      key: { ...baseEntry(["a", "b"]), format: Array },
    })
    expect(config.key).toEqual(["a", "b"])
  })

  it("throws when an array format receives a non-array value", () => {
    expect(() =>
      testCreateConfig("nonprod", {
        key: { ...baseEntry("not-an-array"), format: Array },
      }),
    ).toThrow()
  })

  it("accepts a valid URL", () => {
    const config = testCreateConfig("nonprod", {
      key: { ...baseEntry("https://example.com"), format: "url" },
    })
    expect(config.key).toBe("https://example.com")
  })

  it("throws when a url format receives an invalid URL", () => {
    expect(() =>
      testCreateConfig("nonprod", {
        key: { ...baseEntry("not-a-url"), format: "url" },
      }),
    ).toThrow()
  })

  it("accepts a value that is in the enum list", () => {
    const config = testCreateConfig("nonprod", {
      key: { ...baseEntry("b"), format: ["a", "b", "c"] },
    })
    expect(config.key).toBe("b")
  })

  it("throws when an enum format receives a value not in the list", () => {
    expect(() =>
      testCreateConfig("nonprod", {
        key: { ...baseEntry("z"), format: ["a", "b", "c"] },
      }),
    ).toThrow()
  })
})

describe("nested groups", () => {
  it("preserves the group structure in the output", () => {
    const config = testCreateConfig("nonprod", {
      db: {
        url: { ...baseEntry("https://db.example.com"), format: String },
        poolSize: { ...baseEntry(5), format: Number },
      },
    })
    expect(config.db.url).toBe("https://db.example.com")
    expect(config.db.poolSize).toBe(5)
  })

  it("supports multiple groups at the top level", () => {
    const config = testCreateConfig("nonprod", {
      db: { url: { ...baseEntry("https://db.example.com"), format: String } },
      auth: { secret: { ...baseEntry("s3cr3t"), format: String } },
    })
    expect(config.db.url).toBe("https://db.example.com")
    expect(config.auth.secret).toBe("s3cr3t")
  })

  it("supports deeply nested groups", () => {
    const config = testCreateConfig("nonprod", {
      services: {
        payments: {
          url: { ...baseEntry("https://pay.example.com"), format: String },
        },
      },
    })
    expect(config.services.payments.url).toBe("https://pay.example.com")
  })

  it("includes the full key path in error messages for nested entries", () => {
    expect(() =>
      testCreateConfig("nonprod", {
        db: {
          url: {
            doc: "test",
            format: String,
            processEnv: "SURELY_NOT_SET_ZXQY",
          },
        },
      }),
    ).toThrow("db.url")
  })

  it("mixes top-level entries and groups", () => {
    const config = testCreateConfig("nonprod", {
      appName: { ...baseEntry("my-app"), format: String },
      db: { url: { ...baseEntry("https://db.example.com"), format: String } },
    })
    expect(config.appName).toBe("my-app")
    expect(config.db.url).toBe("https://db.example.com")
  })
})

describe("optional and defaults", () => {
  it("throws for a missing required value", () => {
    expect(() =>
      testCreateConfig("nonprod", {
        key: {
          doc: "test",
          format: String,
          processEnv: "SURELY_NOT_SET_ZXQY",
        },
      }),
    ).toThrow()
  })

  it("resolves to undefined when optional with no default and no value", () => {
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        optional: true,
        processEnv: "SURELY_NOT_SET_ZXQY",
      },
    })
    expect(config.key).toBeUndefined()
  })

  it("uses the default when the value is missing and the entry is optional", () => {
    const config = testCreateConfig("nonprod", {
      key: {
        doc: "test",
        format: String,
        optional: true,
        default: "fallback",
        processEnv: "SURELY_NOT_SET_ZXQY",
      },
    })
    expect(config.key).toBe("fallback")
  })
})
