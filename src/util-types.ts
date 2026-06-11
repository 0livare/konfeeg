export type Prettify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Higher-kinded type emulation: a type lambda has an `arg` input slot and an `out` result slot.
 *
 * TypeScript has no higher-kinded types, so a generic type alias like
 * `WhichEnvsAreRequired<T>` cannot be passed _unapplied_ as a type argument.
 * The `TypeLambda` pattern emulates that: your interface acts as a function
 * from `this['arg']` (the value type) to `this['out']` (the per-environment
 * shape), and the library applies it internally.
 *
 * You only need to extend `TypeLambda` and set `out` — everything else is
 * handled for you.
 *
 * @example
 * ```ts
 * interface MyEnvs extends TypeLambda {
 *   readonly out: {
 *     dev?: this['arg']
 *     integ?: this['arg']
 *     staging: this['arg']
 *     production: this['arg']
 *   }
 * }
 * ```
 */
export interface TypeLambda {
  readonly arg: unknown
  readonly out: unknown
}

/** Apply a type lambda to a concrete argument. */
export type Apply<F extends TypeLambda, T> = (F & { readonly arg: T })["out"]
