/* KINEMATIC MOVEMENT */
/* nota: no estamos usando rigidbody para mover nuestros personajes, el cliente usa prediccion/reconciliacion kinematica
          para el movimiento del personaje con la logica en el servidor */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Socket } from "../../conection/SocketConnection.js";
import { KeyboardInput, MouseInput } from "./inputs";

// ------------------------- Constantes compartidas (idénticas al servidor) --------------------------

const WALK_SPEED = 4;
const RUN_SPEED = 8;
const JUMP_VELOCITY = 5;

// exportamos la constante para que otros módulos (RemotePlayers) la reutilicen
export const GRAVITY = -10;

// --- settings para reconciliación suave ---
const SERVER_TICK = 1 / 60; // debe coincidir con server TICK_MS
const SMOOTH_FACTOR = 0.2; // ajustar 0.08..0.35 según gusto
const SNAP_THRESHOLD = 1.6; // distancia para snap inmediato
const MAX_FRAME_DELTA = 1 / 20;
const MAX_PENDING_INPUTS = 180;
const MAX_SENDS_PER_FRAME = 5;

// --- Envío de inputs: desacoplar del framerate (cliente)
const SEND_HZ = 60;
const SEND_INTERVAL = 1 / SEND_HZ;
const MIN_SEND_DT = SEND_INTERVAL;
const MAX_SEND_DT = SEND_INTERVAL;

// --- CROSSHAIR distance desde la cámara (ajustable)
export const CROSSHAIR_DISTANCE = 20;

// FIX: reemplaza MOUSE_ROTATION_SMOOTH por dos constantes separadas:
//   VISUAL_YAW_SMOOTH          → suaviza el mesh (rot.y), única escritura por frame
//   ROT_CORRECTION_THRESHOLD   → umbral (rad) para que el servidor corrija el yaw
// 0.10 = suave/lento · 0.18 = equilibrado · 0.28 = rápido/directo
const VISUAL_YAW_SMOOTH = 0.18;
const ROT_CORRECTION_THRESHOLD = 0.3;

