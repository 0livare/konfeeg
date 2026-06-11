import type { EnvName, EnvsShape, PerEnv } from "./util-types.js"

// Every env key must be absent. Used by the "no per-env keys" arm so it
// doesn't structurally subsume the "per-env required" arm.
type NoEnvKeys<E extends EnvsShape> = { [K in EnvName<E>]?: never }

// processEnv and importMetaEnv are mutually exclusive; both may also be absent.
type RuntimeSourceOptional<T> =
  | { value?: T; processEnv?: never; importMetaEnv?: never }
  | { value?: T; processEnv: string; importMetaEnv?: never }
  | { value?: T; processEnv?: never; importMetaEnv: string }

// At least one of value / processEnv / importMetaEnv must be present.
type ValueSourceRequired<T> =
  | { value: T; processEnv?: never; importMetaEnv?: never }
  | { value?: T; processEnv: string; importMetaEnv?: never }
  | { value?: T; processEnv?: never; importMetaEnv: string }

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

// prettier-ignore
export type ResolveEntryType<E> =
  E extends {format: StringConstructor} ? string :
  E extends {format: NumberConstructor} ? number :
  E extends {format: BooleanConstructor} ? boolean :
  E extends {format: 'url'} ? string :
  E extends {format: (infer F)[]} ? F :
  E extends {format: ArrayConstructor} ? any[] :
  any

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
