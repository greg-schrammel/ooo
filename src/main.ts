import {
  AmbientLight,
  AnimationAction,
  AnimationClip,
  AnimationMixer,
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
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { clamp } from 'three/src/math/MathUtils.js'
import { $activeControls, addControlsListeners } from './controls'
import { lerpRadians } from './math'

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
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

await init()

const gravity = { x: 0, y: 0, z: 0 }
const $world = new World(gravity)

const $cameraOffset = { x: 8, y: 12, z: -8 }
function perspectiveCamera() {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set($cameraOffset.x, $cameraOffset.y, $cameraOffset.z)
  camera.rotation.set(-2, 0.4, 2.46)
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
  scene.add(gridHelper)

  scene.add(new AmbientLight(0xffffff, 1))

  scene.add(new HemisphereLight(0xffffbb, 0xffd4bb, 1))

  return scene
}

const _debug_ = true

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

    const facingDirectionLine = new Line(
      new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, 1.2)]),
      new LineBasicMaterial({ color: 'black' }),
    )

    cube.add(edgesLines)
    group.add(facingDirectionLine)
  }

  return group
}

function createCharacterRigidBody(position: Vector3) {
  const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased()
  const rigidBody = $world.createRigidBody(rigidBodyDesc)
  rigidBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true)

  const bodyColliderDesc = ColliderDesc.cylinder(0.5, 0.7).setTranslation(0, 0.5, 0)
  const bodyCollider = $world.createCollider(bodyColliderDesc, rigidBody)

  return {
    rigidBody,
    bodyCollider,
  }
}

const position = new Vector3(0, 0, 0)
const { rigidBody, bodyCollider } = createCharacterRigidBody(position)
const $player = {
  position,
  rotation: 0,
  lastMoveAt: 0,
  speed: 1,
  object3D: createPlayerObject3d(position),
  rigidBody,
  bodyCollider,
}

const $scene = setupScene()
const $camera = perspectiveCamera()
const $renderer = setupRenderer()

const outlineEffect = new OutlineEffect($scene, $camera, {
  multisampling: Math.min(4, $renderer.capabilities.maxSamples),
  edgeStrength: 10,
  blendFunction: BlendFunction.ALPHA,
  visibleEdgeColor: 0xffffff,
})
outlineEffect.blurPass.enabled = true

function postprocessing() {
  const composer = new EffectComposer($renderer)
  composer.addPass(new RenderPass($scene, $camera))

  // const shockWaveEffect = new ShockWaveEffect($camera, new Vector3(3, 0, 3), {
  //   speed: 0.5,
  //   maxRadius: 0.1,
  //   waveSize: 0.1,
  //   amplitude: 0.01,
  // })
  // const effectPass = new EffectPass($camera, shockWaveEffect)
  // composer.addPass(effectPass)
  // setInterval(() => shockWaveEffect.explode(), 1000)

  composer.addPass(new EffectPass($camera, outlineEffect))

  composer.addPass(new EffectPass($camera, new SMAAEffect()))
  composer.addPass(new EffectPass($camera, new ToneMappingEffect({ mode: ToneMappingMode.AGX })))

  // composer.addPass(new EffectPass($camera, new NoiseEffect({ premultiply: true })))

  return composer
}

const $composer = postprocessing()

document.body.appendChild($renderer.domElement)

$scene.add($player.object3D)

// npc
const npc_position = new Vector3(3, 0, 3)

const box_rigidBody = $world.createRigidBody(RigidBodyDesc.dynamic())
box_rigidBody.setTranslation({ x: 3, y: 0, z: 3 }, true)
const bodyColliderDesc = ColliderDesc.cylinder(0.5, 0.7).setTranslation(0, 0.5, 0)
const boxCollider = $world.createCollider(bodyColliderDesc, box_rigidBody)
$scene.add(createCharacterObject3d(npc_position))
//

const axe = await loader.loadAsync('axe.glb')
const leftHand = $player.object3D.getObjectByName('handslotl')
leftHand?.add(axe.scene)

const axe2 = axe.scene.clone()
axe2.rotation.y = Math.PI
const rightHand = $player.object3D.getObjectByName('handslotr')
rightHand?.add(axe2)

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

  const inputVector = new Vector3(x, y, z)
  const impulse = inputVector
    .normalize()
    .multiplyScalar(clamp(inputVector.length(), 0, 1)) // joysticks can go slower than 1
    .multiplyScalar(0.1)

  return impulse
}

const TICK_ms = 15 // 15ms

const mixer = new AnimationMixer(barbarian.scene)

const idleClip = AnimationClip.findByName(barbarian.animations, 'Idle')
const idleAction = mixer.clipAction(idleClip)

const runClip = AnimationClip.findByName(barbarian.animations, 'Running_A')
const runAction = mixer.clipAction(runClip)
runAction.timeScale = 1.5

const attackClip = AnimationClip.findByName(barbarian.animations, 'Dualwield_Melee_Attack_Chop')
const attackAction = mixer.clipAction(attackClip)

// console.log(barbarian.animations.map((clip) => clip.name))

let currentAction: AnimationAction = idleAction.play()

const updatePlayerPosition = (deltaTime: number) => {
  const isMoving = $player.object3D.position.distanceTo($player.position) >= 0.08
  const targetAction = isMoving ? runAction : idleAction

  if (currentAction !== targetAction) {
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
rapierDebugMesh.frustumCulled = false
$scene.add(rapierDebugMesh)

function updateRapierDebugMesh() {
  const { vertices, colors } = $world.debugRender()
  rapierDebugMesh.geometry.setAttribute('position', new BufferAttribute(vertices, 3))
  rapierDebugMesh.geometry.setAttribute('color', new BufferAttribute(colors, 4))
}

function computeMoviment(collider: Collider, impulse: Vector3) {
  const controller = $world.createCharacterController(0.05)
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
  const areaSensor = ColliderDesc.cylinder(1, 3)
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
const red = new Color(0xff0000)
const blue = new Color(0x0055ff)

function outline(object3D: Object3D) {
  object3D.traverse((o) => outlineEffect.selection.add(o))
}

function onTick() {
  const impulse = impulseInput()
  const movement = computeMoviment($player.bodyCollider, impulse)
  $player.position.add(movement)
  $player.rigidBody.setNextKinematicTranslation($player.position)
  if (impulse.length()) $player.rotation = Math.atan2(impulse.x, impulse.z)

  if (_debug_) {
    updateRapierDebugMesh()
  }

  $world.step(eventQueue)

  outline($player.object3D)

  outlineEffect.visibleEdgeColor = white
  outlineEffect.pulseSpeed = 0

  const isInsideArea = $world.intersectionPair($player.bodyCollider, areaCollider)
  if (isInsideArea) {
    outlineEffect.visibleEdgeColor = blue
    outlineEffect.pulseSpeed = 0.2
  }
}

const clock = new Clock()
const stats = new Stats()
document.body.appendChild(stats.dom)

function animate() {
  const deltaTime = clock.getDelta()

  updatePlayerPosition(deltaTime)

  $renderer.render($scene, $camera)

  mixer.update(deltaTime)

  stats.update()

  $composer.render(deltaTime)
}
$renderer.setAnimationLoop(animate)
setInterval(onTick, TICK_ms)
