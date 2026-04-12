import { useThree, useFrame } from '@react-three/fiber'

export default function CameraDebugger() {
  const { camera } = useThree()

  useFrame(() => {
    console.log('Camera position:', camera.position)
    // También puedes ver hacia dónde mira:
    // console.log('Camera rotation:', camera.rotation)
  })

  return null
}