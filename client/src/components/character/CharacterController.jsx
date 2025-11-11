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
  // reconciliation
  const seqRef = useRef(0);
  // prediccion
  const pendingInputs = useRef([]); // array de { seq, forward, backward, left, right, run, jump, rotation, dt }
 
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

  // ------------------------- Aplicar estado autoritario del servidor --------------------------
  useEffect(() => {
    const handleServerChars = (chars) => {
      if (!playerRef.current) return;
      const me = chars.find(c => c.id === Socket.id);
      if (!me) return;
      // Actualizar posición y rotación del jugador local según el servidor
      const pos = playerRef.current.position;
      const rot = playerRef.current.rotation;
      pos.x = me.position[0];
      pos.y = me.position[1];
      pos.z = me.position[2];
      rot.y = me.rotation;

      // --- NUEVO: sincronizar estado vertical para evitar desincronía de suelo/salto ---
      // actualizar velocidad vertical e isGrounded desde el servidor
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
    const jumped = Boolean(input.current.jump);
    // consumir el input de salto localmente para no reenviarlo indefinidamente
    input.current.jump = false;

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

  return { updateLocalPosition, input };
}

/* ---------------------------------------------------------------------------------------------------------- */