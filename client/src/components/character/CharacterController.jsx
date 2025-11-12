import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Socket } from "../conection/SocketConnection";
import { KeyboardInput } from "./inputs";

// ------------------------- Constantes compartidas (idénticas al servidor) --------------------------
const WALK_SPEED = 2;
const RUN_SPEED = 4;
const JUMP_VELOCITY = 10;
const GRAVITY = -9.8;

// ------------------------- Hook principal para el control del jugador --------------------------
export function usePlayerInput(playerRef, camera) {
  const input = KeyboardInput();

  // estado físico local
  const velocity = useRef({ y: 0 });
  const isGrounded = useRef(true);

  // reconciliación y predicción del cliente (server authority + client prediction)
  const seqRef = useRef(0);
  const pendingInputs = useRef([]);

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

      //posición y rotación actuales del jugador
      const pos = playerRef.current.position;
      const rot = playerRef.current.rotation;

      // ---- RECONCILIACIÓN: snap a la posición autoritativa del servidor ----
      pos.x = me.position[0];
      pos.y = me.position[1];
      pos.z = me.position[2];
      rot.y = me.rotation;

      //  El eje Y se deja a la física local (pero actualizamos valores)
      velocity.current.y = me.velocityY ?? velocity.current.y;
      isGrounded.current = !!me.isGrounded;

      // Eliminamos inputs ya procesados por el servidor
      const ack = me.lastProcessedInput ?? -1;
      const remaining = pendingInputs.current.filter(i => i.seq > ack);
      pendingInputs.current = remaining;

      // Re-aplicamos los inputs pendientes (client prediction reenviando la simulación local)
      for (const inp of remaining) {
        // inp.moveX/moveZ son velocidad en world-space (unidades/segundo)
        pos.x += (inp.moveX || 0) * inp.dt;
        pos.z += (inp.moveZ || 0) * inp.dt;
        // rotación visual del cliente
        if (typeof inp.rotation === "number") rot.y = inp.rotation;
      }
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

      // --- Suavizar rotación en lugar de snap inmediato ---
      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      const lerpAngle = (a, b, t) => {
        const diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
        return a + diff * t;
      };
      const t = Math.min(1, 10 * delta); // 10 = velocidad de interpolación (ajustable)
      input.current.rotation = lerpAngle(rot.y, targetRotation, t);
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