// FIX: normalizar ángulo a [-π, π] — el operador % en JS puede devolver negativos
function normalizeAngle(a) {
  return ((a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
}

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
  const mouseInput = MouseInput();
  

  useEffect(() => {
    // enlaza la referencia del mouse al objeto `input` para que otros módulos lean `input.current.mouse`
    if (input && mouseInput) input.current.mouse = mouseInput.current;
  }, [input, mouseInput]);

  // reconciliación y predicción del cliente (server authority + client prediction)
  const seqRef = useRef(0);
  const pendingInputs = useRef([]);
  const sendAccumulator = useRef(0);

  // dt del servidor (actualizable desde welcome/game_state)
  const serverTickRef = useRef(SERVER_TICK);

  // refs para corrección suave desde el servidor (no cambia estructura principal)
  const serverTargetPos = useRef(new THREE.Vector3());
  const serverTargetRotY = useRef(0);
  const needCorrection = useRef(false);

  // buffer de snapshots del servidor (para interpolación)
  const snapshotBuffer = useRef(new Map());
  const MAX_BUFFER_MS = 1000;

  // recordar la última orientación hacia la que miró el jugador
  const lastFacingYaw = useRef(null); // null = aún no inicializado
  const prevCamYaw = useRef(null);

  // FIX: separar yaw lógico (autoritativo) del yaw visual (suavizado para el mesh).
  //      Antes había dos sistemas escribiendo rot.y en el mismo frame (reconciliación
  //      del servidor + orientación al crosshair), lo que causaba el parpadeo con A/D.
  //      Ahora logicalYaw acumula el valor "real" y visualYaw es el único que escribe rot.y.
  const logicalYaw = useRef(0);  // hacia dónde debe mirar el jugador
  const visualYaw  = useRef(0);  // valor interpolado suave asignado al mesh (rot.y)

  // estado físico LOCAL
  const velocity = useRef({ y: 0 });
  const isGrounded = useRef(true);

  const AIR_JUMP_MAX = 2;         // número de air-jumps permitidos (1 = doble salto)
  const AIR_JUMP_COOLDOWN = 1.0;  // segundos de cooldown entre air-jumps
  const airJumpsUsed = useRef(0);
  const airJumpCooldown = useRef(0.0);

  const TELEPORT_COOLDOWN_MS = 1200;
  const lastTeleportMsRef = useRef(0);
  const currentTeleportZoneRef = useRef(null);

  const tryTeleport = (position) => {
    const teleports = map?.teleports ?? [];
    let insideTeleportId = null;

    for (const tp of teleports) {
      const p = tp.position ?? [0, 0, 0];
      const r = Number(tp.radius ?? 2);

      const dx = position.x - p[0];
      const dz = position.z - p[2];
      const inside = (dx * dx + dz * dz) <= (r * r);

      if (inside) {
        insideTeleportId = tp.id;
        break;
      }
    }

    // Si no está en ninguna zona, resetea estado de entrada
    if (!insideTeleportId) {
      currentTeleportZoneRef.current = null;
      return;
    }

    const now = performance.now();
    const isEnteringZone = currentTeleportZoneRef.current !== insideTeleportId;
    const cooldownReady = now - lastTeleportMsRef.current >= TELEPORT_COOLDOWN_MS;

    if (isEnteringZone && cooldownReady) {
      const sent = Socket.emit("teleport", { teleportId: insideTeleportId });
      if (sent) {
        lastTeleportMsRef.current = now;
      }
    }

    currentTeleportZoneRef.current = insideTeleportId;
  };

  // Sincroniza dt de simulación con lo que anuncie el servidor
  useEffect(() => {
    const updateServerTiming = (value) => {
      const simDtMs = Number(value?.simDtMs);
      if (Number.isFinite(simDtMs) && simDtMs > 0 && simDtMs < 100) {
        serverTickRef.current = simDtMs / 1000;
      }
    };

    Socket.on("welcome", updateServerTiming);
    Socket.on("game_state", updateServerTiming);

    return () => {
      Socket.off("welcome", updateServerTiming);
      Socket.off("game_state", updateServerTiming);
    };
  }, []);

  // Reset defensivo al desconectar
  useEffect(() => {
    const onDisconnect = () => {
      pendingInputs.current = [];
      sendAccumulator.current = 0;
      seqRef.current = 0;
      needCorrection.current = false;
    };

    Socket.on("disconnect", onDisconnect);
    return () => Socket.off("disconnect", onDisconnect);
  }, []);

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
      const me = chars.find((c) => String(c.id) === String(Socket.id));
      if (!me) return;

      // Construimos un target corregido: posición del servidor + re-aplicar pendingInputs usando el dt que vino en cada paquete
      const serverPos = new THREE.Vector3(me.position[0], me.position[1], me.position[2]);

      // sincronizar estado vertical base para la reconstrucción del target
      let simVelY = me.velocityY ?? velocity.current.y;
      let simGrounded = !!me.isGrounded;

      // determinar inputs no ACKed
      const ack = me.lastProcessedInput ?? -1;

      if (pendingInputs.current.length > MAX_PENDING_INPUTS) {
        pendingInputs.current.splice(0, pendingInputs.current.length - MAX_PENDING_INPUTS);
      }

      const remaining = pendingInputs.current
        .filter((i) => i.seq > ack)
        .slice(-MAX_PENDING_INPUTS);

      // re-aplicar pending inputs con paso por paquete (usar inp.dt si existe)
      const corrected = serverPos.clone();
      for (const inp of remaining) {
        const inputDt = Number.isFinite(inp.dt) ? inp.dt : serverTickRef.current;
        const step = Math.min(Math.max(inputDt, MIN_SEND_DT), MAX_SEND_DT);

        corrected.x += (inp.moveX || 0) * step;
        corrected.z += (inp.moveZ || 0) * step;

        // reproducir salto/gravedad para Y en el target
        if (inp.jump && simGrounded) {
          simVelY = JUMP_VELOCITY;
          simGrounded = false;
        }

        simVelY += GRAVITY * step;
        corrected.y += simVelY * step;

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

    // protegerse contra picos de frame
    const safeDelta = Math.min(Math.max(delta, 0), MAX_FRAME_DELTA);

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

    // Preparar movimiento horizontal (no aplicar aún)
    const hasMove = moveDir.lengthSq() > 0;
    let moveX = 0;
    let moveZ = 0;
    let movementYaw = null;

    if (hasMove) {
      moveDir.normalize();
      const speed = input.current.run ? RUN_SPEED : WALK_SPEED;
      moveX = moveDir.x * speed;
      moveZ = moveDir.z * speed;
      movementYaw = Math.atan2(moveDir.x, moveDir.z);
      input.current.rotation = movementYaw;
    }

    // Salto (idéntica lógica que el servidor)
    const jumpPressed = !!input.current.jump;
    input.current.jump = false; // consumir el evento localmente
    airJumpCooldown.current = Math.max(0, airJumpCooldown.current - safeDelta);

    if (jumpPressed) {
      if (isGrounded.current) {
        // salto normal
        velocity.current.y = JUMP_VELOCITY;
        isGrounded.current = false;
        airJumpsUsed.current = 0;
        airJumpCooldown.current = 0;
      } else if (airJumpsUsed.current < AIR_JUMP_MAX && airJumpCooldown.current <= 0) {
        // air-jump (doble salto)
        velocity.current.y = JUMP_VELOCITY;
        airJumpsUsed.current += 1;
        airJumpCooldown.current = AIR_JUMP_COOLDOWN;
      }
    }

    // --- Integración por substeps para evitar "tunneling" y saltos entre frames ---
    const MAX_SUBSTEP = 1 / 60; // sub-steps a 60Hz
    let remaining = safeDelta;
    const GROUND_SNAP_EPS = 0.15;

    while (remaining > 0) {
      const dtStep = Math.min(remaining, MAX_SUBSTEP);
      remaining -= dtStep;

      // movimiento horizontal por substep
      if (hasMove) {
        pos.x += moveX * dtStep;
        pos.z += moveZ * dtStep;
        tryTeleport(pos);
      }

      // gravedad e integración vertical
      velocity.current.y += GRAVITY * dtStep;
      pos.y += velocity.current.y * dtStep;

      // colisión con terreno (comprobación por substep)
      const groundY = sampleGroundY(map, pos.x, pos.z);
      const groundDiff = pos.y - groundY;

      if (groundDiff <= 0) {
        pos.y = groundY;
        velocity.current.y = 0;
        isGrounded.current = true;
        airJumpsUsed.current = 0;
        airJumpCooldown.current = 0;
      } else if (groundDiff < GROUND_SNAP_EPS) {
        const downAlpha = 1 - Math.pow(1 - 0.5, dtStep * 60); // amortiguado por substep
        pos.y += (groundY - pos.y) * downAlpha;
        velocity.current.y = 0;
        airJumpsUsed.current = 0;
        airJumpCooldown.current = 0;
        isGrounded.current = true;
      } else {
        isGrounded.current = false;
      }
    }

    // --------- Corrección suave aplicada por frame: LERP hacia serverTargetPos si es necesario ----
    // FIX: eliminamos toda escritura de rot.y dentro de este bloque. La reconciliación
    //      de posición y la orientación visual son ahora dos sistemas independientes.
    //      El servidor solo puede corregir logicalYaw (no rot.y), y únicamente cuando
    //      el jugador está quieto y la discrepancia supera ROT_CORRECTION_THRESHOLD.
    if (needCorrection.current) {
      const target = serverTargetPos.current;

      const errX = target.x - pos.x;
      const errZ = target.z - pos.z;
      const errHorizontal = Math.hypot(errX, errZ);
      const errY = Math.abs(target.y - pos.y);

      const currentSpeed = input.current.run ? RUN_SPEED : WALK_SPEED;
      const dynamicSnapThreshold = SNAP_THRESHOLD + currentSpeed * SEND_INTERVAL * 1.5;

      if (errHorizontal > dynamicSnapThreshold) {
        // snap inmediato SOLO en XZ, suavizar vertical
        pos.x = target.x;
        pos.z = target.z;
        const yAlpha = 1 - Math.pow(1 - SMOOTH_FACTOR * 0.6, safeDelta * 60);
        pos.y += (target.y - pos.y) * yAlpha;
        // FIX: eliminado rot.y = serverTargetRotY.current
        needCorrection.current = false;
      } else if (errY > 1.25) {
        // discrepancia vertical grande: snap Y únicamente
        pos.y = target.y;
        // FIX: eliminado rot.y = serverTargetRotY.current
        needCorrection.current = false;
      } else {
        const alpha = 1 - Math.pow(1 - SMOOTH_FACTOR, safeDelta * 60);
        const vAlpha = Math.max(0.12, alpha * 0.6);
        pos.x += (target.x - pos.x) * alpha;
        pos.z += (target.z - pos.z) * alpha;
        pos.y += (target.y - pos.y) * vAlpha;
        // FIX: eliminado rot.y += ((serverTargetRotY - rot.y + π) % 2π - π) * alpha
        if (pos.distanceTo(target) < 0.01) needCorrection.current = false;
      }

      // FIX: corrección de rotación solo si el jugador NO está en movimiento activo
      //      y la discrepancia supera el umbral. Se corrige logicalYaw, no rot.y,
      //      para que el suavizado visual lo absorba sin producir el parpadeo.
      if (!hasMove) {
        const rotErr = Math.abs(normalizeAngle(serverTargetRotY.current - logicalYaw.current));
        if (rotErr > ROT_CORRECTION_THRESHOLD) {
          logicalYaw.current    = serverTargetRotY.current;
          lastFacingYaw.current = serverTargetRotY.current;
        }
      }
    }

    // ------ Orientación hacia el crosshair (punto en la dirección de la cámara) ------
    // FIX: todo el cálculo trabaja sobre logicalYaw, no sobre rot.y.
    //      rot.y se escribe UNA SOLA VEZ al final del frame desde visualYaw.
    const camDir = new THREE.Vector3();
    cam.getWorldDirection(camDir);
    const lookPoint = cam.position.clone().add(camDir.multiplyScalar(CROSSHAIR_DISTANCE));

    const dx = lookPoint.x - pos.x;
    const dz = lookPoint.z - pos.z;

    const camYaw = typeof window.__cameraYaw === "number" ? window.__cameraYaw : null;

    if (lastFacingYaw.current === null) lastFacingYaw.current = rot.y;

    if (movementYaw !== null) {
      // Si hay movimiento, la dirección del movimiento manda
      lastFacingYaw.current = movementYaw;
      logicalYaw.current    = movementYaw;
    } else {
      const lookYaw = Math.atan2(dx, dz);
      // FIX: normalizeAngle para comparar diferencia de cámara (evita saltos en ±π)
      const camMoved =
        camYaw !== null &&
        prevCamYaw.current !== null &&
        Math.abs(normalizeAngle(camYaw - prevCamYaw.current)) > 0.001;

      if (camMoved || (camYaw !== null && prevCamYaw.current === null)) {
        lastFacingYaw.current = lookYaw;
      }
      logicalYaw.current = lastFacingYaw.current;
    }

    prevCamYaw.current = camYaw;

    // FIX: única asignación a rot.y en todo el frame.
    //      Reemplaza el bloque anterior: diff = (...) % (2π) - π; rot.y += diff * rAlpha
    const vDiff     = normalizeAngle(logicalYaw.current - visualYaw.current);
    const vAlphaRot = 1 - Math.pow(1 - VISUAL_YAW_SMOOTH, safeDelta * 60);
    visualYaw.current += vDiff * vAlphaRot;
    rot.y = visualYaw.current; // ← única escritura a rot.y en todo updateLocalPosition

    // ------------------------- Enviar al servidor (acumulador/desacoplado del framerate) -------------------------
    const packetBase = {
      forward: input.current.forward,
      backward: input.current.backward,
      left: input.current.left,
      right: input.current.right,
      run: input.current.run,
      jump: jumpPressed,
      rotation: rot.y,
      moveX,
      moveZ,
    };

    sendAccumulator.current += safeDelta;

    let sentThisFrame = 0;
    while (sendAccumulator.current >= SEND_INTERVAL && sentThisFrame < MAX_SENDS_PER_FRAME) {
      const sendDt = SEND_INTERVAL;
      const seq = seqRef.current;
      const packetToSend = { seq, ...packetBase, dt: sendDt };

      const sent = Socket.emit("move", packetToSend);
      if (sent) {
        seqRef.current++;
        pendingInputs.current.push(packetToSend);

        if (pendingInputs.current.length > MAX_PENDING_INPUTS) {
          pendingInputs.current.splice(0, pendingInputs.current.length - MAX_PENDING_INPUTS);
        }
        packetBase.jump = false;
      }

      sendAccumulator.current -= SEND_INTERVAL;
      sentThisFrame++;
    }

    if (sendAccumulator.current > SEND_INTERVAL * 6) {
      sendAccumulator.current = SEND_INTERVAL * 2;
    }
  };

  return { updateLocalPosition, input, snapshotBuffer: snapshotBuffer.current };
}