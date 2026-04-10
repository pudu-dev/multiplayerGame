// Crosshair.jsx
import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CROSSHAIR_DISTANCE } from "../character/CharacterController";

export default function Crosshair({
  size = 0,
  color = "",
}) {
  const group = useRef();
  const { camera, gl } = useThree();

  // Pointer Lock
  useEffect(() => {
    const canvas = gl?.domElement;
    if (!canvas) return;

    const handleClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) document.body.classList.add("pointer-locked");
      else document.body.classList.remove("pointer-locked");

      window.dispatchEvent(
        new CustomEvent("pointerLockChanged", { detail: { locked } })
      );
    };

    canvas.addEventListener("click", handleClick);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      canvas.removeEventListener("click", handleClick);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.body.classList.remove("pointer-locked");
    };
  }, [gl]);

  // Actualizar posición siempre en la vista
  useFrame(() => {
    if (!group.current) return;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    group.current.position.copy(camera.position).add(
      dir.multiplyScalar(CROSSHAIR_DISTANCE)
    );

    group.current.quaternion.copy(camera.quaternion);
  });

  // Mostrar siempre encima: depthTest = false, depthWrite = false
  const matProps = {
    color,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  };

  const lineLength = size * 0.5;
  const gap = size * 0.25;

  // renderOrder alto en grupo y en cada mesh para asegurar prioridad de dibujo
  return (
    <group ref={group} renderOrder={999} visible>
      {/* Punto central */}
      <mesh renderOrder={999} position={[0, 0, 0.001]}>
        <circleGeometry args={[size * 0.05, 16]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* Línea arriba */}
      <mesh renderOrder={999} position={[0, gap + lineLength / 2, 0.001]}>
        <planeGeometry args={[0.03, lineLength]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* Línea abajo */}
      <mesh renderOrder={999} position={[0, -(gap + lineLength / 2), 0.001]}>
        <planeGeometry args={[0.03, lineLength]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* Línea izquierda */}
      <mesh renderOrder={999} position={[-(gap + lineLength / 2), 0, 0.001]}>
        <planeGeometry args={[lineLength, 0.03]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      {/* Línea derecha */}
      <mesh renderOrder={999} position={[(gap + lineLength / 2), 0, 0.001]}>
        <planeGeometry args={[lineLength, 0.03]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
    </group>
  );
}
