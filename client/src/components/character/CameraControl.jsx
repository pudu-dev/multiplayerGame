import { useThree, useFrame } from "@react-three/fiber";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

CameraControls.install({ THREE }); // usamos la librería camera-controls

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
  const currentLookAt = useRef(new THREE.Vector3());

  // Inicializar CameraControls
  useEffect(() => {
    controls.current = new CameraControls(camera, gl.domElement);
    controls.current.enabled = false;
    controls.current.smoothTime = 0.12;
    return () => controls.current?.dispose();
  }, [camera, gl]);

  // Bandera global para otros sistemas
  useEffect(() => {
    const isFollowing = !isFreeView;
    window.__cameraIsFollowing = isFollowing;
    window.dispatchEvent(new CustomEvent("cameraModeChanged", { detail: { isFollowing } }));
    if (controls.current) controls.current.enabled = isFreeView;
  }, [isFreeView]);

  // Toggle de vista libre con tecla C
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key.toLowerCase() === toggleKey) {
        setIsFreeView((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggleKey]);

  // Update loop principal
  useFrame((_, delta) => {
    if (!playerRef?.current) return;
    const player = playerRef.current;
    const target = player.position.clone().add(lookAtOffset);
    window.__r3f_camera = camera;

    if (!isFreeView) {
      // ----------------------------------------------
      // FOLLOW CAMERA 
      // ----------------------------------------------
      const rotatedOffset = offset.clone();
      const desiredPos = player.position.clone().add(rotatedOffset);
      // Lerp con suavizado independiente en Y
      const horizontalSmooth = smoothFollow;
      const verticalSmooth = Math.min(0.35, Math.max(0.12, smoothFollow * 3));
      const hAlpha = 1 - Math.pow(1 - horizontalSmooth, delta * 60);
      const vAlpha = 1 - Math.pow(1 - verticalSmooth, delta * 60);

      camera.position.x += (desiredPos.x - camera.position.x) * hAlpha;
      camera.position.z += (desiredPos.z - camera.position.z) * hAlpha;
      camera.position.y += (desiredPos.y - camera.position.y) * vAlpha;

      // Suavizado del lookAt
      currentLookAt.current.lerp(target, 1 - Math.pow(1 - 0.2, delta * 60));
      camera.lookAt(currentLookAt.current);
    } 
    else {
      // FREE CAMERA
      controls.current.setTarget(target.x, target.y, target.z, false);
      controls.current.update(delta);
    }
  });

  return null;
}
