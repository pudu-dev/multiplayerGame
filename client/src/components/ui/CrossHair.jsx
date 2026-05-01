import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CROSSHAIR_DISTANCE } from "../character/CharacterController";

export default function Crosshair({ size = 0, color = "" }) {
  const group = useRef();
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const cameraModeRef = useRef(0);

  // Pointer Lock + contextmenu (right click para isométrica)
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

    // recibir modo de cámara
    const onCameraMode = (e) => {
      cameraModeRef.current = e?.detail?.mode ?? cameraModeRef.current;
    };
    window.addEventListener("cameraModeChanged", onCameraMode);

    // handle right-click / contextmenu: solo en modo isométrico (2)
    const handleContext = (e) => {
      e.preventDefault();
      if (cameraModeRef.current !== 2) return;

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      raycaster.current.set(camera.position, dir);

      const intersects = scene ? raycaster.current.intersectObjects(scene.children, true) : [];
      let point = null;
      if (intersects && intersects.length > 0) {
        point = intersects[0].point;
      } else if (group.current) {
        point = group.current.getWorldPosition(new THREE.Vector3());
      }
      if (!point) return;

      window.dispatchEvent(new CustomEvent("isoClick", { detail: { position: [point.x, point.y, point.z] } }));
    };

    canvas.addEventListener("click", handleClick);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    canvas.addEventListener("contextmenu", handleContext);

    return () => {
      canvas.removeEventListener("click", handleClick);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      canvas.removeEventListener("contextmenu", handleContext);
      window.removeEventListener("cameraModeChanged", onCameraMode);
      document.body.classList.remove("pointer-locked");
    };
  }, [gl, camera, scene]);

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

  const matProps = {
    color,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  };

  const lineLength = size * 0.5;
  const gap = size * 0.25;

  return (
    <group ref={group} renderOrder={999} visible>
      <mesh renderOrder={999} position={[0, 0, 0.001]}>
        <circleGeometry args={[size * 0.05, 16]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      <mesh renderOrder={999} position={[0, gap + lineLength / 2, 0.001]}>
        <planeGeometry args={[0.03, lineLength]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      <mesh renderOrder={999} position={[0, -(gap + lineLength / 2), 0.001]}>
        <planeGeometry args={[0.03, lineLength]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      <mesh renderOrder={999} position={[-(gap + lineLength / 2), 0, 0.001]}>
        <planeGeometry args={[lineLength, 0.03]} />
        <meshBasicMaterial {...matProps} />
      </mesh>

      <mesh renderOrder={999} position={[(gap + lineLength / 2), 0, 0.001]}>
        <planeGeometry args={[lineLength, 0.03]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
    </group>
  );
}