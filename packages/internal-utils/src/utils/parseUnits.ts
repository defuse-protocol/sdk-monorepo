import { parseUnits as parseUnitsViem } from "viem"
import { assert } from "./assert"

export function parseUnits(val: string, decimals: number): bigint {
  assert(val !== "", "Invalid value: expected a non empty string.")
  const normVal = val.replaceAll(",", ".")
  return parseUnitsViem(normVal, decimals)
}
