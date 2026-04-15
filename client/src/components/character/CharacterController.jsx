/* KINEMATIC MOVEMENT */
/* nota: no estamos usando rigidbody para mover nuestros personajes, el cliente usa prediccion/reconciliacion kinematica
          para el movimiento del personaje con la logica en el servidor */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Socket } from "../conection/SocketConnection";
import { KeyboardInput } from "./inputs";


// ------------------------- Constantes compartidas (idénticas al servidor) --------------------------

const WALK_SPEED = 4;
const RUN_SPEED = 16;
const JUMP_VELOCITY = 5;

// exportamos la constante para que otros módulos (RemotePlayers) la reutilicen
export const GRAVITY = -10;

// --- settings para reconciliación suave ---
const SERVER_TICK = 16 / 1000; // debe coincidir con server TICK_MS
const SMOOTH_FACTOR = 0.16;    // ajustar 0.08..0.35 según gusto
const SNAP_THRESHOLD = 0.6;    // distancia para snap inmediato

// --- CROSSHAIR distance desde la cámara (ajustable)
export const CROSSHAIR_DISTANCE = 20;
const MOUSE_ROTATION_SMOOTH = 0.18; // suavizado al rotar hacia el crosshair

//------- HELPER para obtener la altura del terreno debajo del jugador (raycasting con linea visual) ----------------------
/*  const raycaster = useRef(new THREE.Raycaster()); */
function sampleGroundY(map, x, z) {
const terrain = map?.terrain;
const baseHeight = terrain?.baseHeight ?? 0;

if (!map?.size || !terrain?.width || !terrain?.height || !terrain?.heights?.length) {
return baseHeight;
}

const terrainSize = terrain.terrainSize ?? 2;
const terrainHeight = terrain.terrainHeight ?? -40;
const terrainHeightScale = terrain.terrainHeightScale ?? 2;
const terrainPosition = terrain.position ?? [0, 0, 0];
const step = Math.max(1, terrain.step ?? 1); // STEP

const worldW = map.size[0] * terrainSize;
const worldH = map.size[1] * terrainSize;
if (worldW <= 0 || worldH <= 0) return baseHeight;

const localX = x - terrainPosition[0];
const localZ = z - terrainPosition[2];

const u = localX / worldW + 0.5;
const v = localZ / worldH + 0.5;
if (u < 0 || u > 1 || v < 0 || v > 1) return baseHeight;

const segW = Math.floor((terrain.width - 1) / step);
const segH = Math.floor((terrain.height - 1) / step);
if (segW <= 0 || segH <= 0) return baseHeight;

const fx = u * segW;
const fy = v * segH;

const sx0 = Math.floor(fx);
const sy0 = Math.floor(fy);
const sx1 = Math.min(sx0 + 1, segW);
const sy1 = Math.min(sy0 + 1, segH);

const tx = fx - sx0;
const ty = fy - sy0;

const px0 = Math.min(sx0 * step, terrain.width - 1);
const py0 = Math.min(sy0 * step, terrain.height - 1);
const px1 = Math.min(sx1 * step, terrain.width - 1);
const py1 = Math.min(sy1 * step, terrain.height - 1);

const heights = terrain.heights;
const idx = (ix, iy) => iy * terrain.width + ix;

const h00 = Number(heights[idx(px0, py0)] ?? 0);
const h10 = Number(heights[idx(px1, py0)] ?? 0);
const h01 = Number(heights[idx(px0, py1)] ?? 0);
const h11 = Number(heights[idx(px1, py1)] ?? 0);

const h0 = h00 * (1 - tx) + h10 * tx;
const h1 = h01 * (1 - tx) + h11 * tx;
const h = h0 * (1 - ty) + h1 * ty;

const terrainY = terrainPosition[1] + terrainHeight + h * terrainHeightScale;
return Math.max(baseHeight, terrainY);
}


// ------------------------- Hook principal para el control del jugador --------------------------

