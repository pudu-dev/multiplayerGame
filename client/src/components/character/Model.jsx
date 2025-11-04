import { useRef, useState, useMemo, useEffect } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

export function Model({
  hairColor = "green",
  topColor = "pink",
  bottomColor = "blue",
  shoeColor = "red",
  animation = "CharacterArmature|Idle",
  ...props
}) {
  const group = useRef()
  const { scene, animations } = useGLTF('/models/character/AnimatedWoman.glb')
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone)
  const { actions } = useAnimations(animations, group)

  const [currentAnim, setCurrentAnim] = useState(animation)

  // Actualizar animación con cross-fade 
  useEffect(() => {
    if (!actions) return
    if (currentAnim !== animation) {
      actions[currentAnim]?.fadeOut(0.3)
      actions[animation]?.reset().fadeIn(0.3).play()
      setCurrentAnim(animation)
    }
  }, [animation, actions, currentAnim]) 

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Root_Scene">
        <group name="RootNode">
          <group name="CharacterArmature" rotation={[-Math.PI / 2, 0, 0]} scale={100}>
            <primitive object={nodes.Root} />
          </group>
          <group name="Casual_Body" rotation={[-Math.PI / 2, 0, 0]} scale={100}>
            <skinnedMesh geometry={nodes.Casual_Body_1.geometry} skeleton={nodes.Casual_Body_1.skeleton} >
              <meshStandardMaterial skinning color={topColor} />
            </skinnedMesh>
            <skinnedMesh geometry={nodes.Casual_Body_2.geometry} skeleton={nodes.Casual_Body_2.skeleton} material={materials.Skin} />
          </group>

          <group name="Casual_Feet" rotation={[-Math.PI / 2, 0, 0]} scale={100}>
            <skinnedMesh geometry={nodes.Casual_Feet_1.geometry} skeleton={nodes.Casual_Feet_1.skeleton} material={materials.Skin} />
            <skinnedMesh geometry={nodes.Casual_Feet_2.geometry} skeleton={nodes.Casual_Feet_2.skeleton} >
              <meshStandardMaterial skinning color={shoeColor} />
            </skinnedMesh>
          </group>

          <group name="Casual_Head" rotation={[-Math.PI / 2, 0, 0]} scale={100}>
            <skinnedMesh geometry={nodes.Casual_Head_1.geometry} skeleton={nodes.Casual_Head_1.skeleton} material={materials.Skin} />
            <skinnedMesh geometry={nodes.Casual_Head_2.geometry} skeleton={nodes.Casual_Head_2.skeleton} >
              <meshStandardMaterial skinning color={hairColor} />
            </skinnedMesh>
          </group>

          <skinnedMesh geometry={nodes.Casual_Legs.geometry} skeleton={nodes.Casual_Legs.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={100}>
            <meshStandardMaterial skinning color={bottomColor} />
          </skinnedMesh>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/character/AnimatedWoman.glb')