import { useThree, useFrame } from "@react-three/fiber";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

// 
CameraControls.install({ THREE });

//-------------------------
// 
//-------------------------
export function Camera({
  playerRef,
  targetRef,
  input,
  offset = new THREE.Vector3(0, 5, -8),
  cameraHeight = 1.6, // altura de la cámara desde el suelo (para ajustar el target de mirada)
  smoothFollow = 0.25,
  mouseSensitivity = 0.0025,
  minPitch = -0.6,
  maxPitch = 0.6,
}) {
  const { camera, gl } = useThree();
  const controls = useRef();

  const [cameraMode, setCameraMode] = useState(0);
  const currentLookAt = useRef(new THREE.Vector3());

  const yaw = useRef(0);
  const pitch = useRef(0);
  const currentCamera = useRef(false);

    // offset estable (no crear new THREE.Vector3() en la firma)
  const offsetRef = useRef(offset ?? new THREE.Vector3(0, cameraHeight, -8));

  const isoZoom = useRef(window.__playerZoom || 12); // isometric distance
  const tpZoom = useRef(1.0); // escala para tercera persona (1 = default)

  const baseFov = useRef(camera?.fov ?? 60);
  
  // Guardar/Restaurar estado por modo para mantener posición/orientación/zoom
  const cameraStates = useRef({});
  const prevModeRef = useRef(cameraMode);
  const justSwitchedFrames = useRef(0); // evita saltos agresivos justo después del switch


  const MIN_DISTANCE = 0.4;
  const MAX_DISTANCE = 3.0;
  const MIN_ISO_ZOOM = 3;
  const MAX_ISO_ZOOM = 60;
  const MIN_FOV = 20;
  const MAX_FOV = 90;
  const ZOOM_SENS_TP = 0.12; // third-person sensitivity
  const ZOOM_SENS_ISO = 0.12; // isometric sensitivity
  const ZOOM_SENS_FP = 0.10; // first-person FOV sensitivity (per wheel step)

  //-----------------------
  // Ajuste near plane
  //-----------------------
  useEffect(() => {
    if (!camera) return;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
  }, [camera]);

  //--------------------- INICIALIZACIÓN DE CONTROLES -----------------------
  //------------------------
  // Configuracion inicial
  //------------------------
  useEffect(() => {
    controls.current = new CameraControls(camera, gl.domElement);
    controls.current.enabled = false;
    controls.current.smoothTime = 0.12;

    return () => controls.current?.dispose();
  }, [camera, gl]);

  // ---------------------
  // Estado global
  // ---------------------
  useEffect(() => {
    // si la camara sigue al personaje y no es la camara free
    const isFollowing = cameraMode !== 3;
    // exponer estado global para que otros módulos (HUD) puedan reaccionar a cambios de cámara
    window.__cameraIsFollowing = isFollowing;

    window.dispatchEvent(
      new CustomEvent("cameraModeChanged", {
        detail: { mode: cameraMode },
      })
    );
    
    // Habilitar controles solo en modo free
    if (controls.current) {
      controls.current.enabled = cameraMode === 3;
    }
  }, [cameraMode]);

  // Inicializar base FOV cuando la cámara esté lista
  useEffect(() => {
    if (camera && typeof camera.fov === "number") baseFov.current = camera.fov;
  }, [camera]);


   // Cuando cambia el modo: guardar estado del modo anterior y restaurar el del nuevo (si existe)
  useEffect(() => {
    if (!camera) return;
    const prev = prevModeRef.current;
    if (prev === cameraMode) return;

    // Guardar estado del modo anterior
    cameraStates.current[prev] = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      yaw: yaw.current,
      pitch: pitch.current,
      tpZoom: tpZoom.current,
      isoZoom: isoZoom.current,
      fov: camera.fov,
    };

    // Restaurar estado del nuevo modo si existe
    const saved = cameraStates.current[cameraMode];
    if (saved) {
      // Restaurar transform y parámetros relevantes
      camera.position.copy(saved.position);
      camera.quaternion.copy(saved.quaternion);
      yaw.current = saved.yaw ?? yaw.current;
      pitch.current = saved.pitch ?? pitch.current;
      tpZoom.current = saved.tpZoom ?? tpZoom.current;
      isoZoom.current = saved.isoZoom ?? isoZoom.current;
      if (typeof saved.fov === "number") {
        camera.fov = saved.fov;
        camera.updateProjectionMatrix();
      }
      // Asegurar altura de hombros para modos ligados al jugador/target
      if ([0, 1, 2].includes(cameraMode)) {
        const anchor = (targetRef && targetRef.current) || (playerRef && playerRef.current);
        if (anchor) camera.position.y = anchor.position.y + cameraHeight;
      }
      justSwitchedFrames.current = 6;
    } else {
      // No hay estado guardado: mantener la posición actual pero ajustar altura para modos ligados
      if ([0, 1, 2].includes(cameraMode)) {
        const anchor = (targetRef && targetRef.current) || (playerRef && playerRef.current);
        if (anchor) camera.position.y = anchor.position.y + cameraHeight;
      }
      justSwitchedFrames.current = 6;
    }

    prevModeRef.current = cameraMode;
  }, [cameraMode, camera, playerRef, targetRef, cameraHeight]);

  // -------------------------
  // Mouse control (yaw/pitch)
  // -------------------------
  useEffect(() => {
    const handleMove = (e) => {
      // no aplica en modo libre de cámara
      if (cameraMode === 3) return;

      // en modo isométrico (2) rotar solo con MMB
      if (cameraMode === 2) {
        const wheelMiddle = input?.current?.mouse?.wheelMiddle;
        if (!wheelMiddle) return;
      }
    
      // invertir control Y en primera persona para que sea más natural
      yaw.current -= e.movementX * mouseSensitivity;
      const ySign = cameraMode === 1 ? -1 : 1;
      pitch.current += ySign * e.movementY * mouseSensitivity;
      // limitar pitch para evitar que la cámara se voltee
      pitch.current = Math.max(minPitch, Math.min(maxPitch, pitch.current));
    };
  
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [cameraMode, mouseSensitivity, minPitch, maxPitch, input]);

  //-----------------------
  // LOOP PRINCIPAL
  //-----------------------
  useFrame((_, delta) => {
    // detectar cambio de cámara por input (tecla C)
    if (input?.current) {
      const pressed = !!input.current.camera;
      if (pressed && !currentCamera.current) {
        setCameraMode((m) => (m + 1) % 4);
      }
      currentCamera.current = pressed;
    }

    // ZOOM CON RUEDA , Leer wheelDelta acumulado por el hook MouseInput (por frame)
    const wheelDelta = input?.current?.mouse?.wheelDelta ?? 0;
    if (wheelDelta !== 0) {
      const step = -wheelDelta; // step > 0 => scroll up (zoom in)

      if (cameraMode === 0) {
          // tercera persona: escalar offset
        let z = tpZoom.current * (1 - step * ZOOM_SENS_TP);
        z = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, z));
        tpZoom.current = z;
      } else if (cameraMode === 1) {
        // primera persona: cambiar FOV
        const newFov = Math.max(MIN_FOV,Math.min(MAX_FOV, camera.fov * (1 - step * ZOOM_SENS_FP)));
        camera.fov = newFov;
        camera.updateProjectionMatrix();
      } else if (cameraMode === 2) {
        // isométrica: ajustar distancia
        let z = isoZoom.current * (1 - step * ZOOM_SENS_ISO);
        z = Math.max(MIN_ISO_ZOOM, Math.min(MAX_ISO_ZOOM, z));
        isoZoom.current = z;
        window.__playerZoom = z;
      } else if (cameraMode === 3 && controls.current) {
        // free look: usar camera-controls
        if (step > 0) controls.current.dollyIn(Math.abs(step), true);
        else controls.current.dollyOut(Math.abs(step), true);
      }

      // resetear delta por frame
      if (input?.current?.mouse) input.current.mouse.wheelDelta = 0;
    }

    // determinar objeto ancla para la cámara (priorizar targetRef, luego playerRef)
    const anchorObj = (targetRef && targetRef.current) || (playerRef && playerRef.current);
    if (!anchorObj) return;

    // Target: calcular Punto de mirada ajustado a altura de hombros
    const target = anchorObj.position.clone().add(new THREE.Vector3(0, cameraHeight, 0));

    // Si acabamos de cambiar de modo, damos unos frames para estabilizar sin forzar snaps agresivos
    if (justSwitchedFrames.current > 0) {
      justSwitchedFrames.current -= 1;
      // suavizar lookAt aunque mantengamos posición por los frames de estabilización
      currentLookAt.current.lerp(target, 1 - Math.pow(1 - 0.2, delta * 60));
      camera.lookAt(currentLookAt.current);
      return;
    }



    // -------------------------------
    // 🟢 TERCERA PERSONA
    // -------------------------------
    if (cameraMode === 0) {

      // calcular offset rotado por yaw/pitch
      const rotOffset = offsetRef.current.clone().multiplyScalar(tpZoom.current);

      // aplicar rotación de pitch y luego yaw al offset
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        pitch.current
      );
      rotOffset.applyQuaternion(pitchQuat);

      // luego aplicar yaw para girar alrededor del personaje
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yaw.current
      );
      rotOffset.applyQuaternion(yawQuat);


      // calcular posición deseada sumando el offset rotado a la posición del ancla
      const desiredPos = anchorObj.position.clone().add(rotOffset);
      const hAlpha = 1 - Math.pow(1 - smoothFollow, delta * 60);

      // lerp suave hacia la posición deseada y mirar al personaje
      camera.position.lerp(desiredPos, hAlpha);
      currentLookAt.current.lerp(target, 1 - Math.pow(1 - 0.2, delta * 60));
      camera.lookAt(currentLookAt.current);
    }

    // -------------------------------
    // 🔵 PRIMERA PERSONA 
    // -------------------------------
    else if (cameraMode === 1) {
    
      // Posición EXACTA (sin lerp para evitar flotación)
      camera.position.copy(target);
    
      // Rotación FPS real
      const euler = new THREE.Euler( pitch.current, yaw.current, 0,"YXZ");
      camera.quaternion.setFromEuler(euler);
    
      // Dirección forward correcta
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      // ADELANTAR CÁMARA
      camera.position.add(forward.clone().multiplyScalar(0.3));
      // Punto de mirada
      camera.lookAt(camera.position.clone().add(forward));
    }

    // -------------------------------
    // ⚫ Tercera persona isométrica
    // -------------------------------
    else if (cameraMode === 2) {

      const zoom = isoZoom.current;
      const isoOffset = new THREE.Vector3(-zoom, zoom * 1.2, -zoom);
      const desiredPos = anchorObj.position.clone().add(isoOffset);

      const alpha = 1 - Math.pow(1 - smoothFollow, delta * 60);
      camera.position.lerp(desiredPos, alpha);
      currentLookAt.current.lerp(target, alpha);
      camera.lookAt(currentLookAt.current);
    }

    // -------------------------------
    // ⚫ FREE LOOK CAMERA
    // -------------------------------
    else if (cameraMode === 3) {
      controls.current.setTarget(target.x, target.y, target.z, false);
      controls.current.update(delta);
    }
  });

  return null;
}