export function usePlayerInput(playerRef, camera, map) {

  const input = KeyboardInput();

  // reconciliación y predicción del cliente (server authority + client prediction)
  const seqRef = useRef(0);
  const pendingInputs = useRef([]);

  // refs para corrección suave desde el servidor (no cambia estructura principal)
  const serverTargetPos = useRef(new THREE.Vector3());
  const serverTargetRotY = useRef(0);
  const needCorrection = useRef(false);

  // buffer de snapshots del servidor (para interpolación)
  const snapshotBuffer = useRef(new Map());
  const MAX_BUFFER_MS = 1000;

  // NUEVO: recordar la última orientación hacia la que miró el jugador
  const lastFacingYaw = useRef(null); // null = aún no inicializado
  const prevCamYaw = useRef(null);

  // estado físico LOCAL
  const velocity = useRef({ y: 0 });
  const isGrounded = useRef(true);


  // ------------------------- Manejo de entradas del servidor (AUTHORITY STATE SERVER) --------------------------
  useEffect(() => {
    const handleServerChars = (chars) => {
      if (!playerRef.current) return;
      const now = performance.now();

      // almacenamos snapshots en el buffer
      for (const c of chars) {
        const buf = snapshotBuffer.current.get(c.id) || [];
        buf.push({
          t: now,
          position: [...c.position],
          rotation: c.rotation,
          velocityY: c.velocityY ?? 0,
          isGrounded: !!c.isGrounded,
          lastProcessedInput: c.lastProcessedInput ?? -1,
        });
        while (buf.length > 0 && now - buf[0].t > MAX_BUFFER_MS) buf.shift();
        snapshotBuffer.current.set(c.id, buf);
      }

      // buscamos al jugador local
      const me = chars.find(c => c.id === Socket.id);
      if (!me) return;

      // Construimos un target corregido: posición del servidor + re-aplicar pendingInputs usando SERVER_TICK
      const serverPos = new THREE.Vector3(me.position[0], me.position[1], me.position[2]);

      // sincronizar estado vertical base para la reconstrucción del target
      let simVelY = me.velocityY ?? velocity.current.y;
      let simGrounded = !!me.isGrounded;

      // determinar inputs no ACKed
      const ack = me.lastProcessedInput ?? -1;
      const remaining = pendingInputs.current.filter(i => i.seq > ack);

      // re-aplicar pending inputs con paso del servidor para obtener posición objetivo
      const corrected = serverPos.clone();
      for (const inp of remaining) {
        corrected.x += (inp.moveX || 0) * SERVER_TICK;
        corrected.z += (inp.moveZ || 0) * SERVER_TICK;

        // reproducir salto/gravedad para Y en el target
        if (inp.jump && simGrounded) {
          simVelY = JUMP_VELOCITY;
          simGrounded = false;
        }

        simVelY += GRAVITY * SERVER_TICK;
        corrected.y += simVelY * SERVER_TICK;

        // limite de suelo terrain y base para el target corregido (evitar que el target quede debajo del suelo)
        const correctedGroundY = sampleGroundY(map, corrected.x, corrected.z);
        if (corrected.y <= correctedGroundY) {
          corrected.y = correctedGroundY;
          simVelY = 0;
          simGrounded = true;
        } else {
          simGrounded = false;
        }
      }

      // guardar target y marcar corrección; no tocar playerRef.position aquí
      serverTargetPos.current.copy(corrected);
      serverTargetRotY.current = me.rotation;
      needCorrection.current = true;

      // sincronizar estado vertical base y actualizar pendingInputs (sin mover la entidad)
      velocity.current.y = me.velocityY ?? velocity.current.y;
      isGrounded.current = !!me.isGrounded;
      pendingInputs.current = remaining;
    };

    Socket.on("characters", handleServerChars);
    return () => Socket.off("characters", handleServerChars);
  }, [playerRef, map]);


  // ------------------------- Movimiento LOCAL (predicción CLIENT) --------------------------
  const updateLocalPosition = (delta) => {
    if (!playerRef.current) return;

    // posición y rotación actuales
    const pos = playerRef.current.position;
    const rot = playerRef.current.rotation;

    // referencia de camara (para movimiento relativo)
    const cam = camera || window.__r3f_camera;
    if (!cam) return;

    // calcular dirección de movimiento relativa a la cámara
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize(); // usar up x forward para obtener el vector RIGHT correcto(RIGHT = forward x up)

    const moveDir = new THREE.Vector3();
    if (input.current.forward) moveDir.add(forward);
    if (input.current.backward) moveDir.sub(forward);
    if (input.current.left) moveDir.sub(right);
    if (input.current.right) moveDir.add(right);

    // movimiento horizontal local inmediato (predicción)
    let moveX = 0;
    let moveZ = 0;
    let movementYaw = null; // yaw derivado del movimiento del teclado (null si no hay movimiento)

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const speed = input.current.run ? RUN_SPEED : WALK_SPEED;

      // aplicar movimiento local
      pos.addScaledVector(moveDir, speed * delta);

      // calcular vector de velocidad en world-space para enviar al servidor / reutilizar en reconciliación
      moveX = moveDir.x * speed;
      moveZ = moveDir.z * speed;
      
      // calcular yaw de movimiento y mantenerlo (compatibilidad con código previo)
      movementYaw = Math.atan2(moveDir.x, moveDir.z);
      input.current.rotation = movementYaw;
    } else {
      // sin movimiento, mantener velocidad 0 en XZ
      moveX = 0;
      moveZ = 0;
    }
    

    // ------------------------- Salto (idéntica lógica que el servidor) -------------------------
    if (input.current.jump && isGrounded.current) {
      velocity.current.y = JUMP_VELOCITY;
      isGrounded.current = false;
    }

    // aplicar gravedad
    velocity.current.y += GRAVITY * delta;
    pos.y += velocity.current.y * delta;

    // límite de suelo

    //limite de suelo BASE
/*     if (pos.y <= 0) {
      pos.y = 0;
      velocity.current.y = 0;
      isGrounded.current = true;
    } */

    // limite de suelo terrain
    const groundY = sampleGroundY(map, pos.x, pos.z);
    if (pos.y <= groundY) {
      pos.y = groundY;
      velocity.current.y = 0;
      isGrounded.current = true;
    } else {
      isGrounded.current = false;
    }


    // --------- Corrección suave aplicada por frame: LERP hacia serverTargetPos si es necesario ----
    if (needCorrection.current) {
      const target = serverTargetPos.current;
      const err = target.clone().sub(pos);
      const errLen = err.length();

      if (errLen > SNAP_THRESHOLD) {
        // discrepancia grande -> snap inmediato
        pos.copy(target);
        rot.y = serverTargetRotY.current;
        needCorrection.current = false;
      } else {
        // lerp framerate-independiente
        const alpha = 1 - Math.pow(1 - SMOOTH_FACTOR, delta * 60);
        pos.lerp(target, alpha);
        // suavizar rotación hacia la del servidor
        rot.y += ((serverTargetRotY.current - rot.y + Math.PI) % (2 * Math.PI) - Math.PI) * alpha;
        if (pos.distanceTo(target) < 0.01) needCorrection.current = false;
      }
    }

    // ------ Orientación hacia el crosshair (punto en la dirección de la cámara) ------
    // calcular punto objetivo en la dirección de la cámara a distancia configurable
    const camDir = new THREE.Vector3();
    cam.getWorldDirection(camDir);
    const lookPoint = cam.position.clone().add(camDir.multiplyScalar(CROSSHAIR_DISTANCE));

    // calcular yaw objetivo (atan2 usando (dx, dz))
    const dx = lookPoint.x - pos.x;
    const dz = lookPoint.z - pos.z;

    // determinar yaw objetivo pero recordar la última orientación cuando no hay entrada activa
    let targetYaw;
    // obtener yaw de la cámara si está expuesto por CameraControl
    const camYaw = (typeof window.__cameraYaw === "number") ? window.__cameraYaw : null;

    // inicializar lastFacingYaw la primera vez
    if (lastFacingYaw.current === null) lastFacingYaw.current = rot.y;

    if (movementYaw !== null) {
      // movimiento por teclado prevalece: actualizar memoria y usarla
      lastFacingYaw.current = movementYaw;
      targetYaw = movementYaw;
    } else {
      // sin movimiento: calcular yaw hacia el punto del crosshair
      const lookYaw = Math.atan2(dx, dz);

      // detectar si el jugador está 'apuntando' moviendo la cámara (por cambio de camYaw)
      const camMoved = (camYaw !== null && prevCamYaw.current !== null) && Math.abs(camYaw - prevCamYaw.current) > 0.0009;
      if (camMoved) {
        // si la cámara se movió, actualizamos la memoria hacia el nuevo lookYaw
        lastFacingYaw.current = lookYaw;
      } else {
        // si prevCamYaw aún no estaba inicializado pero sí hay camYaw, consideramos que el jugador empezó a mirar y actualizamos
        if (camYaw !== null && prevCamYaw.current === null) {
          lastFacingYaw.current = lookYaw;
        }
        // en caso contrario no tocamos lastFacingYaw (recordará la última)
      }
      targetYaw = lastFacingYaw.current;
    }

    // guardar camYaw para detectar cambios en el siguiente frame
    prevCamYaw.current = camYaw;

    // suavizar rotación hacia targetYaw (usar el método de diferencia angular más corta)
    const diff = ((targetYaw - rot.y + Math.PI) % (2 * Math.PI)) - Math.PI;
    const rAlpha = 1 - Math.pow(1 - MOUSE_ROTATION_SMOOTH, delta * 60);
    rot.y += diff * rAlpha;


    // ------------------------- Enviar al servidor -------------------------
    const packet = {
      seq: seqRef.current++,
      forward: input.current.forward,
      backward: input.current.backward,
      left: input.current.left,
      right: input.current.right,
      run: input.current.run,
      jump: input.current.jump,
      rotation: rot.y, // enviar la rotación actual del jugador
      dt: delta,
      // ahora enviamos la velocidad en world-space (unidades/segundo)
      moveX,
      moveZ,
    };
    pendingInputs.current.push(packet);
    Socket.emit("move", packet);
  };
  

  return { updateLocalPosition, input, snapshotBuffer: snapshotBuffer.current };
}
