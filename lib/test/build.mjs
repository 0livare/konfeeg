import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import { runInNewContext } from "node:vm"
import { build } from "esbuild"
import { build as buildVite } from "vite"

for (const artifact of ["dist/index.mjs", "dist/index.cjs"]) {
  test(`${artifact} is CJS-safe and preserves environment resolution`, async () => {
    const source = await readFile(artifact, "utf8")
    assert.doesNotMatch(source, /\bimport\s*\.\s*meta\b/)

    const result = await build({
      entryPoints: [resolve(artifact)],
      bundle: true,
      platform: "node",
      format: "cjs",
      write: false,
      logLevel: "silent",
    })
    assert.deepEqual(result.warnings, [])
    const module = { exports: {} }
    runInNewContext(result.outputFiles[0].text, {
      module,
      exports: module.exports,
      console,
      process: { env: { API_KEY: "backend" } },
    })
    const create = module.exports.createEnvironmentConfig()
    const schema = {
      browser: {
        doc: "browser",
        importMetaEnv: "VITE_KEY",
        value: "static",
        prod: "production",
      },
      optional: {
        doc: "optional",
        importMetaEnv: "VITE_MISSING",
        optional: true,
        default: "default",
      },
      backend: { doc: "backend", processEnv: "API_KEY" },
    }
    assert.equal(create("prod", schema).browser, "production")
    assert.equal(create("local", schema).browser, "static")
    assert.equal(create("local", schema).optional, "default")
    assert.equal(create("local", schema).backend, "backend")
    assert.equal(
      create("prod", schema, { importMetaEnv: { VITE_KEY: "browser" } })
        .browser,
      "browser",
    )
  })
}

for (const consumer of ["import", "require"]) {
  test(`Node ${consumer} selects the universal artifact`, async () => {
    const result = await build({
      stdin: {
        contents:
          consumer === "import"
            ? 'export * from "konfeeg"'
            : 'module.exports = require("konfeeg")',
        resolveDir: resolve("."),
      },
      bundle: true,
      platform: "node",
      format: "cjs",
      // Even a browser condition must not redirect CommonJS require.
      conditions: consumer === "require" ? ["browser"] : [],
      metafile: true,
      write: false,
      logLevel: "silent",
    })
    assert.deepEqual(result.warnings, [])
    assert.doesNotMatch(result.outputFiles[0].text, /\bimport\s*\.\s*meta\b/)
    assert.ok(
      Object.keys(result.metafile.inputs).some((file) =>
        file.endsWith(consumer === "import" ? "index.mjs" : "index.cjs"),
      ),
    )
    assert.ok(
      Object.keys(result.metafile.inputs).every(
        (file) => !file.endsWith("browser.mjs"),
      ),
    )
  })
}

test("the browser entry tolerates runtimes without a browser environment API", async () => {
  const api = await import(pathToFileURL(resolve("dist/browser.mjs")).href)
  const create = api.createEnvironmentConfig()
  const schema = {
    key: { doc: "test", importMetaEnv: "VITE_KEY", value: "default" },
  }
  assert.equal(create("local", schema).key, "default")
  assert.equal(
    create("local", schema, { importMetaEnv: { VITE_KEY: "injected" } }).key,
    "injected",
  )
})

test("Vite selects the browser entry and supplies automatic environment values", async () => {
  const modules = new Set()
  const result = await buildVite({
    configFile: false,
    root: resolve("."),
    logLevel: "silent",
    define: { "import.meta.env.VITE_KEY": JSON.stringify("automatic") },
    plugins: [
      {
        name: "record-modules",
        generateBundle() {
          for (const id of this.getModuleIds()) modules.add(id)
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve("test/consumer.mjs"),
        formats: ["es"],
      },
    },
  })
  assert.ok([...modules].some((id) => id.endsWith("/dist/browser.mjs")))
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (bundle) => bundle.output,
  )
  const chunks = outputs.filter((output) => output.type === "chunk")
  assert.equal(chunks.length, 1)
  const api = await import(
    `data:text/javascript;base64,${Buffer.from(chunks[0].code).toString("base64")}`
  )
  const schema = {
    key: {
      doc: "browser",
      importMetaEnv: "VITE_KEY",
      value: "static",
      prod: "production",
    },
  }
  for (const name of [
    "createEnvironmentConfig",
    "createUncheckedEnvironmentConfig",
    "defineEnvironmentConfig",
    "defineUncheckedEnvironmentConfig",
  ]) {
    const builder = api[name]()
    const create = (options) =>
      name.startsWith("define")
        ? builder(schema, options)("prod")
        : builder("prod", schema, options)
    assert.equal(create().key, "automatic", name)
    assert.equal(
      create({ importMetaEnv: { VITE_KEY: "injected" } }).key,
      "injected",
      name,
    )
    assert.equal(create({ importMetaEnv: {} }).key, "production", name)
    assert.equal(
      create({ importMetaEnv: { VITE_KEY: undefined } }).key,
      "production",
      name,
    )
  }
})
