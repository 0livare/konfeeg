/**
 * Type-level tests for the environment-config package.
 *
 * Run with `vitest --typecheck` (or set `test.typecheck.enabled` in the
 * vitest config). These tests are checked by the TypeScript compiler, not
 * executed at runtime — a failed assertion is a compile error.
 *
 * Conventions:
 * - Positive assertions use `expectTypeOf`.
 * - Negative assertions (things the types must REJECT) use `@ts-expect-error`
 *   placed on the exact line where tsc reports the error: entry-level schema
 *   violations surface on the entry's key, enum-member violations surface on
 *   the offending property, and bad env names surface on the argument.
 */
import { describe, expectTypeOf, it } from "vitest"

import { createEnvironmentConfig, defineEnvironmentConfig } from "./index.js"
import type { ResolveEntryType } from "./types.js"
import type {
  CreateConfigOptions,
  EnvName,
  Fallbacks,
  PerEnv,
} from "./util-types.js"

/** Same shape as the runtime tests: two optional envs, two required. */
type TestEnvs = {
  local?: unknown
  sandbox?: unknown
  nonprod: unknown
  prod: unknown
}

const create = createEnvironmentConfig<TestEnvs>()

describe("utility types", () => {
  it("EnvName is the union of all declared env names (required and optional)", () => {
    expectTypeOf<EnvName<TestEnvs>>().toEqualTypeOf<
      "local" | "sandbox" | "nonprod" | "prod"
    >()
    expectTypeOf<EnvName<TestEnvs>>().not.toBeAny()
    // must not widen to string
    expectTypeOf<string>().not.toExtend<EnvName<TestEnvs>>()
  })

  it("PerEnv requires required envs and keeps optional envs optional", () => {
    type PE = PerEnv<TestEnvs, string>

    // fully-specified and required-only objects are both assignable
    expectTypeOf<{
      local: string
      sandbox: string
      nonprod: string
      prod: string
    }>().toExtend<PE>()
    expectTypeOf<{ nonprod: string; prod: string }>().toExtend<PE>()

    // missing a required env is not assignable
    expectTypeOf<{ nonprod: string }>().not.toExtend<PE>()
    expectTypeOf<{ local: string; sandbox: string }>().not.toExtend<PE>()

    // value type is enforced
    expectTypeOf<{ nonprod: number; prod: number }>().not.toExtend<PE>()
  })

  it("Fallbacks maps env names to env names, all keys optional", () => {
    expectTypeOf<Fallbacks<TestEnvs>>().toEqualTypeOf<{
      local?: EnvName<TestEnvs>
      sandbox?: EnvName<TestEnvs>
      nonprod?: EnvName<TestEnvs>
      prod?: EnvName<TestEnvs>
    }>()
  })

  it("CreateConfigOptions exposes an optional fallbacks map", () => {
    expectTypeOf<CreateConfigOptions<TestEnvs>>().toEqualTypeOf<{
      fallbacks?: Fallbacks<TestEnvs>
    }>()
  })
})

describe("ResolveEntryType", () => {
  it("maps each format to its resolved value type", () => {
    expectTypeOf<ResolveEntryType<{ format: StringConstructor }>>().toBeString()
    expectTypeOf<ResolveEntryType<{ format: NumberConstructor }>>().toBeNumber()
    expectTypeOf<
      ResolveEntryType<{ format: BooleanConstructor }>
    >().toBeBoolean()
    expectTypeOf<ResolveEntryType<{ format: "url" }>>().toBeString()
    expectTypeOf<ResolveEntryType<{ format: ("a" | "b")[] }>>().toEqualTypeOf<
      "a" | "b"
    >()
    expectTypeOf<
      ResolveEntryType<{ format: ArrayConstructor }>
    >().toEqualTypeOf<any[]>()
  })

  it("resolves to any when no format is given", () => {
    expectTypeOf<ResolveEntryType<{ doc: string }>>().toBeAny()
  })

  it("typed formats never silently resolve to any", () => {
    expectTypeOf<
      ResolveEntryType<{ format: StringConstructor }>
    >().not.toBeAny()
    expectTypeOf<
      ResolveEntryType<{ format: NumberConstructor }>
    >().not.toBeAny()
    expectTypeOf<ResolveEntryType<{ format: "url" }>>().not.toBeAny()
    expectTypeOf<ResolveEntryType<{ format: ("a" | "b")[] }>>().not.toBeAny()
  })
})

