import {
  AdditiveAnimationBlendMode,
  AmbientLight,
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  AnimationUtils,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  EdgesGeometry,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  Vector3Like,
  WebGLRenderer,
} from 'three'
import { clamp } from 'three/src/math/MathUtils.js'
import { $activeControls, addControlsListeners } from './controls'
import { lerpRadians, rotationToQuaternation } from './math'

import {
  ActiveCollisionTypes,
  Collider,
  ColliderDesc,
  EventQueue,
  init,
  QueryFilterFlags,
  RigidBodyDesc,
  World,
} from '@dimforge/rapier3d-compat'
import Stats from 'three/examples/jsm/libs/stats.module.js'

import {
  BlendFunction,
  EffectComposer,
  EffectPass,
  OutlineEffect,
  RenderPass,
  ShockWaveEffect,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createCircleSector } from './3d/circleSector'
import { minimapCamera, minimapRenderer } from './minimap'

await init()

const gravity = { x: 0, y: 0, z: 0 }
const $world = new World(gravity)

const $cameraOffset = { x: 8, y: 16, z: -8 }
function perspectiveCamera() {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set($cameraOffset.x, $cameraOffset.y, $cameraOffset.z)
  camera.lookAt(0, 0, 0)
  // camera.rotation.set(-2, 0.4, 2.46)
  camera.layers.enableAll()
  return camera
}

function setupRenderer() {
  const renderer = new WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: false,
    stencil: false,
    depth: false,
  })
  renderer.toneMapping = NoToneMapping
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio * 1.5)
  return renderer
}

function setupScene() {
  const scene = new Scene()
  scene.background = new Color(0xeeeeee)
  scene.fog = new Fog(0x000000, 30, 100)

  const gridHelper = new GridHelper(100, 100, `#b2b8bf`, `#b2b8bf`)
  // gridHelper.layers.set(DEBUG_LAYER)
  scene.add(gridHelper)

  scene.add(new AmbientLight(0xffffff, 1))

  scene.add(new HemisphereLight(0xffffbb, 0xffd4bb, 1))

  return scene
}

const _debug_ = true
const DEBUG_LAYER = 22

const loader = new GLTFLoader()

const barbarian = await loader.loadAsync('barbarian.glb')
barbarian.scene.receiveShadow = true

function createPlayerObject3d(position: Vector3) {
  const group = new Group()
  group.position.add(position)

  group.add(barbarian.scene)

  return group
}

function createCharacterObject3d(position: Vector3) {
  const group = new Group()
  group.position.add(position)

  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshBasicMaterial({ color: 0xffffff })
  const cube = new Mesh(geometry, material)
  cube.position.y = cube.geometry.parameters.height / 2

  group.add(cube)

  if (_debug_) {
    const edges = new EdgesGeometry(geometry)
    const edgesLines = new LineSegments(edges, new LineBasicMaterial({ color: 0xfff }))

    edgesLines.layers.set(DEBUG_LAYER)
    cube.add(edgesLines)

    // const facingDirectionLine = new Line(
    //   new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, 1.2)]),
    //   new LineBasicMaterial({ color: 'black' }),
    // )

    // facingDirectionLine.layers.set(DEBUG_LAYER)
    // group.add(facingDirectionLine)
  }

  return group
}

function createCharacterRigidBody(position: Vector3) {
  const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased()
  const rigidBody = $world.createRigidBody(rigidBodyDesc)
  rigidBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true)

  const bodyColliderDesc = ColliderDesc.cylinder(0.5, 0.7).setTranslation(0, 0.5, 0)
  const bodyCollider = $world.createCollider(bodyColliderDesc, rigidBody)

  const { vertices, indices } = createCircleSector({ radius: 2.5, height: 0, segments: 3, angle: Math.PI / 2 })
  const areaSensor = ColliderDesc.trimesh(vertices, indices)
  areaSensor.setSensor(true)
  areaSensor.translation = bodyColliderDesc.translation
  areaSensor.setActiveCollisionTypes(ActiveCollisionTypes.KINEMATIC_FIXED)
  const sensor = $world.createCollider(areaSensor, rigidBody)
  sensor.setEnabled(false)

  return {
    rigidBody,
    bodyCollider,
    sensor,
  }
}

