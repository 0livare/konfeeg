import { describe, expectTypeOf, it } from "vitest"
import * as browser from "./browser.js"
import type * as universal from "./index.js"

type Envs = { local?: unknown; prod: unknown }

describe("browser API types", () => {
  it("preserves the universal builders' signatures", () => {
    expectTypeOf<typeof browser>().toEqualTypeOf<typeof universal>()
  })

  it("infers resolved types and validates schemas at both checked boundaries", () => {
    const create = browser.createEnvironmentConfig<Envs>()
    const define = browser.defineEnvironmentConfig<Envs>()
    const schema = {
      mode: {
        doc: "mode",
        format: ["on" as const, "off" as const],
        importMetaEnv: "VITE_MODE",
      },
      port: { doc: "port", format: Number, value: 3000 },
    }
    const config = create("local", schema)
    expectTypeOf(config.mode).toEqualTypeOf<"on" | "off">()
    expectTypeOf(config.port).toBeNumber()
    expectTypeOf(define(schema)("prod")).toEqualTypeOf<typeof config>()

    // @ts-expect-error unknown environment
    create("unknown", schema)
    create("local", {
      // @ts-expect-error value must be a member of the enum
      mode: { doc: "mode", format: ["on", "off"] as const, value: "invalid" },
    })
    define({
      // @ts-expect-error value must be a member of the enum
      mode: { doc: "mode", format: ["on", "off"] as const, value: "invalid" },
    })
  })
})
