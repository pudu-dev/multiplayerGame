import { useRef } from "react";
import * as THREE from "three";
import { Socket } from "../conection/SocketConnection";
import { KeyboardInput } from "./inputs";

const WALK_SPEED = 2;
const RUN_SPEED = 4;
const JUMP_VELOCITY = 5;
const GRAVITY = -9.8;

export function usePlayerInput(playerRef) {

  const input = KeyboardInput();
  const velocity = useRef({ y: 0 });
  const isGrounded = useRef(true);

  // --- Movimiento del jugador local ---
  const updateLocalPosition = (delta) => {
    if (!playerRef.current) return;
    // Obtener posición y rotación actuales
    const pos = playerRef.current.position;
    const rot = playerRef.current.rotation;

    const speed = input.current.run ? RUN_SPEED : WALK_SPEED; // Velocidad según si corre o camina
    let moveX = 0, moveZ = 0; // Variables de movimiento
    
    // Movimiento adelante/atrás/izquierda/derecha. da direccion
    if (input.current.forward) moveZ += speed * delta;
    if (input.current.backward) moveZ -= speed * delta;
    if (input.current.left) moveX += speed * delta;
    if (input.current.right) moveX -= speed * delta;

    // Actualizar posición
    if (moveX !== 0 || moveZ !== 0) {
      pos.x += moveX;
      pos.z += moveZ;
      input.current.rotation = Math.atan2(moveX, moveZ);
    }

    // Salto y gravedad
    if (input.current.jump && isGrounded.current) {
      velocity.current.y = JUMP_VELOCITY;
      isGrounded.current = false;
      input.current.jump = false;
    }
    velocity.current.y += GRAVITY * delta;
    pos.y += velocity.current.y * delta;

    if (pos.y <= 0) {
      pos.y = 0;
      velocity.current.y = 0;
      isGrounded.current = true;
    }

    // Aplicar rotación local
    rot.y = input.current.rotation;

    // Emitir input al servidor
    Socket.emit("move", {
      forward: input.current.forward,
      backward: input.current.backward,
      left: input.current.left,
      right: input.current.right,
      run: input.current.run,
      jump: false,
      rotation: input.current.rotation
    });
  };

  return { updateLocalPosition, input };
}