const position = new Vector3(0, 0, 0)
const { rigidBody, bodyCollider, sensor } = createCharacterRigidBody(position)
const $player = {
  position,
  rotation: 0,
  lastMoveAt: 0,
  speed: 1,
  object3D: createPlayerObject3d(position),
  rigidBody,
  bodyCollider,
  sensor,
}

const $scene = setupScene()
const $camera = perspectiveCamera()
const $renderer = setupRenderer()

const outlineEffect = new OutlineEffect($scene, $camera, {
  multisampling: Math.min(4, $renderer.capabilities.maxSamples),
  edgeStrength: 5,
  blendFunction: BlendFunction.ALPHA,
  xRay: true,
  blur: true,
  resolutionScale: 0.6,
  // visibleEdgeColor: 0x000000,
  // hiddenEdgeColor: 0x000000,
})
const shockWaveEffect = new ShockWaveEffect($camera, new Vector3(0, 0, 0), {
  speed: 0.2,
  maxRadius: 0.005,
  waveSize: 0.008,
  amplitude: 0.025,
})
function postprocessing() {
  const composer = new EffectComposer($renderer)
  composer.addPass(new RenderPass($scene, $camera))

  composer.addPass(new EffectPass($camera, shockWaveEffect))

  composer.addPass(new EffectPass($camera, outlineEffect))

  composer.addPass(new EffectPass($camera, new ToneMappingEffect({ mode: ToneMappingMode.AGX })))
  composer.addPass(new EffectPass($camera, new SMAAEffect()))

  // composer.addPass(new EffectPass($camera, new NoiseEffect({ premultiply: true })))

  return composer
}

const $composer = postprocessing()

document.body.appendChild($renderer.domElement)

$scene.add($player.object3D)

// npc
const mage_rigidBody = $world.createRigidBody(RigidBodyDesc.dynamic())
mage_rigidBody.setTranslation({ x: 3, y: 0, z: 3 }, true)
mage_rigidBody.setEnabledRotations(false, false, false, false)
mage_rigidBody.setEnabledTranslations(true, false, true, false)
mage_rigidBody.setLinearDamping(2)
const mageBodyColliderDesc = ColliderDesc.cylinder(0.5, 0.7).setTranslation(0, 0.5, 0)
const mageCollider = $world.createCollider(mageBodyColliderDesc, mage_rigidBody)

const mage = await loader.loadAsync('mage.glb')
mage.scene.position.set(3, 0, 3)
mage.scene.scale.multiplyScalar(1.2)
outline(mage.scene)
$scene.add(mage.scene)

const mageMixer = new AnimationMixer(mage.scene)

const mageIdleClip = AnimationClip.findByName(mage.animations, 'Idle')
const mageIdleAction = mageMixer.clipAction(mageIdleClip)
mageIdleAction.play()

const mageHitClip = AnimationClip.findByName(mage.animations, 'Hit_A')
AnimationUtils.makeClipAdditive(mageHitClip)
const mageHitAction = mageMixer.clipAction(mageHitClip)
mageHitAction.loop = LoopOnce

function updateMagePosition(deltaTime: number) {
  if (mage.scene.position.distanceTo($player.position) < 10) {
    mage.scene.rotation.y = lerpRadians(
      mage.scene.rotation.y,
      Math.atan2($player.position.x - mage.scene.position.x, $player.position.z - mage.scene.position.z),
      1 - 0.0001 ** deltaTime,
    )
  }

  if (mage.scene.position.distanceTo(mage_rigidBody.translation()) <= 0.01) return
  const lerpFactor = 1 - 0.0001 ** deltaTime
  mage.scene.position.lerp(mage_rigidBody.translation(), lerpFactor)
}
//

const chest = (await loader.loadAsync('chest.glb')).scene
// outline(chest)
chest.position.set(-3, 0, 3)
chest.rotateY((3 * Math.PI) / 4)
const chest_rigidBody = $world.createRigidBody(RigidBodyDesc.fixed())
chest_rigidBody.setTranslation(chest.position, false)
const chestColliderDesc = ColliderDesc.cylinder(0.5, 1).setTranslation(0, 0.5, 0)
const chestSensor = $world.createCollider(
  ColliderDesc.cylinder(0.2, 3)
    .setSensor(true)
    .setActiveCollisionTypes(ActiveCollisionTypes.KINEMATIC_FIXED)
    .setTranslation(chestColliderDesc.translation.x, chestColliderDesc.translation.y, chestColliderDesc.translation.z),
  chest_rigidBody,
)
$world.createCollider(chestColliderDesc, chest_rigidBody)
$scene.add(chest)

