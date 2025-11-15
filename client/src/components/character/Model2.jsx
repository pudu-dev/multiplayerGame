/* npx gltfjsx public/models/character/green_alien.glb -o src/components/character/Model2.jsx -r public */

import { useRef, useState, useMemo, useEffect } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { Color } from 'three'

export function Model({
  color = "red",
  animation = "idle",
  ...props
}) {
  const group = useRef()
  const { scene, animations } = useGLTF('/models/character/green_alien.glb')
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes } = useGraph(clone)
  const { actions } = useAnimations(animations, group)
  // no inicializar con la prop para forzar reproducción al montar
  const [currentAnim, setCurrentAnim] = useState(null)
  // helper para resolver nombres parciales (ej: "idle" -> "CharacterArmature|Idle")
  const resolveActionKey = (desired, keys) => {
    if (!desired) return null
    if (keys.includes(desired)) return desired
    const low = desired.toLowerCase()
    const found = keys.find(k => k.toLowerCase().includes(low))
    if (found) return found
    return null
  }

  // reproducir / cross-fade cuando actions estén listos o cuando cambie la prop animation
  useEffect(() => {
    if (!actions) return
    const keys = Object.keys(actions)
    if (!keys.length) return

    const target = resolveActionKey(animation, keys) || keys[0]

    if (currentAnim && currentAnim !== target) {
      actions[currentAnim]?.fadeOut(0.3)
    }

    if (currentAnim !== target) {
      actions[target]?.reset().fadeIn(0.3).play()
      setCurrentAnim(target)
    }
  }, [animation, actions, currentAnim])


  //----------------------------------------------------------------
  // debug: listar acciones disponibles
  useEffect(() => {
    if (actions) console.log('Available action keys:', Object.keys(actions))
  }, [actions])
  //----------------------------------------------------------------

  // Clonar el material original para poder activar skinning y tintar sin perder texturas
  const skinnedMaterial = useMemo(() => {
    const src = nodes?.Object_7?.material
    if (!src) return null
    const m = src.clone()
    m.skinning = true
    // aplicar tint si se pasa color (mantiene map/normal/ao, etc.)
    try {
      m.color = new Color(color)
    } catch (e) {
      // color no válido -> ignorar
    }
    return m
  }, [nodes, color])

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
                    material={skinnedMaterial || nodes.Object_7.material}
                  />
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
