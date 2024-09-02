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
  CircleGeometry,
  LineLoop,
  BufferGeometry,
  Line,
  Group,
} from 'three'
import { $activeControls, addControlsListeners } from './controls'
import { clamp } from 'three/src/math/MathUtils.js'
import { lerpRadians } from './math'

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

  return scene
}

function createCircle() {
  const circleGeometry = new EdgesGeometry(new CircleGeometry(1.2, 20))
  circleGeometry.rotateX(Math.PI / 2)
  return new LineLoop(circleGeometry, new LineBasicMaterial({ color: 'orange' }))
}

const _debug_ = true

function playerObject3D() {
  const group = new Group()

  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshBasicMaterial({ color: 0xffffff })
  const cube = new Mesh(geometry, material)
  cube.position.y = cube.geometry.parameters.height / 2

  const edges = new EdgesGeometry(geometry)
  const edgesLines = new LineSegments(edges, new LineBasicMaterial({ color: 0xfff }))

  const hitbox = createCircle()

  const facingDirectionLine = new Line(
    new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, 1.5)]),
    new LineBasicMaterial({ color: 'black' }),
  )

  group.add(cube)

  if (_debug_) {
    cube.add(edgesLines)
    group.add(hitbox)
    group.add(facingDirectionLine)
  }

  return group
}

const $player = {
  position: new Vector3(0, 0, 0),
  rotation: 0,
  lastMoveAt: 0,
  speed: 1,
  object3D: playerObject3D(),
}

const $scene = setupScene()
const $camera = perspectiveCamera()
const $renderer = setupRenderer()
document.body.appendChild($renderer.domElement)

// const controls = new OrbitControls($camera, $renderer.domElement)

$scene.add($player.object3D)

addControlsListeners()

function impulseInput() {
  const { back, forward, left, right, dodge } = $activeControls

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
    .multiplyScalar(dodge ? 10 : 1)

  return impulse
}

const TICK_ms = 15 // 15ms

const updatePlayerPosition = (deltaTime: number) => {
  if (performance.now() - $player.lastMoveAt > TICK_ms) {
    // only move once per tick
    $player.lastMoveAt = performance.now()

    const impulse = impulseInput()
    $player.position = $player.position.add(impulse.multiplyScalar(0.1 * $player.speed))
    if (impulse.length()) $player.rotation = Math.atan2(impulse.x, impulse.z)
  }

  const lerpFactor = 1 - 0.0001 ** deltaTime
  $player.object3D.position.lerp($player.position, lerpFactor)
  $player.object3D.rotation.y = lerpRadians($player.object3D.rotation.y, $player.rotation, lerpFactor)
  // $camera.lookAt($player.object3D.position)
  $camera.position.lerp(
    $player.object3D.position.clone().add($cameraOffset),
    lerpFactor, // delay camera behind
  )
}

let initFpsRecord = performance.now()
let fps_counter = 0
function trackFps(onUpdate: (fps: number) => void) {
  fps_counter++
  if (performance.now() - initFpsRecord > 1000) {
    onUpdate(fps_counter)
    fps_counter = 0
    initFpsRecord = performance.now()
  }
}

let prevFrameTimestamp = performance.now()
function animate() {
  const frameTimestamp = performance.now()
  const deltaTime = (frameTimestamp - prevFrameTimestamp) * 0.001 // in seconds
  prevFrameTimestamp = frameTimestamp

  // trackFps((fps) => console.log(fps))

  updatePlayerPosition(deltaTime)

  $renderer.render($scene, $camera)
}
$renderer.setAnimationLoop(animate)
