import { useThree, useFrame } from "@react-three/fiber";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

CameraControls.install({ THREE });

export function Camera({
  playerRef,
  offset = new THREE.Vector3(0, 5, -8),
  lookAtOffset = new THREE.Vector3(0, 1.5, 0),
  toggleKey = "c",
  smoothFollow = 0.1,
}) {
  const { camera, gl } = useThree();
  const controls = useRef();
  const [isFreeView, setIsFreeView] = useState(false);

  // Inicializar CameraControls
  useEffect(() => {
    controls.current = new CameraControls(camera, gl.domElement);
    controls.current.enabled = false; // inicia deshabilitado (modo follow)
    controls.current.smoothTime = 0.12;
    return () => controls.current?.dispose();
  }, [camera, gl]);

  // Toggle con tecla C
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key.toLowerCase() === toggleKey) {
        setIsFreeView((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggleKey]);

  // Update loop
  useFrame((_, delta) => {
    if (!playerRef?.current) return;
    const player = playerRef.current;
    const target = player.position.clone().add(lookAtOffset);

    if (!isFreeView) {
      // FOLLOW CAMERA //funciona
      controls.current.enabled = false;// deshabilitar controles de cámara
      const desiredPos = player.position.clone().add(offset);// posición deseada de la cámara, sigue al personaje
      camera.position.lerp(desiredPos, 1 - Math.pow(1 - smoothFollow, delta * 60)); // interpolar posición suavemente
      camera.lookAt(target); // mirar al jugador
    } else {
      // FREE CAMERA
      controls.current.enabled = true;
      controls.current.setTarget(target.x, target.y, target.z, false); 
      controls.current.update(delta);
    }
  });

  return null;
}
