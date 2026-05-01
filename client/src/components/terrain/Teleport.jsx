import React, { useMemo, useRef } from "react";
import { useGLTF, Text } from "@react-three/drei";
import { SkeletonUtils } from 'three-stdlib'
import { RigidBody } from "@react-three/rapier";

/* ajustar coliciones pendiente */
/*------------------------------- funcion modelo 3d --------------------------- */
function TeleportModel({ 
    src = "/models/items/tp.glb", 
    scale = 1, 
    position = [0, 0, 0], 
    rotation = [0, 0, 0] }) {
    
    const { scene } = useGLTF(src);
    const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
    const ref = useRef();

    return (
        <>     
            <RigidBody ref={ref} type="fixed" colliders="trimesh">
                <group rotation={rotation} position={position} scale={scale}>
                    <primitive object={cloned} dispose={null} />
                </group>
            </RigidBody>
        </>
    );
}

/* ---------------------------- componente principal: teleport ------------------------------ */
export default function Teleport({ tp }) {

// posición y radio del área de activación del teleport (ring y cilindro)
  const p = tp.position ?? [0, 0, 0];
  const y = Number(p[1] ?? 0);
  const r = Math.max(0.8, Number(tp.radius ?? 2));

// campos del servidor: position_model / rotation_model / scale_model (fallback a position/rotation/scale)
  const positionModel = tp?.position_model ?? tp?.position ?? [0, 0, 0];
  const rotationModel = tp?.rotation_model ?? tp?.rotation ?? [0, 0, 0];
  const scaleModel = tp?.scale_model ?? tp?.scale ?? 1;

// posición local del modelo respecto al grupo base (tp.position)
  const localModelPos = [
    (positionModel[0] ?? 0) - (p[0] ?? 0),
    (positionModel[1] ?? 0) - (p[1] ?? 0),
    (positionModel[2] ?? 0) - (p[2] ?? 0),
  ];

  return (
    <group position={[p[0], y + 0.03, p[2]]}> 
        <>
            <mesh rotation-x={-Math.PI / 2}>
              <ringGeometry args={[r * 0.55, r, 48]} />
              <meshStandardMaterial color="#ffffffa9" transparent opacity={0.85} side={2} />
            </mesh>

            <mesh position={[0, 0.75, 0]}>
              <cylinderGeometry args={[r * 0.07, r * 0.07, 1.5, 16]} />
              <meshStandardMaterial color="#00b7ff" emissive="#91b7ff" emissiveIntensity={1} transparent opacity={0.35} />
            </mesh>

            <Text position={[0, 3, 0]} fontSize={1} color="#ffffff" anchorX="center" anchorY="bottom">
              {tp.id}
            </Text>

            <TeleportModel src={tp.model} scale={scaleModel} position={localModelPos} rotation={rotationModel}/>
        </>
    </group>
  );
}