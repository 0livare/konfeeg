import type { EnvName, EnvsShape, PerEnv } from "./util-types.js"

// Every env key must be absent. Used by the "no per-env keys" arm so it
// doesn't structurally subsume the "per-env required" arm.
type NoEnvKeys<E extends EnvsShape> = { [K in EnvName<E>]?: never }

// processEnv and importMetaEnv are mutually exclusive; both may also be absent.
type RuntimeSourceOptional<T> =
  | { value?: T; processEnv?: never; importMetaEnv?: never }
  | { value?: T; processEnv: string; importMetaEnv?: never }
  | { value?: T; processEnv?: never; importMetaEnv: string }

// At least one of value / processEnv / importMetaEnv must be present,
// OR default may be the sole source when optional: true is also set.
type ValueSourceRequired<T> =
  | { value: T; processEnv?: never; importMetaEnv?: never }
  | { value?: T; processEnv: string; importMetaEnv?: never }
  | { value?: T; processEnv?: never; importMetaEnv: string }
  | {
      optional: true
      value?: T
      processEnv?: never
      importMetaEnv?: never
      default: T
    }

// Per-env values are all-or-nothing for required envs. If an entry supplies
// any env-named key (required or optional), it must supply all required
// env-named keys. Otherwise it must declare a value source explicitly.
type ValueSource<T, E extends EnvsShape> =
  | (PerEnv<E, T> & RuntimeSourceOptional<T>)
  | (NoEnvKeys<E> & ValueSourceRequired<T>)

export type ConfigEntryBase<T, E extends EnvsShape> = {
  doc: string
  optional?: boolean
} & ValueSource<T, E>

export type ConfigGroup<E extends EnvsShape> = {
  [key: string]: ConfigEntry<any, E> | ConfigGroup<E>
}

// Widens T to T | undefined for optional entries that declare no default
// (those can legitimately resolve to undefined at runtime).
type MaybeOptionalUndefined<E, T> = E extends { optional: true }
  ? E extends { default: any }
    ? T
    : T | undefined
  : T

// Keys that are part of the entry schema contract and are NOT per-env value fields.
type ReservedEntryKeys =
  | "doc"
  | "format"
  | "optional"
  | "default"
  | "value"
  | "processEnv"
  | "importMetaEnv"

// Prevent `never` from propagating — use `any` as the fallback.
type NeverToAny<T> = [T] extends [never] ? any : T

// For entries without a format, infer the resolved type from statically-known
// value sources: the `value` field, the `default` field, and any per-environment
// fields. Falls back to `any` when none are present (e.g. processEnv/importMetaEnv
// only, since their values aren't known until runtime).
type UntypedResolved<E> = NeverToAny<
  | (E extends { value: infer V } ? V : never)
  | (E extends { default: infer D } ? D : never)
  | (E extends Record<string, any>
      ? E[Exclude<keyof E, ReservedEntryKeys>]
      : never)
>

// Widens primitive literals to their base type. Used for Array-format entries
// so that e.g. per-env values typed as `"https://…"` resolve to `string[]`
// rather than a const-tuple type.
// biome-ignore format: intending makes this nesting harder to read
type WideElement<T> =
  T extends string ? string :
  T extends number ? number :
  T extends boolean ? boolean :
  T

// For Array-format entries, infer the element type from statically-known value
// sources and widen primitive literals. Falls back to `any` when no static
// sources are declared (e.g. processEnv/importMetaEnv only).
type ArrayElementType<E> =
  UntypedResolved<E> extends readonly (infer Item)[] ? WideElement<Item> : any

// biome-ignore format: intending makes this nesting harder to read
export type ResolveEntryType<E> =
  E extends {format: StringConstructor} ? MaybeOptionalUndefined<E, string> :
  E extends {format: NumberConstructor} ? MaybeOptionalUndefined<E, number> :
  E extends {format: BooleanConstructor} ? MaybeOptionalUndefined<E, boolean> :
  E extends {format: 'url'} ? MaybeOptionalUndefined<E, string> :
  E extends {format: (infer F)[]} ? MaybeOptionalUndefined<E, F> :
  E extends {format: ArrayConstructor} ? MaybeOptionalUndefined<E, ArrayElementType<E>[]> :
  MaybeOptionalUndefined<E, UntypedResolved<E>>

export type ResolveConfigGroup<G> = {
  [K in keyof G]: G[K] extends { doc: string }
    ? ResolveEntryType<G[K]>
    : ResolveConfigGroup<G[K]>
}

//
// Format validation
//

export type ConfigEntry<T, E extends EnvsShape> =
  | UntypedEntry<E>
  | StringEntry<E>
  | NumberEntry<E>
  | BooleanEntry<E>
  | ArrayEntry<T, E>
  | EnumEntry<T, E>
  | UrlEntry<E>

type StringEntry<E extends EnvsShape> = ConfigEntryBase<string, E> & {
  format: StringConstructor
  default?: string
}

type NumberEntry<E extends EnvsShape> = ConfigEntryBase<number, E> & {
  format: NumberConstructor
  default?: number
}

type BooleanEntry<E extends EnvsShape> = ConfigEntryBase<boolean, E> & {
  format: BooleanConstructor
  default?: boolean
}

type ArrayEntry<T, E extends EnvsShape> = ConfigEntryBase<T[], E> & {
  format: ArrayConstructor
  default?: T[]
}

type EnumEntry<T, E extends EnvsShape> = ConfigEntryBase<T, E> & {
  format: T[]
  default?: T
}

type UrlEntry<E extends EnvsShape> = ConfigEntryBase<string, E> & {
  format: "url"
  default?: string
}

type UntypedEntry<E extends EnvsShape> = ConfigEntryBase<any, E> & {
  format?: never
  default?: any
}

// Walks a schema and for enum entries (format is a readonly tuple) constrains
// per-env / value / default keys to the enum's literal union, reporting errors
// at the specific key rather than at the whole entry.
export type ValidateSchema<G, E extends EnvsShape> = {
  [K in keyof G]: G[K] extends { format: readonly (infer V)[] }
    ? {
        [P in keyof G[K]]: P extends EnvName<E> | "value" | "default"
          ? G[K][P] extends V | undefined
            ? G[K][P]
            : V
          : G[K][P]
      }
    : G[K] extends { format: unknown }
      ? G[K]
      : G[K] extends { doc: string }
        ? G[K] // unformatted entry (no format field) — pass through as-is
        : ValidateSchema<G[K], E>
}