describe("createEnvironmentConfig: resolved value types", () => {
  it("resolves each format on the returned config", () => {
    const config = create("nonprod", {
      str: { doc: "x", format: String, value: "v" },
      num: { doc: "x", format: Number, value: 3 },
      bool: { doc: "x", format: Boolean, value: true },
      url: { doc: "x", format: "url", value: "https://example.com" },
      arr: { doc: "x", format: Array, value: ["a", "b"] },
      mode: { doc: "x", format: ["a", "b"], value: "a" },
    })

    expectTypeOf(config.str).toBeString()
    expectTypeOf(config.num).toBeNumber()
    expectTypeOf(config.bool).toBeBoolean()
    expectTypeOf(config.url).toBeString()
    expectTypeOf(config.arr).toEqualTypeOf<any[]>()

    // enum formats narrow to the literal union of their members,
    // not the widened base type
    expectTypeOf(config.mode).toEqualTypeOf<"a" | "b">()
    expectTypeOf(config.mode).not.toEqualTypeOf<string>()

    // none of the typed entries degrade to any
    expectTypeOf(config.str).not.toBeAny()
    expectTypeOf(config.num).not.toBeAny()
    expectTypeOf(config.bool).not.toBeAny()
    expectTypeOf(config.url).not.toBeAny()
    expectTypeOf(config.mode).not.toBeAny()
  })

  it("adds an env property typed as the env-name union", () => {
    const config = create("nonprod", {
      key: { doc: "x", format: String, value: "v" },
    })
    expectTypeOf(config.env).toEqualTypeOf<EnvName<TestEnvs>>()
    expectTypeOf(config.env).toEqualTypeOf<
      "local" | "sandbox" | "nonprod" | "prod"
    >()
    expectTypeOf(config.env).not.toEqualTypeOf<string>()
    expectTypeOf(config.env).not.toBeAny()
  })

  it("resolves per-environment entries to the format's type", () => {
    const config = create("nonprod", {
      port: { doc: "x", format: Number, nonprod: 8080, prod: 80 },
    })
    expectTypeOf(config.port).toBeNumber()
    expectTypeOf(config.port).not.toBeAny()
  })

  it("resolves processEnv- and importMetaEnv-sourced entries to the format's type", () => {
    const config = create("nonprod", {
      fromProcess: { doc: "x", format: String, processEnv: "SECRET" },
      fromImportMeta: { doc: "x", format: "url", importMetaEnv: "VITE_API" },
    })
    expectTypeOf(config.fromProcess).toBeString()
    expectTypeOf(config.fromImportMeta).toBeString()
  })

  it("resolves nested groups recursively (with readonly properties)", () => {
    const config = create("prod", {
      services: {
        api: { doc: "x", format: "url", value: "https://example.com" },
        retries: { doc: "x", format: Number, value: 3 },
      },
      flag: { doc: "x", format: Boolean, value: true },
    })

    expectTypeOf(config.services.api).toBeString()
    expectTypeOf(config.services.retries).toBeNumber()
    expectTypeOf(config.flag).toBeBoolean()

    // the `const` schema inference makes resolved group properties readonly
    expectTypeOf(config.services).toEqualTypeOf<{
      readonly api: string
      readonly retries: number
    }>()

    // groups are not flattened into the parent and don't collapse to any
    expectTypeOf(config.services).not.toBeAny()
    expectTypeOf<keyof typeof config>().toEqualTypeOf<
      "services" | "flag" | "env"
    >()
  })

  it("documents current behavior: entries without a format resolve to any", () => {
    const config = create("nonprod", {
      raw: { doc: "x", value: { anything: 1 } },
    })
    expectTypeOf(config.raw).toBeAny()
  })

  it("documents current behavior: optional entries do NOT include undefined", () => {
    // At runtime an optional entry without a resolvable value yields
    // undefined, but the resolved type is still the bare format type.
    // If ResolveEntryType is ever taught about `optional`, update this.
    const config = create("nonprod", {
      opt: { doc: "x", format: String, optional: true, default: "d" },
    })
    expectTypeOf(config.opt).toBeString()
    expectTypeOf(config.opt).not.toBeUndefined()
  })

  it("narrows enum formats written with `as const` identically", () => {
    // The readonly tuple from `as const` is normalized during schema
    // inference, so it narrows the same way as a plain tuple literal.
    const config = create("nonprod", {
      mode: { doc: "x", format: ["a", "b"] as const, value: "a" },
    })
    expectTypeOf(config.mode).toEqualTypeOf<"a" | "b">()
    expectTypeOf(config.mode).not.toBeAny()
  })
})

