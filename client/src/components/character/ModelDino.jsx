
import { useGraph } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { useEffect, useRef, useMemo } from 'react'

export function Model(props) {
  const group = useRef()
  const { scene, animations } = useGLTF('/models/character/pbr_velociraptor_animated.glb')
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone)
  const { actions } = useAnimations(animations, group)

  //----------------------------------------------------------------
  // debug: listar acciones disponibles
  useEffect(() => {
    if (actions) console.log('Available action keys:', Object.keys(actions))
  }, [actions])
  //----------------------------------------------------------------

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Sketchfab_Scene">
        <group name="Sketchfab_model" rotation={[-Math.PI / 2, 0, 0]}>
          <group name="Raptor_Animated_FBXfbx" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
            <group name="Object_2">
              <group name="RootNode">
                <group name="RaptorArmature" rotation={[-Math.PI / 2, 0, 0]} scale={24.964}>
                  <group name="Object_5">
                    <primitive object={nodes._rootJoint} />
                    <group name="Object_143" />
                    <skinnedMesh name="Object_144" geometry={nodes.Object_144.geometry} material={materials.Body_Mat} skeleton={nodes.Object_144.skeleton} morphTargetDictionary={nodes.Object_144.morphTargetDictionary} morphTargetInfluences={nodes.Object_144.morphTargetInfluences} />
                    <skinnedMesh name="Object_145" geometry={nodes.Object_145.geometry} material={materials.Other_Mat} skeleton={nodes.Object_145.skeleton} morphTargetDictionary={nodes.Object_145.morphTargetDictionary} morphTargetInfluences={nodes.Object_145.morphTargetInfluences} />
                  </group>
                </group>
                <group name="Retopo" />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/character/pbr_velociraptor_animated.glb')
