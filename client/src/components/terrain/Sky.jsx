import { useLoader, useThree, useFrame } from '@react-three/fiber'
import { TextureLoader } from 'three'
import * as THREE from 'three'
import { useRef } from 'react'

export default function Sky({ src = '/models/maps/sky.jpg' }) {
  const tex = useLoader(TextureLoader, src)
  const { camera } = useThree()
  const ref = useRef()
  useFrame(() => { if (ref.current) ref.current.position.copy(camera.position) })
  return (
    <mesh ref={ref} frustumCulled={false}>
      <sphereGeometry args={[500, 32, 32]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  )
}