import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Socket } from "../conection/SocketConnection";
import { KeyboardInput } from "./inputs";

// ------------------------- Constantes y hooks de movimiento(mismas que en el servidor)--------------------------
// velocidad de movimiento
const WALK_SPEED = 2;
const RUN_SPEED = 4;
// salto y gravedad
const JUMP_VELOCITY = 10;
const GRAVITY = -9.8;

// ------------------------- Hook principal para el control del jugador --------------------------
export function usePlayerInput(playerRef) {
  //traemos los inputs del teclado
  const input = KeyboardInput();
  // estado físico local para salto y gravedad
  const velocity = useRef({ y: 0 });
  const isGrounded = useRef(true);

  // server reconciliation
  const seqRef = useRef(0);
  // client prediction
  const pendingInputs = useRef([]); // array de { seq, forward, backward, left, right, run, jump, rotation, dt }
 
  // --- entity interpolation para salto. Interpolación Y (servidor -> cliente)
  const serverYRef = useRef(0);
  const SNAP_THRESHOLD = 1.0;   // si la diferencia es mayor, forzamos snap
  const Y_LERP = 0.2;           // factor base de lerp por frame (ajustable)
  // --- Buffer para input de salto (evita misses por tap entre frames)
  const jumpBufferRef = useRef(0);
  const JUMP_BUFFER_MS = 150; // tiempo en ms que seguiremos enviando el salto tras la pulsación
  // --- Evitar múltiples emisiones rápidas (cuando mantienes la tecla)
  const lastJumpEmitRef = useRef(0);
  const JUMP_EMIT_COOLDOWN_MS = 50; // cooldown entre emisiones directas

  const H_LERP = 0.15; // factor de interpolación horizontal
  // ------escuchar rotaciones locales disparadas por Ground (click)-----
  useEffect(() => {
    const handler = (e) => {
      if (!input || !input.current) return;
      const rot = e.detail?.rotation;
      if (typeof rot === "number") input.current.rotation = rot;
    };
    window.addEventListener("localRotate", handler);
    return () => window.removeEventListener("localRotate", handler);
  }, [input]);

  // Inicializar serverYRef con la posición actual si existe
  useEffect(() => {
    if (playerRef?.current) serverYRef.current = playerRef.current.position.y;
  }, [playerRef]);

  // ------------------------- Aplicar estado autoritario del servidor --------------------------
  useEffect(() => {
    const handleServerChars = (chars) => {
      if (!playerRef.current) return;
      const me = chars.find(c => c.id === Socket.id);
      if (!me) return;
      // Actualizar posición X/Z y rotación del jugador local según el servidor
      const pos = playerRef.current.position;
      const rot = playerRef.current.rotation;
      pos.x += (me.position[0] - pos.x) * H_LERP; // interpolamos la posicion con un lerp
      pos.z += (me.position[2] - pos.z) * H_LERP;
      rot.y = me.rotation; // rotación directa (no interpolada)

      // Guardar Y objetivo para interpolar (no forzamos snap aquí salvo gran discrepancia)
      const serverY = me.position[1];
      const dy = serverY - pos.y;
      if (Math.abs(dy) > SNAP_THRESHOLD) {
        // Snap si la discrepancia es muy grande (teletransporte)
        pos.y = serverY;
        serverYRef.current = serverY;
      } else {
        // Guardamos la Y objetivo y dejaremos que updateLocalPosition la interpole suavemente
        serverYRef.current = serverY;
      }

      // --- Sincronizar estado vertical para reconciliación ---
      velocity.current.y = typeof me.velocityY === "number" ? me.velocityY : velocity.current.y;
      isGrounded.current = Boolean(me.isGrounded);

      // El servidor indica el último input procesado, usamos eso para reconciliar
      const ack = typeof me.lastProcessedInput === "number" ? me.lastProcessedInput : -1;
      // Eliminar inputs ya confirmados y re-aplicar el resto localmente (solo movimiento horizontal + rotación)
      const remaining = pendingInputs.current.filter(i => i.seq > ack);
      pendingInputs.current = remaining;
      // Re-aplicar inputs restantes
      for (const inp of remaining) {
        const speed = inp.run ? RUN_SPEED : WALK_SPEED;
        const mx = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
        const mz = (inp.forward ? 1 : 0) - (inp.backward ? 1 : 0);
        pos.x += mx * speed * inp.dt;
        pos.z += mz * speed * inp.dt;
        rot.y = inp.rotation;
      }
    };
    // Suscribirse a eventos "characters" del servidor
    Socket.on("characters", handleServerChars);
    return () => { Socket.off("characters", handleServerChars); };
  }, [playerRef]);

  // ------------------------- Movimiento del jugador local --------------------------
  // la posicion local sirve para la predicción del cliente
  const updateLocalPosition = (delta) => {
    if (!playerRef.current) return;
    // Obtener posición y rotación actuales
    const pos = playerRef.current.position;
    const rot = playerRef.current.rotation;
    // Velocidad según si corre o camina
    const speed = input.current.run ? RUN_SPEED : WALK_SPEED; 
    // Usar la misma convención que el servidor:
    const mx = (input.current.left ? 1 : 0) - (input.current.right ? 1 : 0);
    const mz = (input.current.forward ? 1 : 0) - (input.current.backward ? 1 : 0);
    // Calcular movimiento en X y Z
    const moveX = mx * speed * delta;
    const moveZ = mz * speed * delta;

    // Actualizar posición localmente (predicción) SOLO en X/Z
    if (moveX !== 0 || moveZ !== 0) {
      pos.x += moveX;
      pos.z += moveZ;
      input.current.rotation = Math.atan2(mx, mz);
    }

    // --------------------------- SALTO/GRAVEDAD: NO SIMULAR EN CLIENTE -------------------------------
    // En lugar de aplicar salto y gravedad localmente, solo enviamos el flag de salto al servidor.
    // El servidor será quien actualice pos.y, velocityY e isGrounded; el cliente los sincroniza en handleServerChars.
    // Si el input proviene del KeyboardInput (o algún UI) ponemos el latch
    if (input.current.jump) {
      jumpBufferRef.current = performance.now() + JUMP_BUFFER_MS;
      input.current.jump = false;
    }
    // enviamos jump=true mientras el latch esté activo (o si se emitió directamente en keydown)
    const jumped = performance.now() < jumpBufferRef.current;

    // ------------------------- Interpolación Y hacia valor del servidor -------------------------
    const targetY = serverYRef.current;
    const dy = targetY - pos.y;
    if (Math.abs(dy) > SNAP_THRESHOLD) {
      // Forzar snap por seguridad (ya cubierto en el handler, pero repetimos por si no llegó)
      pos.y = targetY;
    } else {
      // convertir Y_LERP en alpha por frame (frame-rate independent)
      const alpha = 1 - Math.pow(1 - Y_LERP, delta * 60);
      pos.y += dy * alpha;
    }

    // ------------------------- Aplicar rotación local --------------------------
    rot.y = input.current.rotation;

    // ------------------------- Enviar input al servidor -------------------------
    // Preparar paquete de input con seq y dt (dt usado solo por cliente para re-aplicar horizontales)
    const packet = {
      seq: seqRef.current++,
      forward: input.current.forward,
      backward: input.current.backward,
      left: input.current.left,
      right: input.current.right,
      run: input.current.run,
      jump: jumped,
      rotation: input.current.rotation,
      dt: delta
    };
    // Guardar para reconciliación y emitir al servidor
    pendingInputs.current.push(packet);
    Socket.emit("move", packet);
  };

  // Emisión directa en keydown (Space) para garantizar entrega rápida al servidor
  useEffect(() => {
    const handleKeyDown = (e) => {
      // detectar Space (usar code para evitar problemas con layout)
      if (e.code !== "Space") return;
      const now = performance.now();
      if (now - lastJumpEmitRef.current < JUMP_EMIT_COOLDOWN_MS) return;
      lastJumpEmitRef.current = now;

      // preparar paquete y emitir inmediatamente (dt = 0 porque es instantáneo)
      const packet = {
        seq: seqRef.current++,
        forward: input.current.forward,
        backward: input.current.backward,
        left: input.current.left,
        right: input.current.right,
        run: input.current.run,
        jump: true,
        rotation: input.current.rotation,
        dt: 0
      };
      pendingInputs.current.push(packet);
      Socket.emit("move", packet);

      // arrancar el latch para que los siguientes frames también consideren jump activo
      jumpBufferRef.current = now + JUMP_BUFFER_MS;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ input ]);

  return { updateLocalPosition, input };
}

/* ---------------------------------------------------------------------------------------------------------- */