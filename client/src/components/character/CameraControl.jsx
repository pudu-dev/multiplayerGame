import { useThree, useFrame } from "@react-three/fiber";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

CameraControls.install({ THREE }); // usamos la libreria camera-controls

// ------------------------- Componente de cámara con modos follow y free --------------------------
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

  // NUEVO: ref para suavizar el lookAt (evita giros bruscos)
  const currentLookAt = useRef(new THREE.Vector3());

  //-----Inicializar CameraControls----
  useEffect(() => {
    controls.current = new CameraControls(camera, gl.domElement);
    controls.current.enabled = false; // inicia deshabilitado (modo follow)
    controls.current.smoothTime = 0.12;
    return () => controls.current?.dispose();
  }, [camera, gl]);

  // Inicializar bandera global y notificar (para Ground)
  useEffect(() => {
    const initialFollowing = !isFreeView;
    window.__cameraIsFollowing = initialFollowing;
    window.dispatchEvent(
      new CustomEvent("cameraModeChanged", {
        detail: { isFollowing: initialFollowing },
      })
    );
  }, []); // solo al montar

  // Mantener la bandera global y despachar evento cuando cambie el modo
  useEffect(() => {
    const isFollowing = !isFreeView;
    window.__cameraIsFollowing = isFollowing;
    window.dispatchEvent(
      new CustomEvent("cameraModeChanged", { detail: { isFollowing } })
    );
    // asegurar que CameraControls se habilite/deshabilite inmediatamente
    if (controls.current) controls.current.enabled = isFreeView;
  }, [isFreeView]);

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
      // FOLLOW CAMERA - suavizado separado para XZ y Y
      const desiredPos = player.position.clone().add(offset);

      // factores de lerp basados en smoothFollow, con Y más rápido para seguir saltos
      const horizontalSmooth = smoothFollow; // conserva comportamiento anterior en X/Z
      const verticalSmooth = Math.min(0.35, Math.max(0.12, smoothFollow * 3)); // Y sigue más rápido (ajusta si hace falta)

      // convertir smooth a alpha por frame (misma fórmula que antes)
      const hAlpha = 1 - Math.pow(1 - horizontalSmooth, delta * 60);
      const vAlpha = 1 - Math.pow(1 - verticalSmooth, delta * 60);

      // aplicar lerp separado
      camera.position.x += (desiredPos.x - camera.position.x) * hAlpha;
      camera.position.z += (desiredPos.z - camera.position.z) * hAlpha;
      camera.position.y += (desiredPos.y - camera.position.y) * vAlpha;

      // suavizar lookAt para evitar giros bruscos en Y
      currentLookAt.current.lerp(target, 1 - Math.pow(1 - 0.2, delta * 60)); // lookAt smoothing fijo, ajustar si necesario
      camera.lookAt(currentLookAt.current);
    } else {
      // FREE CAMERA
      controls.current.setTarget(target.x, target.y, target.z, false);
      controls.current.update(delta);
    }
  });

  return null;
}
