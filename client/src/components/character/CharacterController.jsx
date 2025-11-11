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

    const pos = playerRef.current.position;
    const rot = playerRef.current.rotation;

    // Obtener la cámara actual desde window (o desde contexto React Three Fiber)
    const camera = window.__r3f_camera || window.globalCamera;
    if (!camera) return; // aseguramos que exista

    // Calcular forward y right según la orientación de la cámara
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Calcular la dirección de movimiento
    const moveDir = new THREE.Vector3();
    if (input.current.forward) moveDir.add(forward);
    if (input.current.backward) moveDir.sub(forward);
    if (input.current.left) moveDir.sub(right);
    if (input.current.right) moveDir.add(right);

    // ------------------------- Movimiento horizontal -------------------------
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const speed = input.current.run ? RUN_SPEED : WALK_SPEED;

      // Movimiento relativo a la cámara
      pos.addScaledVector(moveDir, speed * delta);

      // Calcular rotación del jugador hacia la dirección de movimiento
      input.current.rotation = Math.atan2(moveDir.x, moveDir.z);
      rot.y = input.current.rotation;
    }

    // ------------------------- SALTO -------------------------
    if (input.current.jump) {
      jumpBufferRef.current = performance.now() + JUMP_BUFFER_MS;
      input.current.jump = false;
    }
    const jumped = performance.now() < jumpBufferRef.current;

    // ------------------------- Interpolación Y -------------------------
    const targetY = serverYRef.current;
    const dy = targetY - pos.y;
    const alpha = 1 - Math.pow(1 - Y_LERP, delta * 60);
    pos.y += dy * alpha;

    // ------------------------- Enviar al servidor -------------------------
    const packet = {
      seq: seqRef.current++,
      forward: input.current.forward,
      backward: input.current.backward,
      left: input.current.left,
      right: input.current.right,
      run: input.current.run,
      jump: jumped,
      rotation: input.current.rotation,
      dt: delta,
    };
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