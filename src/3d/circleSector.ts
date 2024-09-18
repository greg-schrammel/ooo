export function createCircleSector({
  radius = 2,
  height = 1,
  segments = 8,
  angle = Math.PI / 2, // 90 degrees
}) {
  const halfAngle = angle / 2
  const angleStep = angle / segments
  const verticesPerFace = segments + 2
  const totalVertices = verticesPerFace * 2

  const vertices = new Float32Array(totalVertices * 3)
  const indices = new Uint32Array(segments * 12 + 12)

  let vertexIndex = 0
  let indiceIndex = 0

  const halfHeight = height / 2

  // Generate vertices
  for (let i = 0; i < 2; i++) {
    const y = i === 0 ? halfHeight : -halfHeight

    // Center point
    vertices[vertexIndex] = 0
    vertices[vertexIndex + 1] = y
    vertices[vertexIndex + 2] = 0
    vertexIndex += 3

    // Edge vertices
    for (let j = 0; j <= segments; j++) {
      const angle = j * angleStep + halfAngle
      const cosAngle = Math.cos(angle)
      const sinAngle = Math.sin(angle)

      vertices[vertexIndex] = radius * cosAngle
      vertices[vertexIndex + 1] = y
      vertices[vertexIndex + 2] = radius * sinAngle
      vertexIndex += 3
    }
  }

  // Generate indices
  for (let i = 0; i < segments; i++) {
    const topCenter = 0
    const bottomCenter = verticesPerFace

    // Top face
    indices[indiceIndex++] = topCenter
    indices[indiceIndex++] = i + 1
    indices[indiceIndex++] = i + 2

    // Bottom face
    indices[indiceIndex++] = bottomCenter
    indices[indiceIndex++] = bottomCenter + i + 2
    indices[indiceIndex++] = bottomCenter + i + 1

    // Side faces
    indices[indiceIndex++] = i + 1
    indices[indiceIndex++] = bottomCenter + i + 1
    indices[indiceIndex++] = i + 2

    indices[indiceIndex++] = bottomCenter + i + 1
    indices[indiceIndex++] = bottomCenter + i + 2
    indices[indiceIndex++] = i + 2
  }

  //   // Back faces
  indices[indiceIndex++] = 0
  indices[indiceIndex++] = verticesPerFace
  indices[indiceIndex++] = 1

  indices[indiceIndex++] = verticesPerFace
  indices[indiceIndex++] = verticesPerFace + 1
  indices[indiceIndex++] = 1

  indices[indiceIndex++] = 0
  indices[indiceIndex++] = segments + 1
  indices[indiceIndex++] = verticesPerFace

  indices[indiceIndex++] = segments + 1
  indices[indiceIndex++] = verticesPerFace + segments + 1
  indices[indiceIndex++] = verticesPerFace

  return { vertices, indices }
}
