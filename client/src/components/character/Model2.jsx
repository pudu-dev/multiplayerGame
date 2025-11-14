/* npx gltfjsx public/models/character/green_alien.glb -o src/components/character/Model2.jsx -r public */

import { useRef, useState, useMemo, useEffect } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

export function Model({
  color = "green",
  animation = "Idle",
  ...props
}) {
  const group = useRef()
  const { scene, animations } = useGLTF('/models/character/green_alien.glb')
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes} = useGraph(clone)
  const { actions } = useAnimations(animations, group)

  const [currentAnim, setCurrentAnim] = useState(animation)

  // Cross-fade entre animaciones; si no hay `animation` reproducir la primera disponible
  useEffect(() => {
    if (!actions) return
    const names = Object.keys(actions)
    // si no se pasó animation, y no hay currentAnim, arrancar la primera animación del glb
    if (!animation && !currentAnim && names.length) {
      const first = names[0]
      actions[first]?.reset().fadeIn(0.3).play()
      setCurrentAnim(first)
      return
    }
    // si se pidió una animación diferente, hacer cross-fade
    if (animation && currentAnim !== animation) {
      actions[currentAnim]?.fadeOut(0.3)
      actions[animation]?.reset().fadeIn(0.3).play()
      setCurrentAnim(animation)
    }
  }, [animation, actions, currentAnim])

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Sketchfab_Scene">
        <group name="Sketchfab_model" rotation={[-Math.PI / 2, 0, 0]} scale={0.107}>
          <group name="green_b_rigged_old_manfbx" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
            <group name="Object_2">
              <group name="RootNode">
                <group name="Object_4">
                  <primitive object={nodes._rootJoint} />
                  <group name="Object_6" />
                  <group name="green_b" />
                  <skinnedMesh
                    name="Object_7"
                    geometry={nodes.Object_7.geometry}
                    skeleton={nodes.Object_7.skeleton}
                  >
                    <meshStandardMaterial skinning color={color} />
                  </skinnedMesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/character/green_alien.glb')