const scrapStaff = (await loader.loadAsync('scrap_staff.glb')).scene
scrapStaff.scale.multiplyScalar(1.5)

const axe = await loader.loadAsync('axe.glb')
const leftHand = $player.object3D.getObjectByName('handslotl')
leftHand?.add(scrapStaff)

const knittenSword = (await loader.loadAsync('knitten_sword.glb')).scene
knittenSword.rotation.y = Math.PI / 2
const rightHand = $player.object3D.getObjectByName('handslotr')
rightHand?.add(knittenSword)

const hat = await loader.loadAsync('bearhat.glb')
const head = $player.object3D.getObjectByName('head')
head?.add(hat.scene)

addControlsListeners()

function impulseInput() {
  const { back, forward, left, right } = $activeControls

  let x = 0
  let z = 0
  let y = 0

  if (forward) --x, ++z
  if (back) ++x, --z
  if (left) ++x, ++z
  if (right) --x, --z

  // when pressing two contradictory keys, just pick a side
  if (left && right) ++x, ++z
  if (back && forward) --x, ++z

  return new Vector3(x, y, z)
}

const TICK_ms = 15 // 15ms

const mixer = new AnimationMixer(barbarian.scene)

const idleClip = AnimationClip.findByName(barbarian.animations, 'Idle')
const idleAction = mixer.clipAction(idleClip)

const runClip = AnimationClip.findByName(barbarian.animations, 'Running_A')
const runAction = mixer.clipAction(runClip)
runAction.setEffectiveTimeScale(1.5)

const walkClip = AnimationClip.findByName(barbarian.animations, 'Walking_B')
const walkAction = mixer.clipAction(walkClip)

const attackClip = AnimationClip.findByName(barbarian.animations, '1H_Melee_Attack_Slice_Diagonal')
const attackAction = mixer.clipAction(attackClip)
// attackAction.setEffectiveTimeScale(2)
AnimationUtils.makeClipAdditive(attackClip)
attackAction.blendMode = AdditiveAnimationBlendMode

attackAction.loop = LoopOnce
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && !attackAction.isRunning()) {
    attackAction.reset().play()
    setTimeout(() => $player.sensor.setEnabled(true), 250 / attackAction.timeScale)
    setTimeout(() => $player.sensor.setEnabled(false), 600 / attackAction.timeScale)
  }
})

// console.log(barbarian.animations.map((clip) => clip.name).filter((a) => !a.toLowerCase().includes('rig')))

let currentAction: AnimationAction = idleAction.play()

const updatePlayerPosition = (deltaTime: number) => {
  const distance = $player.object3D.position.distanceTo($player.position)
  const isRunning = distance >= 0.4
  const isMoving = distance >= 0.08

  const targetAction = isRunning ? runAction : isMoving ? walkAction : idleAction

  if (!targetAction.isRunning() && currentAction !== targetAction) {
    const fadeDuration = 0.15
    targetAction.reset().crossFadeFrom(currentAction, fadeDuration, false).play()
    currentAction = targetAction
  }

  if (!isMoving) return

  const lerpFactor = 1 - 0.0001 ** deltaTime
  $player.object3D.position.lerp($player.position, lerpFactor)
  $player.object3D.rotation.y = lerpRadians($player.object3D.rotation.y, $player.rotation, lerpFactor)
  $camera.position.lerp($player.object3D.position.clone().add($cameraOffset), 1 - 0.001 ** deltaTime)
}

const rapierDebugMesh = new LineSegments(
  new BufferGeometry(),
  new LineBasicMaterial({ color: 0xffffff, vertexColors: true }),
)
rapierDebugMesh.layers.set(DEBUG_LAYER)
$scene.add(rapierDebugMesh)

function updateRapierDebugMesh() {
  const { vertices, colors } = $world.debugRender()
  rapierDebugMesh.geometry.setAttribute('position', new BufferAttribute(vertices, 3))
  rapierDebugMesh.geometry.setAttribute('color', new BufferAttribute(colors, 4))
}

