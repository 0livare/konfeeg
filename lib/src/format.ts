/* eslint-disable @typescript-eslint/no-explicit-any */

export function validateAndCoerce(
  value: any,
  format: any,
  fullKey: string,
  errors: string[],
): any {
  switch (format) {
    case String:
      if (typeof value !== "string") {
        errors.push(`Config value for ${fullKey} must be a string`)
      }
      break
    case Number:
      value = Number(value)
      if (isNaN(value))
        errors.push(`Config value for ${fullKey} must be a number`)
      break
    case Boolean:
      if (
        typeof value !== "boolean" &&
        value !== "true" &&
        value !== "false" &&
        value !== 1 &&
        value !== 0
      ) {
        errors.push(`Config value for ${fullKey} must be a boolean`)
      }
      value =
        value === "true" ? true : value === "false" ? false : Boolean(value)
      break
    case Array:
      if (!Array.isArray(value)) {
        errors.push(`Config value for ${fullKey} must be an array`)
      }
      break
    case "url":
      try {
        new URL(value)
      } catch {
        errors.push(
          `Config value for ${fullKey} must be a valid URL; found "${value}"`,
        )
      }
      break
    default:
      if (format instanceof Array) {
        if (!format.includes(value)) {
          errors.push(
            `Config value for ${fullKey} must be one of: [${format.join(", ")}]`,
          )
        }
      }
  }

  return value
}
