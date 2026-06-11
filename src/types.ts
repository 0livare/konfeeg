import type { Apply, TypeLambda } from "./util-types.js"

export type EnvName<E extends TypeLambda> = keyof Apply<E, any> & string

export type ConfigEntryBase<T, E extends TypeLambda> = {
  doc: string
  optional?: boolean
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
} & (Apply<E, T> | { value: T } | {}) &
  (
    | { processEnv: string; importMetaEnv?: never }
    | { importMetaEnv: string; processEnv?: never }
    | { processEnv?: never; importMetaEnv?: never }
  )

export type ConfigGroup<E extends TypeLambda> = {
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

export type ConfigEntry<T, E extends TypeLambda> =
  | UntypedEntry<E>
  | StringEntry<E>
  | NumberEntry<E>
  | BooleanEntry<E>
  | ArrayEntry<T, E>
  | EnumEntry<T, E>
  | UrlEntry<E>

type StringEntry<E extends TypeLambda> = ConfigEntryBase<string, E> & {
  format: StringConstructor
  default?: string
}

type NumberEntry<E extends TypeLambda> = ConfigEntryBase<number, E> & {
  format: NumberConstructor
  default?: number
}

type BooleanEntry<E extends TypeLambda> = ConfigEntryBase<boolean, E> & {
  format: BooleanConstructor
  default?: boolean
}

type ArrayEntry<T, E extends TypeLambda> = ConfigEntryBase<T[], E> & {
  format: ArrayConstructor
  default?: T[]
}

type EnumEntry<T, E extends TypeLambda> = ConfigEntryBase<T, E> & {
  format: T[]
  default?: T
}

type UrlEntry<E extends TypeLambda> = ConfigEntryBase<string, E> & {
  format: "url"
  default?: string
}

type UntypedEntry<E extends TypeLambda> = ConfigEntryBase<any, E> & {
  format?: never
  default?: any
}
