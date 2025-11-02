import { useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export function ThirdPersonCamera({
  playerRef,
  targetRef,
  follow = true,
  offset = [0, 10, 20],
  lookAtOffset = [0, 1.2, 0],
  positionLerp = 0.12,
  rotationLerp = 0.12,
  enableZoom = false,
  zoomSpeed = 0.5,
  globalYaw = Math.PI, // mirar hacia -Z por defecto
  pitch = Math.PI / 6,
  toggleKey = "c",
}) {
  const actualTargetRef = targetRef || playerRef;
  const camera = useThree((s) => s.camera);
  const orbitRef = useRef(null);

  const desiredPosition = useRef(new THREE.Vector3());
  const desiredLookAt = useRef(new THREE.Vector3());
  const tmpVector = useRef(new THREE.Vector3());
  const fixedY = useRef(null);

  const [isFollowing, setIsFollowing] = useState(follow);
  useEffect(() => setIsFollowing(follow), [follow]);

  // publicar el estado de la cámara y lanzar evento SOLO desde useEffect (post-render)
  useEffect(() => {
    window.__cameraIsFollowing = isFollowing;
    window.dispatchEvent(new CustomEvent("cameraModeChanged", { detail: { isFollowing } }));
  }, [isFollowing]);

  const distanceRef = useRef(Math.abs(offset[2] || -6));

  const cameraQuat = useRef(new THREE.Quaternion());
  useEffect(() => {
    cameraQuat.current.setFromEuler(new THREE.Euler(-pitch, globalYaw, 0, "YXZ"));
  }, [globalYaw, pitch]);

  useEffect(() => {
    distanceRef.current = Math.abs(offset[2] || -6);
  }, [offset]);

  // wheel zoom modifies distanceRef (used by follow offset); OrbitControls handles zoom in free mode by default
  useEffect(() => {
    if (!enableZoom) return;
    const onWheel = (e) => {
      const delta = Math.sign(e.deltaY) * zoomSpeed;
      // sin clamp: solo evitar valores demasiado pequeños
      distanceRef.current = Math.max(0.5, distanceRef.current + delta);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [enableZoom, zoomSpeed]);

  // toggle key: SOLO actualiza el estado local; el efecto anterior publicará el cambio
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key.toLowerCase() === String(toggleKey).toLowerCase()) {
        setIsFollowing((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleKey]);

  // inicializar la cámara en la posición "follow" al montar si follow === true
  useEffect(() => {
    const init = () => {
      if (!actualTargetRef?.current) return;
      actualTargetRef.current.getWorldPosition(tmpVector.current);

      const behindZ = -Math.abs(distanceRef.current);
      const rawOffset = new THREE.Vector3(offset[0], 0, behindZ).applyQuaternion(cameraQuat.current);
      const y = tmpVector.current.y + offset[1];

      desiredPosition.current.set(
        tmpVector.current.x + rawOffset.x,
        y,
        tmpVector.current.z + rawOffset.z
      );

      desiredLookAt.current.set(
        tmpVector.current.x + lookAtOffset[0],
        tmpVector.current.y + lookAtOffset[1],
        tmpVector.current.z + lookAtOffset[2]
      );

      if (follow) {
        camera.position.copy(desiredPosition.current);
        camera.lookAt(desiredLookAt.current);
        fixedY.current = desiredPosition.current.y;
      }

      if (orbitRef.current) {
        orbitRef.current.target.copy(desiredLookAt.current);
        orbitRef.current.update();
        orbitRef.current.enabled = !isFollowing;
      }
    };

    const t = setTimeout(init, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  // al cambiar a modo libre: centramos el pivot de OrbitControls sobre el personaje
  // NO sobrescribimos camera.position para conservar la última posición visible al hacer toggle
  useEffect(() => {
    if (!orbitRef.current) return;

    if (!isFollowing && actualTargetRef?.current) {
      actualTargetRef.current.getWorldPosition(tmpVector.current);

      const behindZ = -Math.abs(distanceRef.current);
      const rawOffset = new THREE.Vector3(offset[0], 0, behindZ).applyQuaternion(cameraQuat.current);
      const y = tmpVector.current.y + offset[1];

      desiredPosition.current.set(
        tmpVector.current.x + rawOffset.x,
        y,
        tmpVector.current.z + rawOffset.z
      );

      desiredLookAt.current.set(
        tmpVector.current.x + lookAtOffset[0],
        tmpVector.current.y + lookAtOffset[1],
        tmpVector.current.z + lookAtOffset[2]
      );

      // centrar pivot sin tocar la cámara (la cámara mantendrá su última transform)
      orbitRef.current.target.copy(desiredLookAt.current);
      orbitRef.current.update();
      orbitRef.current.enabled = true;
      return;
    }

    if (isFollowing) {
      orbitRef.current.enabled = false;
    }
  }, [isFollowing, actualTargetRef, cameraQuat, offset, lookAtOffset]);

  useFrame(() => {
    if (!actualTargetRef?.current) return;
  
    actualTargetRef.current.getWorldPosition(tmpVector.current);
  
    const behindZ = -Math.abs(distanceRef.current);
    const rawOffset = new THREE.Vector3(offset[0], 0, behindZ).applyQuaternion(cameraQuat.current);
  
    if (fixedY.current === null) fixedY.current = tmpVector.current.y + offset[1];
    fixedY.current = THREE.MathUtils.lerp(fixedY.current, tmpVector.current.y + offset[1], 0.05);
  
    desiredPosition.current.set(
      tmpVector.current.x + rawOffset.x,
      fixedY.current,
      tmpVector.current.z + rawOffset.z
    );
  
    desiredLookAt.current.set(
      tmpVector.current.x + lookAtOffset[0],
      tmpVector.current.y + lookAtOffset[1],
      tmpVector.current.z + lookAtOffset[2]
    );
  
    // -------------------
    // MODO FOLLOW (tercera persona)
    // -------------------
    if (isFollowing) {
      if (orbitRef.current) orbitRef.current.enabled = false;
    
      // Interpolación de cámara hacia el personaje
      camera.position.lerp(desiredPosition.current, positionLerp);
    
      const m = new THREE.Matrix4().lookAt(camera.position, desiredLookAt.current, camera.up);
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
      camera.quaternion.slerp(targetQuat, rotationLerp);
    
      // Actualizar pivot de OrbitControls solo al cambiar de modo (no cada frame)
      if (orbitRef.current) {
        orbitRef.current.target.copy(desiredLookAt.current);
        orbitRef.current.update();
      }
      return;
    }
  
    // -------------------
    // MODO LIBRE
    // -------------------
    if (orbitRef.current) {
      // 🚫 No interpolar hacia el jugador
      // Solo mantener el pivot actual del usuario (OrbitControls lo gestiona)
      orbitRef.current.enabled = true;
    }
  });
  // sincronizar enabled por si OrbitControls se crea más tarde
  useEffect(() => {
    if (orbitRef.current) orbitRef.current.enabled = !isFollowing;
  }, [isFollowing]);

  return (
    <OrbitControls
      ref={orbitRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      enabled={!isFollowing}
    />
  );
}

export default ThirdPersonCamera;