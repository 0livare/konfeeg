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

// A discriminated-union node: a `variants` map whose sole entry-valued child
// is the discriminant (its entry value, having `doc`, distinguishes it from
// the group-valued variant options). The discriminant's KEY name becomes the
// output property carrying the selected variant's literal, and only that
// variant's sub-group is resolved/required at runtime. Any siblings of
// `variants` are shared fields resolved for every variant.
//
// Because every member is a normal entry or a normal group, a variant node is
// already a valid `ConfigGroup`; it is distinguished structurally (a
// `variants` key, no `doc`) rather than by widening the `ConfigGroup` union —
// the latter degrades `const` inference of readonly tuples elsewhere.
export type VariantGroup<
  E extends EnvsShape,
  DiscriminantKey extends string,
> = {
  variants: { [variantKey: string]: ConfigGroup<E> } & {
    [K in DiscriminantKey]: EnumEntry<any, E>
  }
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

// Collapses an intersection into a single flat object type for clean output.
type Simplify<T> = { [K in keyof T]: T[K] }

// The key of the sole entry-valued child of `variants` — only an entry has a
// string `doc`; the group-valued children are the variant options, and a
// group can never have a string-valued `doc`, so this detection is
// unambiguous.
type DiscriminantKeyOf<V> = {
  [K in keyof V]: V[K] extends { doc: string } ? K : never
}[keyof V] &
  string

// Turns a variant group into a discriminated union: one member per variant,
// each carrying the variant's key as the discriminant literal (under the
// discriminant's key name) plus the resolved fields of that variant's
// sub-group. The siblings of `variants` are shared fields intersected into
// every member.
export type ResolveVariantGroup<Node> = Node extends { variants: infer V }
  ? {
      // Skip the discriminant's own key when enumerating the variant options.
      // `& string`: runtime variant keys come from `Object.keys` (always
      // strings), so exclude any number/symbol keys to match runtime behavior.
      [VK in Exclude<keyof V & string, DiscriminantKeyOf<V>>]: Simplify<
        { [P in DiscriminantKeyOf<V>]: VK } & ResolveConfigGroup<
          V[VK & keyof V]
        > &
          ResolveConfigGroup<Omit<Node, "variants">>
      >
    }[Exclude<keyof V & string, DiscriminantKeyOf<V>>]
  : never

export type ResolveConfigGroup<G> = {
  [K in keyof G]: G[K] extends { doc: string }
    ? ResolveEntryType<G[K]>
    : G[K] extends { variants: unknown }
      ? ResolveVariantGroup<G[K]>
      : ResolveConfigGroup<G[K]>
}

// Resolves a top-level schema. Unlike a nested group — whose variant children
// are detected per-key by ResolveConfigGroup — the root schema can itself be a
// variant group, in which case the ENTIRE config resolves to a discriminated
// union. `& { env }` on the caller then distributes across every union member.
export type ResolveTopLevelConfig<G> = G extends { variants: unknown }
  ? ResolveVariantGroup<G>
  : ResolveConfigGroup<G>

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

// The "expected" type reported for an enum-constrained key holding a value
// outside the format's members. Deliberately an OBJECT (non-unit) type: the
// schema is checked against `G & ValidateSchema<G, E>`, and if the corrected
// property type were the enum's literal union, a conflicting literal would be
// a discriminant-property clash that reduces the whole intersected entry to
// `never` — smearing the error across every sibling key instead of pinning it
// to the offending one.
type InvalidEnumMember<V> = { "Expected one of the enum format members": V }

// Walks a schema and for enum entries (format is a readonly tuple) constrains
// per-env / value / default keys to the enum's literal union, reporting errors
// at the specific key rather than at the whole entry. Nested groups and variant
// groups (a `variants` map plus a discriminant enum entry) are recursed as-is —
// the discriminant is validated as an ordinary enum entry by this same walk.
export type ValidateSchema<G, E extends EnvsShape> = {
  [K in keyof G]: G[K] extends { format: readonly (infer V)[] }
    ? {
        [P in keyof G[K]]: P extends EnvName<E> | "value" | "default"
          ? G[K][P] extends V | undefined
            ? G[K][P]
            : InvalidEnumMember<V>
          : G[K][P]
      }
    : G[K] extends { format: unknown }
      ? G[K]
      : G[K] extends { doc: string }
        ? G[K] // unformatted entry (no format field) — pass through as-is
        : ValidateSchema<G[K], E>
}
