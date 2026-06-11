export type ConfigEntryBase<T, E> = {
  doc: string
  optional?: boolean
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
} & (WhichEnvsAreRequired<T> | { value: T } | {}) &
  (
    | { processEnv: string; importMetaEnv?: never }
    | { importMetaEnv: string; processEnv?: never }
    | { processEnv?: never; importMetaEnv?: never }
  )

export type StringEntry = ConfigEntryBase<string> & {
  format: StringConstructor
  default?: string
}

export type NumberEntry = ConfigEntryBase<number> & {
  format: NumberConstructor
  default?: number
}

export type BooleanEntry = ConfigEntryBase<boolean> & {
  format: BooleanConstructor
  default?: boolean
}

export type ArrayEntry<T> = ConfigEntryBase<T[]> & {
  format: ArrayConstructor
  default?: T[]
}

export type EnumEntry<T> = ConfigEntryBase<T> & {
  format: T[]
  default?: T
}

export type UrlEntry = ConfigEntryBase<string> & {
  format: 'url'
  default?: string
}

export type UntypedEntry = ConfigEntryBase<any> & { format?: never; default?: any }

export type ConfigEntry<T> = UntypedEntry | StringEntry | NumberEntry | BooleanEntry | ArrayEntry<T> | EnumEntry<T> | UrlEntry

export type ConfigGroup = { [key: string]: ConfigEntry<any> | ConfigGroup }

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
  [K in keyof G]: G[K] extends { doc: string } ? ResolveEntryType<G[K]> : ResolveConfigGroup<G[K]>
}