import { Vector } from 'three/examples/jsm/Addons.js'

type Radians = number // number between Pi and -Pi

export function lerpRadians(angleFrom: Radians, angleTo: Radians, lerpFactor: number): Radians {
  const diff = ((angleTo - angleFrom + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return (angleFrom + diff * lerpFactor + Math.PI * 2) % (Math.PI * 2)
}

export function add(a: Vector, b: Vector): Vector {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }
}

export function rotationToQuaternation(rotation: number) {
  return {
    x: 0,
    y: Math.sin(rotation / 2),
    z: 0,
    w: Math.cos(rotation / 2),
  }
}
