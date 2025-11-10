import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Socket } from "../conection/SocketConnection";
import { KeyboardInput } from "./inputs";

// Constantes de movimiento, mismas que en el servidor
const WALK_SPEED = 2;
const RUN_SPEED = 4;

// Constantes de salto y gravedad
const JUMP_VELOCITY = 5;
const GRAVITY = -9.8;

export function usePlayerInput(playerRef) {

  const input = KeyboardInput();//traemos los inputs del teclado

  // estado físico local para salto y gravedad
  const velocity = useRef({ y: 0 });
  const isGrounded = useRef(true);

  // reconciliation
  const seqRef = useRef(0);
  // prediccion
  const pendingInputs = useRef([]); // array de { seq, forward, backward, left, right, run, jump, rotation, dt }

  // nuevo: escuchar rotaciones locales disparadas por Ground (click)
  useEffect(() => {
    const handler = (e) => {
      if (!input || !input.current) return;
      const rot = e.detail?.rotation;
      if (typeof rot === "number") input.current.rotation = rot;
    };
    window.addEventListener("localRotate", handler);
    return () => window.removeEventListener("localRotate", handler);
  }, [input]);

  useEffect(() => {
    const handleServerChars = (chars) => {
      if (!playerRef.current) return;
      const me = chars.find(c => c.id === Socket.id);
      if (!me) return;

      // Aplicar estado autoritario del servidor
      const pos = playerRef.current.position;
      const rot = playerRef.current.rotation;
      pos.x = me.position[0];
      pos.y = me.position[1];
      pos.z = me.position[2];
      rot.y = me.rotation;

      // El servidor indica el último input procesado
      const ack = typeof me.lastProcessedInput === "number" ? me.lastProcessedInput : -1;

      // Eliminar inputs ya confirmados y re-aplicar el resto localmente (solo movimiento horizontal + rotación)
      const remaining = pendingInputs.current.filter(i => i.seq > ack);
      pendingInputs.current = remaining;

      for (const inp of remaining) {
        const speed = inp.run ? RUN_SPEED : WALK_SPEED;
        const mx = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
        const mz = (inp.forward ? 1 : 0) - (inp.backward ? 1 : 0);
        pos.x += mx * speed * inp.dt;
        pos.z += mz * speed * inp.dt;
        rot.y = inp.rotation;
      }
    };

    Socket.on("characters", handleServerChars);
    return () => { Socket.off("characters", handleServerChars); };
  }, [playerRef]);

  // --- Movimiento del jugador local ---
  const updateLocalPosition = (delta) => {
    if (!playerRef.current) return;
    // Obtener posición y rotación actuales
    const pos = playerRef.current.position;
    const rot = playerRef.current.rotation;

    const speed = input.current.run ? RUN_SPEED : WALK_SPEED; // Velocidad según si corre o camina

    // Usar la misma convención que el servidor:
    // mx = right - left, mz = backward - forward
    const mx = (input.current.left ? 1 : 0) - (input.current.right ? 1 : 0);
    const mz = (input.current.forward ? 1 : 0) - (input.current.backward ? 1 : 0);
    // Calcular movimiento en X y Z
    const moveX = mx * speed * delta;
    const moveZ = mz * speed * delta;

    // Actualizar posición localmente (predicción)
    if (moveX !== 0 || moveZ !== 0) {
      pos.x += moveX;
      pos.z += moveZ;
      input.current.rotation = Math.atan2(mx, mz);
    }

    // Salto y gravedad (el jugador solo salta si esta en el suelo)
    let jumped = false;
    if (input.current.jump && isGrounded.current) {
      velocity.current.y = JUMP_VELOCITY;
      isGrounded.current = false;
      jumped = true;
      input.current.jump = false; // consumir input localmente
    }
    // aplicar gravedad
    velocity.current.y += GRAVITY * delta;
    pos.y += velocity.current.y * delta;

    // si el jugador toca el suelo, reiniciar posición y velocidad vertical
    if (pos.y <= 0) {
      pos.y = 0;
      velocity.current.y = 0;
      isGrounded.current = true;
    }

    // Aplicar rotación local
    rot.y = input.current.rotation;

    // Preparar paquete de input con seq y dt (dt usado solo por cliente para re-aplicar)
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
