import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BoxGeometry,
  MeshBasicMaterial,
  Mesh,
  Vector3,
  GridHelper,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  Color,
  Fog,
  CustomToneMapping,
  BufferGeometry,
  Line,
  Group,
  Clock,
  BufferAttribute,
  AmbientLight,
  HemisphereLight,
  AnimationMixer,
  AnimationClip,
  AnimationAction,
} from 'three'
import { $activeControls, addControlsListeners } from './controls'
import { clamp } from 'three/src/math/MathUtils.js'
import { add, lerpRadians } from './math'

import { World, ColliderDesc, RigidBodyDesc, init, Collider } from '@dimforge/rapier3d-compat'
import Stats from 'three/examples/jsm/libs/stats.module.js'

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
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.toneMapping = CustomToneMapping
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

  scene.add(new HemisphereLight(0xffffbb, 0x080820, 1))

  return scene
}

const _debug_ = true

const loader = new GLTFLoader()
const barbarian = await loader.loadAsync('barbarian.glb')
barbarian.scene.receiveShadow = true

function createPlayerObject3d(position: Vector3) {
  const group = new Group()
  group.position.add(position)

  const facingDirectionLine = new Line(
    new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, 1.2)]),
    new LineBasicMaterial({ color: 'black' }),
  )

  group.add(barbarian.scene)

  if (_debug_) {
    group.add(facingDirectionLine)
  }

  return group
}

function createCharacterObject3d(position: Vector3) {
  const group = new Group()
  group.position.add(position)

  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshBasicMaterial({ color: 0xffffff })
  const cube = new Mesh(geometry, material)
  cube.position.y = cube.geometry.parameters.height / 2

  const edges = new EdgesGeometry(geometry)
  const edgesLines = new LineSegments(edges, new LineBasicMaterial({ color: 0xfff }))

  // const circleGeometry = new EdgesGeometry(new CircleGeometry(1, 20))
  // circleGeometry.rotateX(Math.PI / 2)
  // const hitbox = new LineLoop(circleGeometry, new LineBasicMaterial({ color: 'orange' }))

  const facingDirectionLine = new Line(
    new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, 1.2)]),
    new LineBasicMaterial({ color: 'black' }),
  )

  group.add(cube)

  if (_debug_) {
    cube.add(edgesLines)
    // group.add(hitbox)
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
const $player = {
  position,
  rotation: 0,
  lastMoveAt: 0,
  speed: 1,
  object3D: createPlayerObject3d(position),
  ...createCharacterRigidBody(position),
}

const $scene = setupScene()
const $camera = perspectiveCamera()
const $renderer = setupRenderer()
document.body.appendChild($renderer.domElement)

$scene.add($player.object3D)

// npc
const npc_position = new Vector3(3, 0, 3)
createCharacterRigidBody(npc_position)
$scene.add(createCharacterObject3d(npc_position))
//

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

const runClip = AnimationClip.findByName(barbarian.animations, 'Running_B')
const runAction = mixer.clipAction(runClip)
runAction.timeScale = 2.2

let currentAction: AnimationAction = idleAction.play()

const updatePlayerPosition = (deltaTime: number) => {
  const isMoving = $player.object3D.position.distanceTo($player.position) >= 0.1
  const targetAction = isMoving ? runAction : idleAction

  if (currentAction !== targetAction) {
    const fadeDuration = isMoving ? 0.5 : 0.2
    targetAction.reset().crossFadeFrom(currentAction, fadeDuration, false).play()
    currentAction = targetAction
  }

  if (!isMoving) return

  const lerpFactor = 1 - 0.0001 ** deltaTime
  $player.object3D.position.lerp($player.position, lerpFactor)
  $player.object3D.rotation.y = lerpRadians($player.object3D.rotation.y, $player.rotation, lerpFactor)
  $camera.position.lerp(
    $player.object3D.position.clone().add($cameraOffset),
    1 - 0.001 ** deltaTime, // delay camera behind
  )
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
  controller.computeColliderMovement(collider, impulse)
  const correctedMovement = controller.computedMovement()
  return correctedMovement
}

function onTick() {
  $world.step()

  const impulse = impulseInput()
  const movement = computeMoviment($player.bodyCollider, impulse)
  const position = add($player.position, movement)
  $player.position = new Vector3(position.x, position.y, position.z)
  $player.rigidBody.setNextKinematicTranslation(position)

  if (_debug_) {
    updateRapierDebugMesh()
  }

  if (impulse.length()) $player.rotation = Math.atan2(impulse.x, impulse.z)
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
}
$renderer.setAnimationLoop(animate)
setInterval(onTick, TICK_ms)