function computeMoviment(collider: Collider, impulse: Vector3) {
  const controller = $world.createCharacterController(0.05)
  controller.setApplyImpulsesToDynamicBodies(true)
  controller.computeColliderMovement(collider, impulse, QueryFilterFlags.EXCLUDE_SENSORS)
  const correctedMovement = controller.computedMovement()
  return correctedMovement
}

const eventQueue = new EventQueue(true)

const pillar = await loader.loadAsync('pillar.glb')
pillar.scene.position.set(-3, 0, -3)
pillar.scene.rotateY(Math.PI / 2)
$scene.add(pillar.scene)
function createArea() {
  const areaSensor = ColliderDesc.cylinder(0.2, 3)
  areaSensor.setSensor(true)
  areaSensor.translation = pillar.scene.position
  areaSensor.setActiveCollisionTypes(ActiveCollisionTypes.KINEMATIC_FIXED)
  const sensor = $world.createCollider(areaSensor)

  const pillar_rigidBody = $world.createRigidBody(RigidBodyDesc.fixed())
  pillar_rigidBody.setTranslation(pillar.scene.position, false)
  const pillarColliderDesc = ColliderDesc.cylinder(0.5, 0.7)
  $world.createCollider(pillarColliderDesc, pillar_rigidBody)

  return sensor
}

const areaCollider = createArea()

const white = new Color(0xffffff)
const red = new Color(0xffdede)
const blue = new Color(0x0055ff)
const black = new Color(0x000000)

function outline(object3D: Object3D) {
  object3D.traverse((o) => outlineEffect.selection.add(o))
}

let path: Vector3Like[] = [
  // { x: 3, y: 0, z: 0 },
  // { x: 3, y: 0, z: -4 },
  // { x: 0, y: 0, z: 0 },
  // { x: 5, y: 0, z: -5 },
  // { x: 0, y: 0, z: -3 },
  // { x: -7, y: 0, z: -3 },
  // { x: 0, y: 0, z: 0 },
]

const coin = await loader.loadAsync('coin.glb')
const pathPoint = coin.scene
let pathPoints: Group[] = []

function clearPathPoints() {
  for (const point of pathPoints) {
    $scene.remove(point)
    path = []
    pathPoints = []
  }
}

function addPathPoint(point: Vector3Like) {
  const a = pathPoint.clone()
  a.position.set(point.x, point.y, point.z)
  pathPoints.push(a)
  path.push(point)
  $scene.add(a)
}

function shiftPathPoints() {
  path.shift()
  const a = pathPoints.shift()
  if (a) $scene.remove(a)
}

function normalizeImpulse(impulse: Vector3) {
  const normalizedImpulse = impulse.clone()
  return normalizedImpulse
    .normalize()
    .multiplyScalar(clamp(impulse.length(), 0, 1)) // joysticks can go slower than 1
    .multiplyScalar(0.1)
}

const nextImpulse = (currentPosition: Vector3) => {
  const inputedImpulse = impulseInput()
  if (inputedImpulse.length()) {
    clearPathPoints()
    return inputedImpulse
  }

  let targetPosition = path[0]
  if (!targetPosition) {
    return new Vector3(0, 0, 0)
  }
  const distanceToTarget = currentPosition.distanceTo(targetPosition)

  if (distanceToTarget <= (path[1] ? 0.5 : 0.1)) {
    shiftPathPoints()
    targetPosition = path[0]
  }
  if (!targetPosition) return new Vector3(0, 0, 0)

  const impulse = new Vector3(targetPosition.x - currentPosition.x, 0, targetPosition.z - currentPosition.z)
  return impulse
}

outline($player.object3D)

