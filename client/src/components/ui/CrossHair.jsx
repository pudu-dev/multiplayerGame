// Crosshair.jsx
import React, { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CROSSHAIR_DISTANCE } from "../character/CharacterController";

/**
 * Crosshair 3D: se posiciona frente a la cámara a CROSSHAIR_DISTANCE (con profundidad/oclusiones).
 * size: diámetro del anillo en unidades del mundo
 * gap/thickness: para las líneas
 *
 * Ahora incluye Pointer Lock directamente: click en el canvas solicitará pointer lock y
 * se emitirá evento 'pointerLockChanged' con { detail: { locked } }.
 */
export default function Crosshair({
  size = 0.6,
  color = "white",
  gap = 0.18,
  thickness = 0.03,
}) {
  const group = useRef();
  const { camera, gl } = useThree();

  // geometrías/meshes reusables
  const inner = Math.max(0.02, size * 0.36);
  const outer = size / 2;

  // Pointer Lock: attach to canvas inside the Canvas (must be called on user gesture)
  useEffect(() => {
    const canvas = gl?.domElement;
    if (!canvas) return;

    const handleClick = () => {
      // requestPointerLock requires a user gesture
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) document.body.classList.add("pointer-locked");
      else document.body.classList.remove("pointer-locked");
      window.dispatchEvent(new CustomEvent("pointerLockChanged", { detail: { locked } }));
    };

    canvas.addEventListener("click", handleClick);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      canvas.removeEventListener("click", handleClick);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.body.classList.remove("pointer-locked");
    };
  }, [gl]);

  useFrame(() => {
    if (!group.current) return;
    // posicionar en frente de la cámara
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    group.current.position.copy(camera.position).add(dir.multiplyScalar(CROSSHAIR_DISTANCE));
    // orientar para que siempre mire a la cámara (billboard)
    group.current.quaternion.copy(camera.quaternion);
  });

  // Material básico; depthTest true => será ocultado por objetos entre cámara y crosshair
  const matProps = { color, transparent: true, depthTest: true, depthWrite: false };

  return (
    <group ref={group} renderOrder={0} visible>
      {/* Ring */}
      <mesh>
        <ringGeometry args={[inner, outer, 64]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* Central dot */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[Math.max(0.01, thickness * 0.6), 32]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* 4 líneas (top,bottom,left,right) */}
      {/* Top */}
      <mesh position={[0, outer + gap + thickness / 2, 0.001]}>
        <boxGeometry args={[thickness, gap + thickness, 0.01]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* Bottom */}
      <mesh position={[0, -(outer + gap + thickness / 2), 0.001]}>
        <boxGeometry args={[thickness, gap + thickness, 0.01]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* Left */}
      <mesh position={[-(outer + gap + thickness / 2), 0, 0.001]}>
        <boxGeometry args={[gap + thickness, thickness, 0.01]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* Right */}
      <mesh position={[(outer + gap + thickness / 2), 0, 0.001]}>
        <boxGeometry args={[gap + thickness, thickness, 0.01]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
    </group>
  );
}
