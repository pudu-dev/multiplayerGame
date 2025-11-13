import { useThree, useFrame } from "@react-three/fiber";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

CameraControls.install({ THREE }); // usamos la librería camera-controls

export function Camera({ 
  playerRef,
  targetRef, // nuevo prop: si se pasa, la cámara sigue este anchor en vez del player directo
  offset = new THREE.Vector3(0, 5, -8),
  lookAtOffset = new THREE.Vector3(0, 1.5, 0),
  toggleKey = "c",
  smoothFollow = 0.1,
  mouseSensitivity = 0.0025, // NUEVO: sensibilidad del mouse para follow
  minPitch = -0.6,
  maxPitch = 0.6,
}) {
  const { camera, gl } = useThree();
  const controls = useRef();
  const [isFreeView, setIsFreeView] = useState(false);
  const currentLookAt = useRef(new THREE.Vector3());

  // NEW: yaw/pitch control while following
  const yaw = useRef(0);   // radians, applied to offset around Y
  const pitch = useRef(0); // radians, applied to vertical rotation of offset

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

  // Listener global de mouse para ajustar yaw/pitch cuando NO estamos en free view
  useEffect(() => {
    const handleMove = (e) => {
      if (isFreeView) return;
      // usar movementX/movementY para obtener delta relativo (recomendable con pointer lock).
      yaw.current -= e.movementX * mouseSensitivity;
      pitch.current += e.movementY * mouseSensitivity;
      // limitar pitch
      pitch.current = Math.max(minPitch, Math.min(maxPitch, pitch.current));
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [isFreeView, mouseSensitivity, minPitch, maxPitch]);

  // Update loop principal
  useFrame((_, delta) => {
    const anchorObj = (targetRef && targetRef.current) || (playerRef && playerRef.current);
    if (!anchorObj) return;
    const target = anchorObj.position.clone().add(lookAtOffset);
    window.__r3f_camera = camera;

    // Exponer yaw/pitch para que otros sistemas (character) puedan leer el objetivo de la cámara
    window.__cameraYaw = yaw.current;
    window.__cameraPitch = pitch.current;

    if (!isFreeView) {
      // ----------------------------------------------
      // FOLLOW CAMERA (ahora con rotación por mouse)
      // ----------------------------------------------
      // Construir offset rotado por yaw + pitch
      const rotOffset = offset.clone();
      // aplicar pitch sobre eje local X del offset (eje lateral)
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch.current);
      rotOffset.applyQuaternion(pitchQuat);
      // aplicar yaw alrededor de Y
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current);
      rotOffset.applyQuaternion(yawQuat);

      const desiredPos = anchorObj.position.clone().add(rotOffset);

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