function onTick() {
  const impulse = normalizeImpulse(nextImpulse($player.position))
  const movement = computeMoviment($player.bodyCollider, impulse)
  $player.position.add(movement)
  $player.rigidBody.setNextKinematicTranslation($player.position)
  if (impulse.length()) {
    $player.rotation = Math.atan2(impulse.x, impulse.z)
  }
  $player.rigidBody.setRotation(rotationToQuaternation($player.rotation), true)

  if (_debug_) {
    updateRapierDebugMesh()
  }

  $world.step(eventQueue)

  outlineEffect.visibleEdgeColor = black
  outlineEffect.pulseSpeed = 0

  $world.intersectionPairsWith($player.sensor, (collider) => {
    console.log('AAAA')
    if (collider.handle === mageCollider.handle) {
      if (!mageHitAction.isRunning()) {
        mageHitAction.reset().play()
        mage.scene.traverse((o) => {
          if (o instanceof Mesh) {
            o.material.color = red
          }
        })
      }
    }
  })
  if (!mageHitAction.isRunning()) {
    mage.scene.traverse((o) => {
      if (o instanceof Mesh) {
        o.material.color = white
      }
    })
    mageIdleAction.reset().play()
  }

  const isInsideArea = $world.intersectionPair($player.bodyCollider, areaCollider)
  if (isInsideArea) {
    outlineEffect.visibleEdgeColor = blue
    outlineEffect.pulseSpeed = 0.5
  }
}

const clock = new Clock()
const stats = new Stats()
document.body.appendChild(stats.dom)

// const tileSize = 10
// const tilesPerDimension = 3 // 3x3 grid of tiles

// const floorGeometry = new PlaneGeometry(tileSize, tileSize)
// const floorMaterial = new MeshStandardMaterial({ color: 0x808080 })

// const floorTiles: Mesh<PlaneGeometry, MeshStandardMaterial, Object3DEventMap>[] = []

// // Create a 3x3 grid of floor tiles
// for (let x = -1; x <= 1; x++) {
//   for (let z = -1; z <= 1; z++) {
//     const tile = new Mesh(floorGeometry, floorMaterial)
//     tile.rotation.x = -Math.PI / 2
//     tile.position.set(x * tileSize, 0, z * tileSize)
//     $scene.add(tile)
//     floorTiles.push(tile)
//   }
// }

// const floorCollider = $world.createCollider(
//   ColliderDesc.cuboid((tileSize * tilesPerDimension) / 2, 0.1, (tileSize * tilesPerDimension) / 2),
// )
// floorCollider.setTranslation({ x: 0, y: -0.1, z: 0 })

// function updateFloor() {
//   const cameraPosition = $camera.position

//   floorTiles.forEach((tile, index) => {
//     const tileX = Math.round(cameraPosition.x / tileSize) * tileSize + ((index % 3) - 1) * tileSize
//     const tileZ = Math.round(cameraPosition.z / tileSize) * tileSize + (Math.floor(index / 3) - 1) * tileSize

//     tile.position.set(tileX, 0, tileZ)
//   })
// }

const raycaster = new Raycaster()
const mouse = new Vector2()
const planeY = 0 // The Y-coordinate of the plane we're intersecting with

// Create an invisible plane for intersection
const intersectionPlane = new Plane(new Vector3(0, 1, 0), -planeY)

function onMouseRightClick(event: MouseEvent) {
  event.preventDefault()

  // Calculate mouse position in normalized device coordinates
  // (-1 to +1) for both components
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, $camera)

  // Calculate the point of intersection
  const intersectionPoint = new Vector3()
  raycaster.ray.intersectPlane(intersectionPlane, intersectionPoint)

  if (intersectionPoint) {
    const point = { x: intersectionPoint.x, y: 0, z: intersectionPoint.z }
    if (!event.shiftKey) {
      clearPathPoints()
    }
    addPathPoint(point)
    shockWaveEffect.position.set(point.x, 0, point.z)
    shockWaveEffect.explode()
  }
}

// Add event listener for mouse clicks
window.addEventListener('contextmenu', onMouseRightClick, false)

document.body.appendChild(minimapRenderer.domElement)

function animate() {
  const deltaTime = clock.getDelta()

  updatePlayerPosition(deltaTime)
  updateMagePosition(deltaTime)

  $renderer.render($scene, $camera)

  minimapRenderer.render($scene, minimapCamera)
  minimapCamera.position.x = $player.object3D.position.x
  minimapCamera.position.z = $player.object3D.position.z

  // updateFloor()

  mixer.update(deltaTime)
  mageMixer.update(deltaTime)

  stats.update()

  $composer.render(deltaTime)
}
$renderer.setAnimationLoop(animate)
setInterval(onTick, TICK_ms)
