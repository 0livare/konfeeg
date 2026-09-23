import { afterEach, describe, expect, it, vi } from "vitest"
import {
  type CreateConfigOptions,
  createEnvironmentConfig,
  createUncheckedEnvironmentConfig,
  defineEnvironmentConfig,
  defineUncheckedEnvironmentConfig,
  type EnvName,
} from "./browser.js"

type Envs = { local?: unknown; prod: unknown }

afterEach(() => vi.unstubAllEnvs())

const schema = {
  key: {
    doc: "test",
    format: String,
    importMetaEnv: "VITE_KEY",
    prod: "production",
    value: "static",
  },
  optional: {
    doc: "test",
    importMetaEnv: "VITE_KEY",
    optional: true,
    default: "default",
  },
}

const builders: {
  name: string
  build: (
    env: EnvName<Envs>,
    input: typeof schema,
    options?: CreateConfigOptions<Envs>,
  ) => { key: string; optional: string | undefined }
}[] = [
  {
    name: "create",
    build: createEnvironmentConfig<Envs>(),
  },
  {
    name: "create unchecked",
    build: createUncheckedEnvironmentConfig<Envs>(),
  },
  {
    name: "define",
    build: (env, schema, options) =>
      defineEnvironmentConfig<Envs>()(schema, options)(env),
  },
  {
    name: "define unchecked",
    build: (env, schema, options) =>
      defineUncheckedEnvironmentConfig<Envs>()(schema, options)(env),
  },
]

describe.each(builders)("$name browser environment", ({ build }) => {
  it("automatically overrides configured values without an options argument", () => {
    vi.stubEnv("VITE_KEY", "automatic")
    expect(build("prod", schema).key).toBe("automatic")
    expect(build("local", schema).key).toBe("automatic")
  })

  it("uses an explicit map instead of the browser source", () => {
    vi.stubEnv("VITE_KEY", "automatic")
    expect(
      build("prod", schema, { importMetaEnv: { VITE_KEY: "injected" } }).key,
    ).toBe("injected")
    expect(build("prod", schema, { importMetaEnv: {} }).key).toBe("production")
    expect(
      build("prod", schema, { importMetaEnv: { VITE_KEY: undefined } }).key,
    ).toBe("production")
  })

  it("preserves fallbacks and defaults when a browser key is absent", () => {
    vi.stubEnv("VITE_KEY", undefined)
    expect(build("local", schema).key).toBe("static")
    expect(build("local", schema, { fallbacks: { local: "prod" } }).key).toBe(
      "production",
    )
    expect(build("local", schema).optional).toBe("default")
  })
})
