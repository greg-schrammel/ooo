import { Vector } from 'three/examples/jsm/Addons.js'
import { lerp } from 'three/src/math/MathUtils.js'

type Radians = number // number between Pi and -Pi

const PI_TIMES_TWO = Math.PI * 2
export function lerpRadians(angleFrom: Radians, angleTo: Radians, lerpFactor: number) {
  const diff = angleTo - angleFrom

  if (diff < -Math.PI) {
    // lerp upwards past PI_TIMES_TWO
    angleTo += PI_TIMES_TWO
    const result = lerp(angleFrom, angleTo, lerpFactor)
    if (result >= PI_TIMES_TWO) return result - PI_TIMES_TWO
    return result
  }

  if (diff > Math.PI) {
    // lerp downwards past 0
    angleTo -= PI_TIMES_TWO
    const result = lerp(angleFrom, angleTo, lerpFactor)
    if (result < 0) return result + PI_TIMES_TWO
    return result
  }

  // straight lerp
  return lerp(angleFrom, angleTo, lerpFactor)
}

export function add(a: Vector, b: Vector): Vector {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }
}