describe("createEnvironmentConfig: schema validation", () => {
  it("rejects an unknown environment name", () => {
    create(
      // @ts-expect-error 'production' is not a declared env name
      "production",
      { key: { doc: "x", format: String, value: "v" } },
    )
  })

  it("requires at least one value source", () => {
    create("nonprod", {
      // @ts-expect-error no value / processEnv / importMetaEnv / default / per-env keys
      key: { doc: "x", format: String },
    })
  })

  it("documents current behavior: optional alone does not satisfy the value-source requirement", () => {
    // Runtime would accept this (resolving to undefined), but the types
    // demand an explicit source even for optional entries.
    create("nonprod", {
      // @ts-expect-error optional: true is not a value source at the type level
      maybe: { doc: "x", format: String, optional: true },
    })
  })

  it("enforces all-or-nothing per-env values: every required env must be present", () => {
    create("nonprod", {
      // @ts-expect-error declares nonprod but is missing required env prod
      key: { doc: "x", format: String, nonprod: "v" },
    })
    create("nonprod", {
      // @ts-expect-error optional env keys alone don't satisfy the required envs
      key: { doc: "x", format: String, local: "v", sandbox: "v" },
    })
  })

  it("accepts optional env keys once all required envs are declared", () => {
    const config = create("nonprod", {
      key: {
        doc: "x",
        format: String,
        local: "l",
        nonprod: "n",
        prod: "p",
      },
    })
    expectTypeOf(config.key).toBeString()
  })

  it("rejects declaring both processEnv and importMetaEnv", () => {
    create("nonprod", {
      // @ts-expect-error processEnv and importMetaEnv are mutually exclusive
      key: {
        doc: "x",
        format: String,
        value: "v",
        processEnv: "A",
        importMetaEnv: "B",
      },
    })
  })

  it("rejects values whose type does not match the format", () => {
    create("nonprod", {
      // @ts-expect-error number value on a String-format entry
      key: { doc: "x", format: String, value: 42 },
    })
    create("nonprod", {
      // @ts-expect-error string per-env values on a Number-format entry
      key: { doc: "x", format: Number, nonprod: "1", prod: "2" },
    })
    create("nonprod", {
      // @ts-expect-error string default on a Boolean-format entry
      key: { doc: "x", format: Boolean, default: "yes" },
    })
  })

  it("constrains enum entries to their members, erroring at the offending key", () => {
    create("nonprod", {
      mode: {
        doc: "x",
        format: ["a", "b"],
        // @ts-expect-error 'c' is not a member of the enum
        value: "c",
      },
    })
    create("nonprod", {
      mode: {
        doc: "x",
        format: ["a", "b"],
        nonprod: "a",
        // @ts-expect-error per-env values are constrained to enum members too
        prod: "c",
      },
    })
    create("nonprod", {
      mode: {
        doc: "x",
        format: ["a", "b"],
        value: "a",
        // @ts-expect-error defaults are constrained to enum members too
        default: "c",
      },
    })
  })

  it("accepts in-range enum members everywhere", () => {
    const config = create("nonprod", {
      mode: {
        doc: "x",
        format: ["a", "b"],
        nonprod: "a",
        prod: "b",
        default: "a",
      },
    })
    expectTypeOf(config.mode).toEqualTypeOf<"a" | "b">()
  })

  it("constrains fallbacks keys and values to declared env names", () => {
    const schema = { key: { doc: "x", format: String, value: "v" } } as const

    create("nonprod", schema, { fallbacks: { local: "sandbox" } })

    create("nonprod", schema, {
      // @ts-expect-error fallback target must be a declared env name
      fallbacks: { local: "unknown" },
    })
    create("nonprod", schema, {
      // @ts-expect-error fallback key must be a declared env name
      fallbacks: { unknown: "prod" },
    })
  })
})

describe("defineEnvironmentConfig", () => {
  const build = defineEnvironmentConfig<TestEnvs>()({
    port: { doc: "x", format: Number, value: 3000 },
    mode: { doc: "x", format: ["a", "b"], value: "a" },
    services: {
      api: { doc: "x", format: "url", value: "https://example.com" },
    },
  })

  it("returns a builder taking the env-name union", () => {
    expectTypeOf(build).toBeFunction()
    expectTypeOf(build).parameter(0).toEqualTypeOf<EnvName<TestEnvs>>()
    expectTypeOf(build).parameter(0).not.toEqualTypeOf<string>()
  })

  it("produces the same resolved config type as createEnvironmentConfig", () => {
    const config = build("local")
    expectTypeOf(config.port).toBeNumber()
    expectTypeOf(config.mode).toEqualTypeOf<"a" | "b">()
    expectTypeOf(config.services.api).toBeString()
    expectTypeOf(config.env).toEqualTypeOf<EnvName<TestEnvs>>()
    expectTypeOf(config).not.toBeAny()
  })

  it("rejects unknown env names at build time", () => {
    // @ts-expect-error 'production' is not a declared env name
    build("production")
  })

  it("applies the same schema validation as createEnvironmentConfig", () => {
    defineEnvironmentConfig<TestEnvs>()({
      // @ts-expect-error missing required env prod
      key: { doc: "x", format: String, nonprod: "v" },
    })
    defineEnvironmentConfig<TestEnvs>()(
      { key: { doc: "x", format: String, value: "v" } },
      {
        // @ts-expect-error fallback target must be a declared env name
        fallbacks: { local: "unknown" },
      },
    )
  })
})
