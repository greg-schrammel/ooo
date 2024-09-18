import { OrthographicCamera, WebGLRenderer } from 'three'

const minimapSize = 10
export const minimapCamera = new OrthographicCamera(-minimapSize, minimapSize, minimapSize, -minimapSize, 1, 1000)

// minimapCamera.layers.set(DEBUG_LAYER)
minimapCamera.layers.enableAll()

minimapCamera.position.set(0, 10, 0)
minimapCamera.lookAt(0, 0, 0)
minimapCamera.rotation.z = (3 * Math.PI) / 4

export const minimapRenderer = new WebGLRenderer({ alpha: true, antialias: true })
minimapRenderer.setSize(200, 200)
minimapRenderer.domElement.style.position = 'absolute'
minimapRenderer.domElement.style.bottom = '10px'
minimapRenderer.domElement.style.right = '10px'
