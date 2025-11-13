import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Socket } from "../conection/SocketConnection";
import { KeyboardInput } from "./inputs";

// ------------------------- Constantes compartidas (idénticas al servidor) --------------------------
const WALK_SPEED = 2;
const RUN_SPEED = 4;
const JUMP_VELOCITY = 10;
const GRAVITY = -9.8;

// --- Añadidos mínimos para reconciliación suave ---
const SERVER_TICK = 33 / 1000; // debe coincidir con server TICK_MS
const SMOOTH_FACTOR = 0.16;    // ajustar 0.08..0.35 según gusto
const SNAP_THRESHOLD = 0.6;    // distancia para snap inmediato

// ------------------------- Hook principal para el control del jugador --------------------------
export function usePlayerInput(playerRef, camera) {
  const input = KeyboardInput();

  // estado físico local
  const velocity = useRef({ y: 0 });
  const isGrounded = useRef(true);

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

  // ------------------------- Aplicar estado autoritario del servidor --------------------------
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

      // --- NUEVO: NO hacer snap directo ---
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
        if (corrected.y <= 0) {
          corrected.y = 0;
          simVelY = 0;
          simGrounded = true;
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
  }, [playerRef]);

  // ------------------------- Movimiento local (predicción cliente) --------------------------
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
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDir = new THREE.Vector3();
    if (input.current.forward) moveDir.add(forward);
    if (input.current.backward) moveDir.sub(forward);
    if (input.current.left) moveDir.sub(right);
    if (input.current.right) moveDir.add(right);

    // movimiento horizontal local inmediato (predicción)
    let moveX = 0;
    let moveZ = 0;
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const speed = input.current.run ? RUN_SPEED : WALK_SPEED;
      // aplicar movimiento local
      pos.addScaledVector(moveDir, speed * delta);
      // calcular vector de velocidad en world-space para enviar al servidor / reutilizar en reconciliación
      moveX = moveDir.x * speed;
      moveZ = moveDir.z * speed;
      input.current.rotation = Math.atan2(moveDir.x, moveDir.z);
      rot.y = input.current.rotation;
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
    if (pos.y <= 0) {
      pos.y = 0;
      velocity.current.y = 0;
      isGrounded.current = true;
    }

    // ---- Corrección suave aplicada por frame: lerp hacia serverTargetPos si es necesario ----
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

    // ------------------------- Enviar al servidor -------------------------
    const packet = {
      seq: seqRef.current++,
      forward: input.current.forward,
      backward: input.current.backward,
      left: input.current.left,
      right: input.current.right,
      run: input.current.run,
      jump: input.current.jump,
      rotation: input.current.rotation,
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
